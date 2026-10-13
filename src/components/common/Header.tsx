import React, { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Menu, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePendingCounts } from '../../context/PendingCountsContext';
import { ThemeToggle } from './ThemeToggle';
import { useNavGroups, BrandMark } from './Sidebar';
import { findNav } from '../../config/navigation';

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'System admin',
  CEO: 'CEO',
  HR: 'HR',
  ACCOUNTS: 'Accounts',
  IT: 'IT',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee'
};

/** Close a popover when the user clicks outside it or presses Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export const Header: React.FC<{ onOpenMenu?: () => void }> = ({ onOpenMenu }) => {
  const { currentUser, roles, logout, setActiveNav, activeNav } = useAuth();
  const { counts } = usePendingCounts();
  const groups = useNavGroups();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const notifRef = useDismiss(showNotifications, () => setShowNotifications(false));
  const accountRef = useDismiss(showAccount, () => setShowAccount(false));

  const notifications = [
    { n: counts.leaveApprovals, title: 'Leave requests to approve', nav: 'team-approvals' },
    { n: counts.regularizations, title: 'Time updates to review', nav: 'team-regularization' },
    { n: counts.holidayWorkClaims, title: 'Comp-off and overtime claims', nav: 'team-holiday-work' },
    { n: counts.payrollApprovals, title: 'Payroll waiting for your approval', nav: 'payroll-approval' },
    { n: counts.salaryRevisions, title: 'Salary revisions to approve', nav: 'payroll-increments' },
    { n: counts.itRequests, title: 'Open IT requests', nav: 'it-requests' },
    { n: counts.myLifecycleTasks, title: 'Onboarding and exit tasks', nav: 'hr-lifecycle' },
    { n: counts.myUnacknowledgedAssets, title: 'Company assets to acknowledge', nav: 'my-assets' }
  ].filter(x => x.n > 0);
  const totalPending = notifications.reduce((s, x) => s + x.n, 0);

  if (!currentUser) return null;

  const initials = currentUser.fullName
    .replace(/^Dr\.?\s+/i, '')
    .split(' ')
    .map(part => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const primaryRole = roles.find(r => r !== 'EMPLOYEE') || 'EMPLOYEE';
  const here = findNav(groups, activeNav);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="md:hidden -ml-1 p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="md:hidden rounded-[10px] bg-ink p-0.5">
        <BrandMark compact />
      </div>

      <div className="min-w-0 flex-1">
        {here && here.group.id !== 'me' && (
          <div className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">{here.group.label}</div>
        )}
        <div className="font-display text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate">
          {here?.item.label ?? 'SecondMedic'}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <ThemeToggle />

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(v => !v)}
            className="relative h-9 w-9 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={totalPending > 0 ? `${totalPending} items need your attention` : 'Notifications'}
            aria-expanded={showNotifications}
          >
            <Bell className="h-[18px] w-[18px]" />
            {totalPending > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-ink text-[11.5px] font-bold leading-[18px] text-center tabular ring-2 ring-white dark:ring-slate-900">
                {totalPending > 99 ? '99+' : totalPending}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-white dark:bg-slate-900 shadow-lift border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">Needs your attention</div>
              </div>
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Nothing waiting on you.</p>
              ) : (
                <ul className="py-1 max-h-80 overflow-y-auto">
                  {notifications.map(item => (
                    <li key={item.nav}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNav(item.nav);
                          setShowNotifications(false);
                        }}
                        className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span className="text-sm text-slate-800 dark:text-slate-200">{item.title}</span>
                        <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 text-[12.5px] font-bold text-amber-800 dark:text-amber-300 tabular">
                          {item.n}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={accountRef}>
          <button
            type="button"
            onClick={() => setShowAccount(v => !v)}
            className="flex items-center gap-2 rounded-lg pl-1 pr-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-expanded={showAccount}
            aria-label="Account"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white font-display text-[12.5px] font-semibold">
              {initials}
            </span>
            <span className="hidden lg:block text-left leading-tight">
              <span className="block text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 max-w-[11rem] truncate">
                {currentUser.fullName}
              </span>
              <span className="block text-[12.5px] text-slate-500 dark:text-slate-400">{ROLE_LABELS[primaryRole] ?? primaryRole}</span>
            </span>
            <ChevronDown className="hidden lg:block h-4 w-4 text-slate-400" aria-hidden />
          </button>

          {showAccount && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-slate-900 shadow-lift border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{currentUser.fullName}</div>
                <div className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">{currentUser.officialEmail}</div>
                <div className="mt-2 text-[12.5px] text-slate-600 dark:text-slate-300">
                  {currentUser.designation}
                  {currentUser.empCode ? <span className="text-slate-400"> ({currentUser.empCode})</span> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {roles.map(r => (
                    <span
                      key={r}
                      className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11.5px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
