import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { Bell, LogOut, Stethoscope } from 'lucide-react';

export const Header: React.FC = () => {
  const { currentUser, roles, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  if (!currentUser) return null;

  const initials = currentUser.fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const primaryRole = roles.find(r => r !== 'EMPLOYEE') || 'EMPLOYEE';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 shadow-xs transition-colors">
      {/* Left side: Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 dark:bg-teal-600 text-white shadow-xs">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">SecondMedic</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
              Staff Portal
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">Clinical & Corporate Operations</p>
        </div>
      </div>

      {/* Center/Right: Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Global Theme Toggle Button */}
        <ThemeToggle />

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-teal-600 ring-2 ring-white dark:ring-slate-900" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg bg-white dark:bg-slate-900 p-3 shadow-xl border border-slate-200 dark:border-slate-800 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Notifications</span>
                <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium cursor-pointer">Mark all read</span>
              </div>
              <div className="py-2 space-y-2 max-h-60 overflow-y-auto">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <p className="font-medium text-slate-800 dark:text-slate-200">August 2026 Payslip Available</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Published by Accounts. View in My Payslips.</p>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <p className="font-medium text-slate-800 dark:text-slate-200">Q2 FY26-27 KPI Cycle Open</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Self-reviews due by 25 Sep 2026.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User profile & Role Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-semibold text-xs ring-1 ring-teal-300 dark:ring-teal-700">
            {initials}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">{currentUser.fullName}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight flex items-center gap-1 mt-0.5">
              <span>{currentUser.designation}</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="font-medium text-teal-700 dark:text-teal-400">{primaryRole}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors ml-1"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

