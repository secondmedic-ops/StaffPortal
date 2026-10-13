import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarPlus,
  Menu,
  X,
  FileText
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { activeNav, setActiveNav, isManager, isAccounts, isHr, isIt, isCeo, isAdmin } = useAuth();
  const [showDrawer, setShowDrawer] = useState(false);

  const sections: Array<{ title: string; show: boolean; items: Array<[string, string]> }> = [
    {
      title: 'Employee',
      show: true,
      items: [
        ['leave-requests', 'My Leave Requests'],
        ['calendar', 'Holidays & Team Calendar'],
        ['kpis', 'My KPIs'],
        ['my-assets', 'My Assets & IT Help']
      ]
    },
    {
      title: 'Manager',
      show: isManager,
      items: [
        ['team-dashboard', 'Team Dashboard'],
        ['team-approvals', 'Leave Approvals'],
        ['team-regularization', 'Regularizations'],
        ['team-calendar', 'Team Calendar']
      ]
    },
    {
      title: 'HR',
      show: isHr,
      items: [
        ['hr-register', 'Register New Staff'],
        ['hr-lifecycle', 'Onboarding & Exit'],
        ['hr-directory', 'Employee Directory'],
        ['hr-orgchart', 'Org Chart'],
        ['hr-attendance', 'Attendance Register & Lock'],
        ['hr-holidays', 'Holiday Calendar']
      ]
    },
    {
      title: 'Accounts & Payroll',
      show: isAccounts,
      items: [
        ['payroll-attendance', 'Attendance Payroll'],
        ['payroll-increments', 'Increments & Revisions'],
        ['payroll-dashboard', 'Payroll Dashboard'],
        ['payroll-structures', 'Salary Structures']
      ]
    },
    {
      title: 'IT',
      show: isIt,
      items: [
        ['it-dashboard', 'IT Overview'],
        ['it-assets', 'Asset Register'],
        ['it-requests', 'Service Desk']
      ]
    },
    {
      title: 'CEO',
      show: isCeo,
      items: [
        ['ceo-dashboard', 'Org-wide Overview'],
        ['payroll-increments', 'Salary Approvals']
      ]
    },
    { title: 'Admin', show: isAdmin, items: [['admin-users', 'User & Role Management']] }
  ];

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg transition-colors">
        <button
          onClick={() => setActiveNav('dashboard')}
          className={`flex flex-col items-center py-1 px-2 rounded text-[10px] font-medium transition-colors ${
            activeNav === 'dashboard'
              ? 'text-teal-700 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveNav('attendance')}
          className={`flex flex-col items-center py-1 px-2 rounded text-[10px] font-medium transition-colors ${
            activeNav === 'attendance'
              ? 'text-teal-700 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <CalendarCheck className="w-5 h-5 mb-0.5" />
          <span>Attendance</span>
        </button>

        <button
          onClick={() => setActiveNav('apply-leave')}
          className={`flex flex-col items-center py-1 px-2 rounded text-[10px] font-medium transition-colors ${
            activeNav === 'apply-leave'
              ? 'text-teal-700 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <CalendarPlus className="w-5 h-5 mb-0.5" />
          <span>Apply</span>
        </button>

        <button
          onClick={() => setActiveNav('payslips')}
          className={`flex flex-col items-center py-1 px-2 rounded text-[10px] font-medium transition-colors ${
            activeNav === 'payslips'
              ? 'text-teal-700 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span>Payslips</span>
        </button>

        <button
          onClick={() => setShowDrawer(true)}
          className="flex flex-col items-center py-1 px-2 rounded text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile Drawer Menu */}
      {showDrawer && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="w-4/5 max-w-xs bg-white dark:bg-slate-900 h-full p-4 overflow-y-auto shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">All Modules</span>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Theme Toggle in Mobile Drawer */}
            <div className="pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Appearance
              </div>
              <ThemeToggle variant="labeled" />
            </div>

            <div className="py-3 space-y-4 text-xs">
              {sections
                .filter(sec => sec.show)
                .map(sec => (
                  <div key={sec.title}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{sec.title}</div>
                    <div className="space-y-1">
                      {sec.items.map(([id, label]) => (
                        <button
                          key={id + label}
                          onClick={() => {
                            setActiveNav(id);
                            setShowDrawer(false);
                          }}
                          className={`w-full text-left py-1.5 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            activeNav === id ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
