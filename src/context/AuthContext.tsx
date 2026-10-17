import React, { createContext, useContext, useState, useEffect } from 'react';
import { withManagerName } from '../api/managerNames';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mapEmployee } from '../api/mappers';
import { LoginScreen } from '../components/auth/LoginScreen';
import { BrandMark } from '../components/common/BrandMark';
import type { Employee, RoleType } from '../types';
import { AlertTriangle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface AuthContextType {
  session: Session | null;
  employee: Employee | null;
  currentUser: Employee | null; // backward-compatible alias
  roles: RoleType[];
  loading: boolean;
  isLoading: boolean; // backward-compatible alias
  error: string | null;
  signIn: (email: string, password?: string) => Promise<void>;
  login: (email: string, password?: string) => Promise<void>; // backward-compatible alias
  signOut: () => Promise<void>;
  logout: () => Promise<void>; // backward-compatible alias
  activeNav: string;
  setActiveNav: (nav: string) => void;
  toasts: ToastMessage[];
  showToast: (title: string, message?: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  isManager: boolean;
  isHr: boolean;
  isAccounts: boolean;
  isIt: boolean;
  isCeo: boolean;
  /** Number of people reporting directly to the signed-in employee. */
  directReportCount: number;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadEmployeeForUser(user: User): Promise<{ employee: Employee; roles: RoleType[]; directReportCount: number }> {
  const email = (user.email ?? '').trim().toLowerCase();
  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('*, department:departments!employees_department_id_fkey(name)')
    .or(`auth_user_id.eq.${user.id},official_email.ilike.${email},personal_email.ilike.${email}`)
    .maybeSingle();

  if (empError || !emp) {
    throw new Error('Your login is not linked to a staff record — contact HR');
  }

  // Link auth_user_id or update official_email if needed
  if (user.id && (!emp.auth_user_id || (email && emp.official_email.toLowerCase() !== email))) {
    await supabase
      .from('employees')
      .update({
        auth_user_id: user.id,
        official_email: emp.official_email.toLowerCase() === email ? emp.official_email : (email || emp.official_email)
      })
      .eq('id', emp.id);
  }

  const { data: rolesData, error: rolesError } = await supabase
    .from('employee_roles')
    .select('role')
    .eq('employee_id', emp.id);

  if (rolesError) {
    throw new Error(`Failed to load user roles: ${rolesError.message}`);
  }

  const roles = (rolesData ?? []).map((r: any) => r.role as RoleType);

  // Anyone with direct reports approves for them, whether or not MANAGER was granted explicitly.
  const { count } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', emp.id)
    .neq('status', 'EXITED');

  return {
    employee: mapEmployee(await withManagerName(emp)),
    roles,
    directReportCount: count ?? 0
  };
}

function getInitialNav(): string {
  if (typeof window === 'undefined') return 'dashboard';
  const path = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!path || path === 'login') return 'dashboard';
  return path;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [directReportCount, setDirectReportCount] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNavState] = useState<string>(getInitialNav);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const setActiveNav = (nav: string) => {
    setActiveNavState(nav);
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      if (currentPath !== nav) {
        window.history.pushState({ nav }, '', `/${nav}`);
      }
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const path = typeof window !== 'undefined' ? window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '') : '';
      if (!session || !employee) {
        if (typeof window !== 'undefined' && path !== '' && path !== 'login') {
          window.history.replaceState(null, '', '/');
        }
        return;
      }
      setActiveNavState(!path || path === 'login' ? 'dashboard' : path);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [session, employee]);

  // Sync address bar when authenticated and landing on login or root
  useEffect(() => {
    if (session && employee && typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      if (path === 'login' || path === '') {
        window.history.replaceState({ nav: activeNav }, '', `/${activeNav}`);
      }
    }
  }, [session, employee, activeNav]);

  // Login form state for unauthenticated view
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState<string | null>(null);

  const showToast = (title: string, message?: string, type: ToastMessage['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setError('Supabase connection details are not fully configured. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: initSession }, error: sessionError }) => {
      if (!isMounted) return;
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }
      setSession(initSession);
      if (initSession?.user) {
        loadEmployeeForUser(initSession.user)
          .then(({ employee: emp, roles: r, directReportCount: reports }) => {
            if (!isMounted) return;
            setEmployee(emp);
            setRoles(r);
            setDirectReportCount(reports);
            setError(null);
            setLoading(false);
          })
          .catch(err => {
            if (!isMounted) return;
            setError(err.message || 'Your login is not linked to a staff record — contact HR');
            setLoading(false);
          });
      } else {
        if (isMounted) setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      if (newSession?.user) {
        setSession(newSession);
        setLoading(true);
        try {
          const { employee: emp, roles: r, directReportCount: reports } = await loadEmployeeForUser(newSession.user);
          if (isMounted) {
            setEmployee(emp);
            setRoles(r);
            setDirectReportCount(reports);
            setError(null);
          }
        } catch (err: any) {
          if (isMounted) {
            setEmployee(null);
            setRoles([]);
            setError(err.message || 'Your login is not linked to a staff record — contact HR');
          }
        } finally {
          if (isMounted) setLoading(false);
        }
      } else {
        setSession(null);
        setEmployee(null);
        setRoles([]);
        setError(null);
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password?: string) => {
    setLoading(true);
    setError(null);
    setLoginError(null);
    const normalized = email.trim().toLowerCase();

    if (!normalized || !password) {
      setLoading(false);
      const msg = 'Please enter both email and password';
      setLoginError(msg);
      throw new Error(msg);
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalized,
        password
      });
      if (authError) {
        throw authError;
      }
    } catch (err: any) {
      setLoading(false);
      const msg = err.message || 'Authentication failed';
      setLoginError(msg);
      throw err;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut().catch(() => {});
      setSession(null);
      setEmployee(null);
      setRoles([]);
      setError(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/');
      }
    } finally {
      setLoading(false);
    }
  };

  const isManager = roles.includes('MANAGER') || directReportCount > 0;
  const isHr = roles.includes('HR');
  const isAccounts = roles.includes('ACCOUNTS') || roles.includes('SYSTEM_ADMIN');
  const isIt = roles.includes('IT');
  const isCeo = roles.includes('CEO');
  const isAdmin = roles.includes('SYSTEM_ADMIN');

  // While loading, render a full-page skeleton — never render children against a null employee
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950" role="status">
        <div>
          <BrandMark />
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full w-1/3 rounded-full bg-teal-500 animate-[loadbar_1.1s_ease-in-out_infinite]" />
        </div>
        <span className="sr-only">Loading your account</span>
      </div>
    );
  }

  // If session exists but no employee row matches: clear error state
  if (session && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-5">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
          <div className="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-50">We couldn't open your staff profile</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            You're signed in as <span className="font-semibold">{session.user.email}</span>, but no staff record is linked to this
            email. Ask HR to check that your official email matches this address.
          </p>
          <p className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-[12.5px] text-slate-500 dark:text-slate-400">
            Details: {error}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-6 w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // If no session exists: render clean authenticated portal login
  if (!session || !employee) {
    const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginEmail.trim()) return;
      setLoginSubmitting(true);
      setLoginError(null);
      try {
        await signIn(loginEmail.trim(), loginPassword);
      } catch (err: any) {
        setLoginError(err.message || 'Authentication failed');
      } finally {
        setLoginSubmitting(false);
      }
    };

    const handleForgotPassword = async () => {
      if (!loginEmail.trim()) {
        setLoginError('Enter your work email first, then choose "Forgot or new password?"');
        return;
      }
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
        redirectTo: window.location.origin
      });
      setLoginError(resetError ? resetError.message : null);
      setResetSent(resetError ? null : loginEmail.trim());
    };

    return (
      <LoginScreen
        email={loginEmail}
        password={loginPassword}
        onEmailChange={setLoginEmail}
        onPasswordChange={setLoginPassword}
        submitting={loginSubmitting}
        error={loginError || error}
        resetSent={resetSent}
        onSubmit={handleFormSubmit}
        onForgotPassword={handleForgotPassword}
      />
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        employee,
        currentUser: employee,
        roles,
        loading,
        isLoading: loading,
        error,
        signIn,
        login: signIn,
        signOut,
        logout: signOut,
        activeNav,
        setActiveNav,
        toasts,
        showToast,
        removeToast,
        isManager,
        isHr,
        isAccounts,
        isIt,
        isCeo,
        directReportCount,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
