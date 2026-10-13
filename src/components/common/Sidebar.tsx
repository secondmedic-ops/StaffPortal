import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BrandMark } from './BrandMark';

export { BrandMark };
import { useAuth } from '../../context/AuthContext';
import { usePendingCounts } from '../../context/PendingCountsContext';
import { buildNavGroups, findNav, groupBadgeTotal, NavGroup } from '../../config/navigation';
import { SHIFT_POLICY } from '../../config/policy';

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
    <nav aria-label="Main" className="space-y-1">
      {groups.map(group => {
        const isOpen = single || open[group.id];
        const pending = groupBadgeTotal(group);
        const GroupIcon = group.icon;
        return (
          <div key={group.id}>
            {!single && (
              <button
                type="button"
                onClick={() => setOpen(prev => ({ ...prev, [group.id]: !isOpen }))}
                aria-expanded={isOpen}
                className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold transition-colors ${
                  group.id === current ? 'text-white' : 'text-slate-300 hover:text-white'
                } hover:bg-white/5`}
              >
                <GroupIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="flex-1 text-left">{group.label}</span>
                {!isOpen && pending > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 text-[11.5px] font-bold text-ink tabular">{pending}</span>
                )}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                  aria-hidden
                />
              </button>
            )}
            {isOpen && (
              <ul className={`${single ? '' : 'mt-0.5 mb-2 ml-[18px] border-l border-ink-line pl-2'} space-y-px`}>
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
                        className={`group w-full flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] transition-colors ${
                          active
                            ? 'bg-teal-500/15 text-white font-semibold shadow-[inset_2px_0_0_var(--color-teal-300)]'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${active ? 'text-teal-300' : 'text-slate-400 group-hover:text-slate-200'}`}
                          aria-hidden
                        />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span
                            className="rounded-full bg-amber-400 px-1.5 text-[11.5px] font-bold leading-[18px] text-ink tabular"
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

export const Sidebar: React.FC = () => {
  const groups = useNavGroups();
  const { currentUser } = useAuth();

  return (
    <aside className="hidden md:flex md:w-64 lg:w-[268px] shrink-0 flex-col bg-ink text-slate-200 h-screen sticky top-0 select-none">
      <div className="px-4 pt-4 pb-5">
        <BrandMark />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4">
        <NavList groups={groups} />
      </div>

      {currentUser && (
        <div className="border-t border-ink-line px-4 py-3 text-[12.5px] leading-snug text-slate-400">
          <div className="font-medium text-slate-200 truncate">{currentUser.departmentName || 'SecondMedic'}</div>
          <div className="truncate">Shift {SHIFT_POLICY.startTime} to {SHIFT_POLICY.endTime}</div>
        </div>
      )}
    </aside>
  );
};
