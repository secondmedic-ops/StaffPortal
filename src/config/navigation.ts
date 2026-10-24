import type React from 'react';
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
  Smartphone,
  Laptop,
  LifeBuoy,
  UserPlus,
  ClipboardCheck,
  Calculator,
  TrendingUp,
  MonitorSmartphone,
  CalendarHeart,
  BadgeCheck,
  UserRound,
  UsersRound,
  Contact,
  Wallet,
  Cpu,
  Building2,
  KeyRound
} from 'lucide-react';
import type { PendingCounts } from '../context/PendingCountsContext';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

export interface NavAccess {
  isManager: boolean;
  isHr: boolean;
  isAccounts: boolean;
  isIt: boolean;
  isCeo: boolean;
  isDirector: boolean;
  isAdmin: boolean;
}

const n = (v: number | undefined) => (v && v > 0 ? v : undefined);

/** Every workspace the signed-in person can open, in sidebar order. */
export function buildNavGroups(a: NavAccess, c: PendingCounts): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: 'me',
      label: 'My workspace',
      icon: UserRound,
      items: [
        { id: 'dashboard', label: 'Today', icon: LayoutDashboard },
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
        { id: 'apply-leave', label: 'Apply for leave', icon: CalendarPlus },
        { id: 'leave-requests', label: 'My leave', icon: Clock },
        { id: 'holiday-work', label: 'Comp-off & overtime', icon: CalendarHeart },
        { id: 'payslips', label: 'Payslips', icon: FileText },
        { id: 'my-assets', label: 'Assets & IT help', icon: Laptop, badge: n(c.myUnacknowledgedAssets) },
        { id: 'kpis', label: 'Goals & KPIs', icon: Award },
        { id: 'calendar', label: 'Holiday calendar', icon: Calendar }
      ]
    }
  ];

  if (a.isManager) {
    groups.push({
      id: 'team',
      label: 'My team',
      icon: UsersRound,
      items: [
        { id: 'team-dashboard', label: 'Team overview', icon: Users },
        { id: 'team-approvals', label: 'Leave approvals', icon: CheckSquare, badge: n(c.leaveApprovals) },
        { id: 'team-regularization', label: 'Time updates', icon: Clock, badge: n(c.regularizations) },
        { id: 'team-holiday-work', label: 'Comp-off & OT claims', icon: CalendarHeart, badge: n(c.holidayWorkClaims) },
        { id: 'team-calendar', label: 'Team calendar', icon: Calendar },
        { id: 'team-kpis', label: 'Team KPIs', icon: Award }
      ]
    });
  }

  if (a.isHr) {
    groups.push({
      id: 'hr',
      label: 'People',
      icon: Contact,
      items: [
        { id: 'hr-register', label: 'Register new staff', icon: UserPlus },
        { id: 'hr-lifecycle', label: 'Onboarding & exit', icon: ClipboardCheck, badge: n(c.myLifecycleTasks) },
        ...(!a.isManager
          ? [
              { id: 'team-approvals', label: 'HR leave queue', icon: CheckSquare, badge: n(c.leaveApprovals) },
              { id: 'team-regularization', label: 'HR time updates', icon: Clock, badge: n(c.regularizations) },
              { id: 'team-holiday-work', label: 'Comp-off & OT claims', icon: CalendarHeart, badge: n(c.holidayWorkClaims) }
            ]
          : []),
        { id: 'hr-directory', label: 'Staff directory', icon: Users },
        { id: 'hr-orgchart', label: 'Org chart', icon: GitFork },
        { id: 'hr-attendance', label: 'Attendance register', icon: FileSpreadsheet },
        { id: 'hr-holidays', label: 'Holiday calendar', icon: Calendar },
        { id: 'hr-leave-policies', label: 'Leave policy', icon: Settings },
        { id: 'hr-ats', label: 'Hiring pipeline', icon: Briefcase },
        { id: 'hr-benefits', label: 'Benefits', icon: HeartHandshake },
        { id: 'hr-documents', label: 'Documents', icon: FolderOpen },
        { id: 'hr-mobile', label: 'Mobile app', icon: Smartphone }
      ]
    });
  }

  if (a.isAccounts) {
    groups.push({
      id: 'payroll',
      label: 'Payroll',
      icon: Wallet,
      items: [
        { id: 'payroll-attendance', label: 'Run payroll', icon: Calculator },
        { id: 'payroll-increments', label: 'Increments & revisions', icon: TrendingUp, badge: n(c.salaryRevisions) },
        ...(!a.isHr
          ? [{ id: 'hr-lifecycle', label: 'Joiner & exit tasks', icon: ClipboardCheck, badge: n(c.myLifecycleTasks) }]
          : []),
        { id: 'payroll-dashboard', label: 'Payroll & tax', icon: DollarSign },
        { id: 'payroll-structures', label: 'Salary structures', icon: Briefcase },
        { id: 'payroll-generate', label: 'Generate payslips', icon: FileText },
        { id: 'payroll-upload', label: 'Bulk payslip upload', icon: UploadCloud },
        { id: 'payroll-access-log', label: 'Payslip access log', icon: ListOrdered }
      ]
    });
  }

  if (a.isIt) {
    groups.push({
      id: 'it',
      label: 'IT',
      icon: Cpu,
      items: [
        { id: 'it-dashboard', label: 'IT overview', icon: MonitorSmartphone },
        { id: 'it-assets', label: 'Asset register', icon: Laptop },
        { id: 'it-requests', label: 'Service desk', icon: LifeBuoy, badge: n(c.itRequests) },
        ...(!a.isHr && !a.isAccounts
          ? [{ id: 'hr-lifecycle', label: 'Joiner & exit tasks', icon: ClipboardCheck, badge: n(c.myLifecycleTasks) }]
          : [])
      ]
    });
  }

  if (a.isCeo) {
    groups.push({
      id: 'leadership',
      label: 'Leadership',
      icon: Building2,
      items: [
        { id: 'ceo-dashboard', label: 'Organisation overview', icon: BarChart3 },
        ...(!a.isAccounts
          ? [{ id: 'payroll-increments', label: 'Salary approvals', icon: TrendingUp, badge: n(c.salaryRevisions) }]
          : []),
        ...(c.payrollApprovals > 0
          ? [{ id: 'payroll-approval', label: 'Payroll approval', icon: BadgeCheck, badge: n(c.payrollApprovals) }]
          : []),
        { id: 'ceo-orgchart', label: 'Full org chart', icon: GitFork },
        { id: 'ceo-calendar', label: 'All-staff calendar', icon: Calendar }
      ]
    });
  } else if (a.isDirector) {
    groups.push({
      id: 'leadership',
      label: 'Leadership',
      icon: Building2,
      items: [
        { id: 'ceo-dashboard', label: 'Organisation overview', icon: BarChart3 },
        { id: 'ceo-orgchart', label: 'Full org chart', icon: GitFork },
        { id: 'ceo-calendar', label: 'All-staff calendar', icon: Calendar }
      ]
    });
  }

  if (a.isAdmin) {
    groups.push({
      id: 'admin',
      label: 'Administration',
      icon: KeyRound,
      items: [
        { id: 'admin-users', label: 'Users & roles', icon: ShieldCheck },
        { id: 'admin-audit', label: 'Audit log', icon: Lock },
        { id: 'admin-security', label: 'Security & compliance', icon: ShieldCheck }
      ]
    });
  }

  return groups;
}

/** The group that owns a nav id (first match wins, as in the sidebar). */
export function findNav(groups: NavGroup[], navId: string): { group: NavGroup; item: NavItem } | null {
  const id = navId === 'employee-dashboard' ? 'dashboard' : navId;
  for (const group of groups) {
    const item = group.items.find(i => i.id === id);
    if (item) return { group, item };
  }
  return null;
}

export const groupBadgeTotal = (g: NavGroup) => g.items.reduce((s, i) => s + (i.badge ?? 0), 0);
