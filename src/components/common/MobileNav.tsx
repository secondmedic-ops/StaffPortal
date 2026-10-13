import React, { useEffect } from 'react';
import { LayoutDashboard, CalendarCheck, CalendarPlus, FileText, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandMark, NavList, useNavGroups } from './Sidebar';

const QUICK = [
  { id: 'dashboard', label: 'Today', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'apply-leave', label: 'Leave', icon: CalendarPlus },
  { id: 'payslips', label: 'Payslips', icon: FileText }
];

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ open, onOpenChange }) => {
  const { activeNav, setActiveNav } = useAuth();
  const groups = useNavGroups();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange]);

  return (
    <>
      <nav
        aria-label="Quick links"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5">
          {QUICK.map(({ id, label, icon: Icon }) => {
            const active = activeNav === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveNav(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 min-h-[56px] text-[12.5px] font-medium ${
                  active ? 'text-teal-700 dark:text-teal-300' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className="flex flex-col items-center gap-0.5 py-2 min-h-[56px] text-[12.5px] font-medium text-slate-500 dark:text-slate-400"
          >
            <Menu className="h-5 w-5" aria-hidden />
            More
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-ink/60"
            aria-label="Close menu"
            onClick={() => onOpenChange(false)}
          />
          <div className="relative w-[85%] max-w-xs h-full bg-ink text-slate-200 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-4 pb-4">
              <BrandMark />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-lg text-slate-300 hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              <NavList groups={groups} onNavigate={() => onOpenChange(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
