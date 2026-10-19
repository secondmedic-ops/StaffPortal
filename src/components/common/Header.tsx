import React, { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Menu, ChevronDown, Search, CornerDownLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePendingCounts } from '../../context/PendingCountsContext';
import { useNavGroups, BrandMark } from './Sidebar';
import { NavGroup } from '../../config/navigation';

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'System admin',
  CEO: 'CEO',
  DIRECTOR: 'Director',
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

/** Jump to any page the signed-in person can open. Ctrl/⌘+K or "/" focuses it. */
const PageSearch: React.FC<{ groups: NavGroup[] }> = ({ groups }) => {
  const { setActiveNav } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useDismiss(open, () => setOpen(false));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  const results = groups
    .flatMap(g => g.items.map(item => ({ item, group: g })))
    .filter(({ item, group }) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return !q || item.label.toLowerCase().includes(q) || group.label.toLowerCase().includes(q);
    })
    .slice(0, 8);

  const go = (id: string) => {
    setActiveNav(id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full max-w-md" ref={boxRef}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCursor(c => Math.min(c + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor(c => Math.max(c - 1, 0));
          } else if (e.key === 'Enter' && results[cursor]) {
            go(results[cursor].item.id);
          }
        }}
        placeholder="Search pages…"
        aria-label="Search pages"
        role="combobox"
        aria-expanded={open}
        aria-controls="page-search-results"
        className="h-11 w-full rounded-xl border border-transparent bg-slate-100/80 dark:bg-slate-800/70 pl-10 pr-14 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-colors focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-teal-400 focus:ring-3 focus:ring-teal-500/15 [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-[11px] font-medium text-slate-400">
        Ctrl K
      </kbd>

      {open && (
        <ul
          id="page-search-results"
          role="listbox"
          className="absolute left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-lift z-50"
        >
          {results.length === 0 ? (
            <li className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No page matches “{query}”.</li>
          ) : (
            results.map(({ item, group }, i) => {
              const Icon = item.icon;
              return (
                <li key={item.id} role="option" aria-selected={i === cursor}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(item.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left ${
                      i === cursor ? 'bg-teal-50 dark:bg-teal-950/50' : ''
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.label}</span>
                      <span className="block text-[12px] text-slate-400">{group.label}</span>
                    </span>
                    {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};

/** Today's date and the time, refreshed every 30 seconds. */
const Clock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="hidden xl:flex items-center gap-3 text-[13.5px] text-slate-600 dark:text-slate-300 tabular whitespace-nowrap">
      <span>{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <span className="h-4 w-px bg-slate-300 dark:bg-slate-700" aria-hidden />
      <span>{now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
};

export const Header: React.FC<{ onOpenMenu?: () => void }> = ({ onOpenMenu }) => {
  const { currentUser, roles, logout, setActiveNav } = useAuth();
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

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 sm:gap-4 border-b border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        className="md:hidden -ml-1 p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="md:hidden">
        <BrandMark compact />
      </div>

      <div className="min-w-0 flex-1">
        <PageSearch groups={groups} />
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Clock />

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(v => !v)}
            className="relative h-10 w-10 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={totalPending > 0 ? `${totalPending} items need your attention` : 'Notifications'}
            aria-expanded={showNotifications}
          >
            <Bell className="h-5 w-5" />
            {totalPending > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-semibold leading-[18px] text-center tabular ring-2 ring-white dark:ring-slate-900">
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
            className="flex items-center gap-2.5 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-expanded={showAccount}
            aria-label="Account"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-white font-display text-[13px] font-semibold ring-2 ring-white dark:ring-slate-900 shadow-sm">
              {initials}
            </span>
            <span className="hidden lg:block text-left leading-tight">
              <span className="block text-[14.5px] font-semibold text-slate-900 dark:text-slate-100 max-w-[11rem] truncate">
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
