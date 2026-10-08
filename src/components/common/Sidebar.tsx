import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Calendar,
  Award,
  FileText,
  Users,
  CheckSquare,
  BarChart3,
  GitFork,
  Briefcase,
  Settings,
  ShieldCheck,
  DollarSign,
  UploadCloud,
  FileSpreadsheet,
  Lock,
  ListOrdered,
  HeartHandshake,
  FolderOpen,
  Smartphone
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
}

export const Sidebar: React.FC = () => {
  const { activeNav, setActiveNav, isManager, isHr, isAccounts, isCeo, isAdmin } = useAuth();

  // 1. Employee items (available to everyone)
  const employeeItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'My Attendance', icon: CalendarCheck },
    { id: 'apply-leave', label: 'Apply Leave', icon: CalendarPlus },
    { id: 'leave-requests', label: 'My Leave', icon: Clock },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'kpis', label: 'My KPIs', icon: Award },
    { id: 'payslips', label: 'My Payslips', icon: FileText }
  ];

  // 2. Manager items
  const managerItems: NavItem[] = [
    { id: 'team-dashboard', label: 'Team Dashboard', icon: Users },
    { id: 'team-approvals', label: 'Pending Approvals', icon: CheckSquare, badge: 2 },
    { id: 'team-calendar', label: 'Team Calendar', icon: Calendar },
    { id: 'team-regularization', label: 'Regularizations', icon: Clock, badge: 1 },
    { id: 'team-kpis', label: 'Team KPI', icon: Award }
  ];

  // 3. HR items
  const hrItems: NavItem[] = [
    { id: 'hr-directory', label: 'Employee Directory', icon: Users },
    { id: 'hr-ats', label: 'Applicant Tracking', icon: Briefcase },
    { id: 'hr-benefits', label: 'Benefits Management', icon: HeartHandshake },
    { id: 'hr-documents', label: 'Document Management', icon: FolderOpen },
    { id: 'hr-orgchart', label: 'Org Chart', icon: GitFork },
    { id: 'hr-attendance', label: 'Attendance Register', icon: FileSpreadsheet },
    { id: 'hr-leave-policies', label: 'Leave Policy Config', icon: Settings },
    { id: 'hr-holidays', label: 'Holiday Calendar', icon: Calendar },
    { id: 'hr-mobile', label: 'Mobile Capabilities', icon: Smartphone }
  ];

  // 4. Accounts items (Payroll module - accessible to Finance & Admin)
  const accountsItems: NavItem[] = [
    { id: 'payroll-dashboard', label: 'Payroll & Tax', icon: DollarSign },
    { id: 'payroll-structures', label: 'Salary Structures', icon: Briefcase },
    { id: 'payroll-generate', label: 'Generate Payslips', icon: FileText },
    { id: 'payroll-upload', label: 'Bulk Payslip Upload', icon: UploadCloud },
    { id: 'payroll-access-log', label: 'Payslip Access Log', icon: ListOrdered }
  ];

  // 5. CEO items (Org-wide overview, NO payroll)
  const ceoItems: NavItem[] = [
    { id: 'ceo-dashboard', label: 'Org-wide Dashboard', icon: BarChart3 },
    { id: 'ceo-orgchart', label: 'Complete Org Chart', icon: GitFork },
    { id: 'ceo-calendar', label: 'All-Staff Calendar', icon: Calendar }
  ];

  // 6. System Admin items (Users, roles, audit log, security)
  const adminItems: NavItem[] = [
    { id: 'admin-users', label: 'User & Role Mgmt', icon: ShieldCheck },
    { id: 'admin-audit', label: 'System Audit Log', icon: Lock },
    { id: 'admin-security', label: 'Security & Compliance', icon: ShieldCheck }
  ];

  const renderSection = (title: string, items: NavItem[], roleBadge?: string) => (
    <div className="mb-5">
      <div className="flex items-center justify-between px-3 mb-1.5">
        <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">{title}</span>
        {roleBadge && (
          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase">
            {roleBadge}
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-teal-700 dark:bg-teal-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-white text-teal-800 dark:bg-teal-100'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 flex-col flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-[calc(100vh-4rem)] overflow-y-auto p-3.5 select-none transition-colors">
      {/* 1. EMPLOYEE SECTION (Everyone) */}
      {renderSection('Employee Services', employeeItems)}

      {/* 2. MANAGER SECTION */}
      {isManager && renderSection('My Team', managerItems, 'Manager')}

      {/* 3. HR SECTION */}
      {isHr && renderSection('People Operations', hrItems, 'HR')}

      {/* 4. ACCOUNTS SECTION */}
      {isAccounts && renderSection('Payroll & Finance', accountsItems, 'Accounts')}

      {/* 5. CEO SECTION */}
      {isCeo && renderSection('Executive Leadership', ceoItems, 'CEO')}

      {/* 6. ADMIN SECTION */}
      {isAdmin && renderSection('System Administration', adminItems, 'Admin')}

      <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 px-2 text-[10px] text-slate-400 dark:text-slate-500">
        <p className="font-semibold text-slate-500 dark:text-slate-400">SecondMedic Health v1.0</p>
        <p>Spring Boot 3.3 • Postgres 16</p>
        <p className="text-teal-700 dark:text-teal-400 font-mono mt-0.5">JWT Memory Auth Active</p>
      </div>
    </aside>
  );
};
