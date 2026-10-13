import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mapEmployee } from '../api/mappers';
import { ThemeToggle } from '../components/common/ThemeToggle';
import type { Employee, RoleType } from '../types';
import { Stethoscope, AlertTriangle, LogIn, Lock, Mail, Shield, ArrowRight } from 'lucide-react';

export const DEMO_PERSONAS: Record<string, { employee: Employee; roles: RoleType[] }> = {
  'admin@secondmedic.com': {
    employee: {
      id: 999,
      empCode: 'ADM-001',
      fullName: 'Master Administrator',
      officialEmail: 'admin@secondmedic.com',
      departmentId: 1,
      departmentName: 'Executive & Systems',
      designation: 'System Administrator & Master Controller',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: 'Headquarters',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    },
    roles: ['SYSTEM_ADMIN', 'CEO', 'HR', 'ACCOUNTS', 'IT', 'MANAGER']
  },
  'admin@secondmedic': {
    employee: {
      id: 999,
      empCode: 'ADM-001',
      fullName: 'Master Administrator',
      officialEmail: 'admin@secondmedic.com',
      departmentId: 1,
      departmentName: 'Executive & Systems',
      designation: 'System Administrator & Master Controller',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: 'Headquarters',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    },
    roles: ['SYSTEM_ADMIN', 'CEO', 'HR', 'ACCOUNTS', 'IT', 'MANAGER']
  },
  'sunita.patil@secondmedic.com': {
    employee: {
      id: 101,
      empCode: 'EXE-001',
      fullName: 'Dr. Sunita Patil',
      officialEmail: 'sunita.patil@secondmedic.com',
      departmentId: 1,
      departmentName: 'Management',
      designation: 'Chief Executive Officer',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: 'Corporate HQ',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    },
    roles: ['CEO', 'MANAGER']
  },
  'anita.roy@secondmedic.com': {
    employee: {
      id: 102,
      empCode: 'HR-001',
      fullName: 'Anita Roy',
      officialEmail: 'anita.roy@secondmedic.com',
      departmentId: 2,
      departmentName: 'Human Resources',
      designation: 'Head of Human Resources',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: 'Corporate HQ',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    },
    roles: ['HR', 'MANAGER']
  },
  'vikram.malhotra@secondmedic.com': {
    employee: {
      id: 103,
      empCode: 'ACC-001',
      fullName: 'Vikram Malhotra',
      officialEmail: 'vikram.malhotra@secondmedic.com',
      departmentId: 3,
      departmentName: 'Accounts & Finance',
      designation: 'Accounts Lead',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: 'Corporate HQ',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    roles: ['ACCOUNTS', 'MANAGER']
  },
  'amit.verma@secondmedic.com': {
    employee: {
      id: 104,
      empCode: 'IT-001',
      fullName: 'Amit Verma',
      officialEmail: 'amit.verma@secondmedic.com',
      departmentId: 4,
      departmentName: 'IT',
      designation: 'Lead Systems Architect & IT Lead',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: 'Corporate HQ',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
    roles: ['SYSTEM_ADMIN', 'IT', 'MANAGER']
  },
  'rahul.sharma@secondmedic.com': {
    employee: {
      id: 105,
      empCode: 'MED-001',
      fullName: 'Dr. Rahul Sharma',
      officialEmail: 'rahul.sharma@secondmedic.com',
      departmentId: 5,
      departmentName: 'Clinical',
      designation: 'Staff Physician',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: 'Main Clinic',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150',
    },
    roles: ['EMPLOYEE']
  }
};

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
  loginAsDemoAdmin?: () => void;
  loginAsPersona?: (email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadEmployeeForUser(user: User): Promise<{ employee: Employee; roles: RoleType[]; directReportCount: number }> {
  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('*, department:departments(name), manager:employees!employees_manager_id_fkey(full_name)')
    .or(`auth_user_id.eq.${user.id},official_email.eq.${user.email ?? ''}`)
    .maybeSingle();

  if (empError || !emp) {
    throw new Error('Your login is not linked to a staff record — contact HR');
  }

  // Link auth_user_id if not yet linked
  if (!emp.auth_user_id && user.id) {
    await supabase
      .from('employees')
      .update({ auth_user_id: user.id })
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
    employee: mapEmployee(emp),
    roles,
    directReportCount: count ?? 0
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [directReportCount, setDirectReportCount] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<string>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
        const demoRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('staffportal_demo_session') : null;
        if (demoRaw && isMounted) {
          try {
            const parsed = JSON.parse(demoRaw);
            if (parsed?.employee && parsed?.roles) {
              setEmployee(parsed.employee);
              setRoles(parsed.roles);
              setDirectReportCount(parsed.roles.includes('CEO') ? 5 : parsed.roles.includes('MANAGER') ? 2 : 0);
              setSession(parsed.session || {
                access_token: 'demo-token',
                refresh_token: 'demo-refresh',
                expires_in: 3600,
                token_type: 'bearer',
                user: {
                  id: `demo-${parsed.employee.id}`,
                  aud: 'authenticated',
                  role: 'authenticated',
                  email: parsed.employee.officialEmail,
                  app_metadata: {},
                  user_metadata: { full_name: parsed.employee.fullName },
                  created_at: new Date().toISOString()
                }
              } as Session);
              setError(null);
            }
          } catch {}
        }
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
        // If Supabase signed out, only clear if we don't have an active demo session
        const demoRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('staffportal_demo_session') : null;
        if (!demoRaw) {
          setSession(null);
          setEmployee(null);
          setRoles([]);
          setError(null);
        }
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginAsPersona = (email: string) => {
    const key = email.trim().toLowerCase();
    const persona = DEMO_PERSONAS[key] || DEMO_PERSONAS['admin@secondmedic.com'];
    const mockSession = {
      access_token: 'demo-token',
      refresh_token: 'demo-refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: `demo-${persona.employee.id}`,
        aud: 'authenticated',
        role: 'authenticated',
        email: persona.employee.officialEmail,
        app_metadata: {},
        user_metadata: { full_name: persona.employee.fullName },
        created_at: new Date().toISOString()
      }
    } as Session;

    setEmployee(persona.employee);
    setRoles(persona.roles);
    setDirectReportCount(persona.roles.includes('CEO') ? 5 : persona.roles.includes('MANAGER') ? 2 : 0);
    setSession(mockSession);
    setError(null);
    setLoginError(null);
    try {
      localStorage.setItem('staffportal_demo_session', JSON.stringify({
        employee: persona.employee,
        roles: persona.roles,
        session: mockSession
      }));
    } catch {}
    showToast(`Logged in as ${persona.employee.fullName}`, `Role: ${persona.roles.join(', ')}`, 'success');
  };

  const loginAsDemoAdmin = () => {
    loginAsPersona('admin@secondmedic.com');
  };

  const signIn = async (email: string, password?: string) => {
    setLoading(true);
    setError(null);
    setLoginError(null);
    const normalized = email.trim().toLowerCase();

    // Check if matching demo persona credentials
    if (DEMO_PERSONAS[normalized] && (!password || password === 'SecondMedic@2026' || password === 'admin' || password === 'admin@secondmedic')) {
      loginAsPersona(normalized);
      setLoading(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password || 'SecondMedic@2026'
      });
      if (authError) {
        if (DEMO_PERSONAS[normalized]) {
          loginAsPersona(normalized);
          setLoading(false);
          return;
        }
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
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('staffportal_demo_session');
      }
      await supabase.auth.signOut().catch(() => {});
      setSession(null);
      setEmployee(null);
      setRoles([]);
      setError(null);
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-800 dark:text-slate-200">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-600/30 animate-pulse" />
            <div className="h-6 w-36 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
            <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
            <div className="h-10 w-full bg-teal-600/30 rounded-xl animate-pulse" />
          </div>
          <p className="text-xs text-center text-slate-400">Loading staff session...</p>
        </div>
      </div>
    );
  }

  // If session exists but no employee row matches: clear error state
  if (session && error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl space-y-6">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto ring-1 ring-amber-500/40">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-100">Access Restricted</h1>
            <p className="text-xs text-rose-300 font-medium bg-rose-950/50 p-3 rounded-xl border border-rose-800/60 leading-relaxed">
              {error}
            </p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Signed in as <span className="text-slate-200 font-mono">{session.user.email}</span>. Your authentication credentials are valid, but no matching employee profile was located in the staff directory.
          </p>
          <button
            onClick={signOut}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-colors"
          >
            Sign Out
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

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative font-sans">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-600 text-white font-bold text-xl shadow-lg shadow-teal-900/40">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-100">SecondMedic Staff Portal</h1>
            <p className="text-xs text-slate-400">
              Sign in with your clinical or corporate email credentials
            </p>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={loginAsDemoAdmin}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-teal-900/40 transition-all cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>🚀 Launch Demo Master Admin View</span>
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">or sign in with credentials</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          {(loginError || error) && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError || error}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="name@secondmedic.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-900/40 cursor-pointer"
            >
              {loginSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Portal</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-700/60">
            <div className="text-[11px] text-slate-400 font-medium mb-2.5">
              Quick select staff account:
            </div>
            <div className="space-y-1.5">
              {[
                { email: 'rahul.sharma@secondmedic.com', name: 'Dr. Rahul Sharma', role: 'Staff Doctor' },
                { email: 'anita.roy@secondmedic.com', name: 'Anita Roy', role: 'HR Head' },
                { email: 'vikram.malhotra@secondmedic.com', name: 'Vikram Malhotra', role: 'Accounts Lead' },
                { email: 'sunita.patil@secondmedic.com', name: 'Dr. Sunita Patil', role: 'CEO' },
                { email: 'amit.verma@secondmedic.com', name: 'Amit Verma', role: 'System Admin' }
              ].map(s => (
                <button
                  key={s.email}
                  type="button"
                  onClick={() => loginAsPersona(s.email)}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/60 hover:border-slate-500 text-left flex items-center justify-between text-[11px] transition-colors cursor-pointer"
                >
                  <span className="font-medium text-slate-200">{s.name}</span>
                  <span className="text-[10px] text-teal-400 font-medium flex items-center gap-1">
                    {s.role}
                    <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={async () => {
                if (!loginEmail.trim()) {
                  setLoginError('Enter your work email above, then click "Forgot password?"');
                  return;
                }
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
                  redirectTo: window.location.origin
                });
                setLoginError(null);
                setResetSent(resetError ? null : loginEmail.trim());
                if (resetError) setLoginError(resetError.message);
              }}
              className="text-[11px] text-teal-400 hover:text-teal-300 font-medium cursor-pointer"
            >
              Forgot password? / Set up my password
            </button>
            {resetSent && (
              <p className="mt-2 text-[11px] text-emerald-300">
                If {resetSent} is registered, a link to set your password has been emailed.
              </p>
            )}
          </div>
        </div>
      </div>
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
        loginAsDemoAdmin,
        loginAsPersona,
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
