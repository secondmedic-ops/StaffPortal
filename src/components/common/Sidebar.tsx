import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, LogOut, Moon } from 'lucide-react';
import { BrandMark } from './BrandMark';

export { BrandMark };
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { usePendingCounts } from '../../context/PendingCountsContext';
import { buildNavGroups, findNav, groupBadgeTotal, NavGroup } from '../../config/navigation';

/** Navigation groups for the signed-in person, shared by the sidebar, mobile menu and header. */
export function useNavGroups(): NavGroup[] {
  const { isManager, isHr, isAccounts, isIt, isCeo, isAdmin } = useAuth();
  const { counts } = usePendingCounts();
  return useMemo(
    () => buildNavGroups({ isManager, isHr, isAccounts, isIt, isCeo, isAdmin }, counts),
    [isManager, isHr, isAccounts, isIt, isCeo, isAdmin, counts]
  );
}

interface NavListProps {
  groups: NavGroup[];
  onNavigate?: () => void;
}

/** Collapsible workspace groups; the group holding the current page stays open. */
export const NavList: React.FC<NavListProps> = ({ groups, onNavigate }) => {
  const { activeNav, setActiveNav } = useAuth();
  const current = findNav(groups, activeNav)?.group.id ?? 'me';
  const [open, setOpen] = useState<Record<string, boolean>>({ [current]: true });

  useEffect(() => {
    setOpen(prev => (prev[current] ? prev : { ...prev, [current]: true }));
  }, [current]);

  const single = groups.length === 1;

  return (
    <nav aria-label="Main" className="space-y-0.5">
      {groups.map(group => {
        const isOpen = single || open[group.id];
        const pending = groupBadgeTotal(group);
        return (
          <div key={group.id}>
            {!single && (
              <button
                type="button"
                onClick={() => setOpen(prev => ({ ...prev, [group.id]: !isOpen }))}
                aria-expanded={isOpen}
                className={`w-full flex items-center gap-2 rounded-lg px-3 pt-3 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  group.id === current
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <span className="flex-1 text-left">{group.label}</span>
                {!isOpen && pending > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold leading-[17px] text-white tabular normal-case tracking-normal">
                    {pending}
                  </span>
                )}
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                  aria-hidden
                />
              </button>
            )}
            {isOpen && (
              <ul className="space-y-1 pb-1">
                {group.items.map(item => {
                  const active = activeNav === item.id || (item.id === 'dashboard' && activeNav === 'employee-dashboard');
                  const Icon = item.icon;
                  return (
                    <li key={`${group.id}-${item.id}`}>
                      <button
                        type="button"
                        data-nav={item.id}
                        onClick={() => {
                          setActiveNav(item.id);
                          onNavigate?.();
                        }}
                        aria-current={active ? 'page' : undefined}
                        className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-all ${
                          active
                            ? 'bg-teal-600 text-white font-medium shadow-primary'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon
                          className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`}
                          aria-hidden
                        />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span
                            className={`rounded-full px-1.5 text-[11.5px] font-semibold leading-[18px] tabular ${
                              active ? 'bg-white text-teal-700' : 'bg-rose-500 text-white'
                            }`}
                            aria-label={`${item.badge} pending`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
};

/** Dark mode switch and sign out, pinned under the navigation. */
export const NavFooter: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const { logout } = useAuth();
  return (
    <div className="border-t border-slate-200/80 dark:border-slate-800 px-3 py-3 space-y-1">
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={toggleTheme}
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Moon className="h-[18px] w-[18px] text-slate-400" aria-hidden />
        <span className="flex-1 text-left">Dark mode</span>
        <span
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            isDark ? 'bg-teal-600' : 'bg-slate-200'
          }`}
          aria-hidden
        >
          <span
            className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
              isDark ? 'translate-x-[23px]' : 'translate-x-[3px]'
            }`}
          />
        </span>
      </button>
      <button
        type="button"
        onClick={logout}
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
      >
        <LogOut className="h-[18px] w-[18px] text-slate-400" aria-hidden />
        <span className="flex-1 text-left">Sign out</span>
      </button>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const groups = useNavGroups();

  return (
    <aside className="hidden md:flex md:w-64 lg:w-[268px] shrink-0 flex-col bg-white dark:bg-slate-900 border-r border-slate-200/70 dark:border-slate-800 h-screen sticky top-0 select-none">
      <div className="h-[72px] flex items-center px-6">
        <BrandMark />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pt-2 pb-4">
        <NavList groups={groups} />
      </div>

      <NavFooter />
    </aside>
  );
};
