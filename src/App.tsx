import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { MobileNav } from './components/common/MobileNav';
import { ToastContainer } from './components/common/ToastContainer';
import { PendingCountsProvider } from './context/PendingCountsContext';

// Employee Components
import { EmployeeDashboard } from './components/employee/EmployeeDashboard';
import { MyProfile } from './components/employee/MyProfile';
import { GalleryView } from './components/employee/GalleryView';
import { ResignationView } from './components/employee/ResignationView';
import { MyAttendance } from './components/employee/MyAttendance';
import { ApplyLeave } from './components/employee/ApplyLeave';
import { MyLeaveRequests } from './components/employee/MyLeaveRequests';
import { MyKpis } from './components/employee/MyKpis';
import { MyPayslips } from './components/employee/MyPayslips';
import { MyAssets } from './components/employee/MyAssets';
import { HolidayWorkClaims } from './components/employee/HolidayWorkClaims';
import { TeamHolidayWork } from './components/manager/TeamHolidayWork';

// Manager Components
import { TeamDashboard } from './components/manager/TeamDashboard';
import { TeamApprovals } from './components/manager/TeamApprovals';
import { TeamRegularization } from './components/manager/TeamRegularization';
import { TeamCalendar } from './components/manager/TeamCalendar';
import { TeamKpis } from './components/manager/TeamKpis';

// HR & Shared Components
import { MissedSignoutReport } from './components/common/MissedSignoutReport';
import { BirthdayModal } from './components/hr/BirthdayModal';
import { BranchManagement } from './components/hr/BranchManagement';
import { EmailLogView } from './components/hr/EmailLogView';
import { EmployeeDirectory } from './components/hr/EmployeeDirectory';
import { OrgChart } from './components/hr/OrgChart';
import { AttendanceRegister } from './components/hr/AttendanceRegister';
import { LeavePolicyConfig } from './components/hr/LeavePolicyConfig';
import { ApplicantTracking } from './components/hr/ApplicantTracking';
import { BenefitsManagement } from './components/hr/BenefitsManagement';
import { DocumentManagement } from './components/hr/DocumentManagement';
import { MobileCapabilitiesView } from './components/hr/MobileCapabilitiesView';
import { SecurityCompliance } from './components/hr/SecurityCompliance';
import { NewStaffRegistration } from './components/hr/NewStaffRegistration';
import { StaffLifecycle } from './components/hr/StaffLifecycle';

// Accounts Components
import { FnfSettlementView } from './components/accounts/FnfSettlementView';
import { PayrollDashboard } from './components/accounts/PayrollDashboard';
import { SalaryStructures } from './components/accounts/SalaryStructures';
import { PayslipGenerator } from './components/accounts/PayslipGenerator';
import { SalaryAccessLogs } from './components/accounts/SalaryAccessLogs';
import { AttendancePayroll } from './components/accounts/AttendancePayroll';
import { IncrementsRevisions } from './components/accounts/IncrementsRevisions';
import { PayrollApproval } from './components/accounts/PayrollApproval';

// IT Components
import { ItDashboard } from './components/it/ItDashboard';
import { AssetRegister } from './components/it/AssetRegister';
import { ItRequests } from './components/it/ItRequests';

// CEO Components
import { CeoDashboard } from './components/ceo/CeoDashboard';

// Admin Components
import { UserManagement } from './components/admin/UserManagement';
import { AuditLog } from './components/admin/AuditLog';

import { Lock } from 'lucide-react';

const MainPortal: React.FC = () => {
  const {
    currentUser,
    activeNav,
    isManager,
    isHr,
    isAccounts,
    isIt,
    isCeo,
    isDirector,
    isAdmin
  } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeNav]);

  if (!currentUser) {
    return null;
  }

  // Render active view based on activeNav and verify role permissions
  const renderContent = () => {
    switch (activeNav) {
      // Employee self-service
      case 'dashboard':
      case 'employee-dashboard':
        return <EmployeeDashboard />;
      case 'profile':
      case 'my-profile':
        return <MyProfile />;
      case 'attendance':
      case 'my-attendance':
        return <MyAttendance />;
      case 'gallery':
      case 'company-gallery':
        return <GalleryView />;
      case 'resign':
      case 'resignation':
        return <ResignationView />;
      case 'apply-leave':
        return <ApplyLeave />;
      case 'leave-requests':
      case 'my-leaves':
        return <MyLeaveRequests />;
      case 'calendar':
      case 'company-calendar':
        return <MyAttendance />;
      case 'kpis':
      case 'my-kpis':
        return <MyKpis />;
      case 'payslips':
      case 'my-payslips':
        return <MyPayslips />;
      case 'my-assets':
        return <MyAssets />;
      case 'holiday-work':
        return <HolidayWorkClaims />;
      case 'team-holiday-work':
        return isManager || isHr ? <TeamHolidayWork /> : <UnauthorizedView role="MANAGER" />;
      case 'payroll-approval':
        return isCeo ? <PayrollApproval /> : <UnauthorizedView role="CEO" />;

      // Manager views
      case 'team-dashboard':
        return isManager ? <TeamDashboard /> : <UnauthorizedView role="MANAGER" />;
      case 'team-approvals':
        return isManager || isHr ? <TeamApprovals /> : <UnauthorizedView role="MANAGER" />;
      case 'team-regularization':
        return isManager || isHr ? <TeamRegularization /> : <UnauthorizedView role="MANAGER" />;
      case 'team-missed-signouts':
        return isManager || isHr ? <MissedSignoutReport forManager={true} /> : <UnauthorizedView role="MANAGER" />;
      case 'team-calendar':
        return isManager ? <TeamCalendar /> : <UnauthorizedView role="MANAGER" />;
      case 'team-kpis':
        return isManager ? <TeamKpis /> : <UnauthorizedView role="MANAGER" />;

      // HR views
      case 'hr-register':
        return isHr ? <NewStaffRegistration /> : <UnauthorizedView role="HR" />;
      case 'hr-lifecycle':
        return isHr || isIt || isAccounts || isManager ? <StaffLifecycle /> : <UnauthorizedView role="HR" />;
      case 'hr-directory':
      case 'employee-directory':
        return isHr ? <EmployeeDirectory /> : <UnauthorizedView role="HR" />;
      case 'hr-orgchart':
      case 'org-chart':
        return isHr ? <OrgChart /> : <UnauthorizedView role="HR" />;
      case 'hr-attendance':
      case 'attendance-register':
        return isHr ? <AttendanceRegister /> : <UnauthorizedView role="HR" />;
      case 'hr-missed-signouts':
        return isHr ? <MissedSignoutReport forManager={false} /> : <UnauthorizedView role="HR" />;
      case 'hr-branches':
      case 'branches':
        return isHr ? <BranchManagement /> : <UnauthorizedView role="HR" />;
      case 'hr-email-log':
      case 'email-log':
        return isHr ? <EmailLogView /> : <UnauthorizedView role="HR" />;
      case 'hr-leave-policies':
      case 'leave-policies':
        return isHr ? <LeavePolicyConfig /> : <UnauthorizedView role="HR" />;
      case 'hr-holidays':
      case 'holiday-calendar':
        return isHr ? <AttendanceRegister /> : <UnauthorizedView role="HR" />;
      case 'hr-ats':
      case 'applicant-tracking':
        return isHr ? <ApplicantTracking /> : <UnauthorizedView role="HR" />;
      case 'hr-benefits':
      case 'benefits-management':
        return isHr ? <BenefitsManagement /> : <UnauthorizedView role="HR" />;
      case 'hr-documents':
      case 'document-management':
        return isHr ? <DocumentManagement /> : <UnauthorizedView role="HR" />;
      case 'hr-mobile':
      case 'mobile-capabilities':
        return isHr ? <MobileCapabilitiesView /> : <UnauthorizedView role="HR" />;

      // Accounts views (Confidential)
      case 'payroll-attendance':
        return isAccounts ? <AttendancePayroll /> : <UnauthorizedView role="ACCOUNTS" />;
      case 'fnf-settlements':
        return isAccounts ? <FnfSettlementView /> : <UnauthorizedView role="ACCOUNTS" />;
      case 'payroll-increments':
        return isAccounts || isCeo ? <IncrementsRevisions /> : <UnauthorizedView role="ACCOUNTS" />;
      case 'payroll-dashboard':
        return isAccounts ? <PayrollDashboard /> : <UnauthorizedView role="ACCOUNTS" />;
      case 'payroll-structures':
      case 'salary-structures':
        return isAccounts ? <SalaryStructures /> : <UnauthorizedView role="ACCOUNTS" />;
      case 'payroll-generate':
      case 'payslip-generator':
        return isAccounts ? <PayslipGenerator /> : <UnauthorizedView role="ACCOUNTS" />;
      case 'payroll-upload':
        return isAccounts ? <PayslipGenerator /> : <UnauthorizedView role="ACCOUNTS" />;
      case 'payroll-access-log':
      case 'salary-access-logs':
        return isAccounts ? <SalaryAccessLogs /> : <UnauthorizedView role="ACCOUNTS" />;

      // IT views
      case 'it-dashboard':
        return isIt ? <ItDashboard /> : <UnauthorizedView role="IT" />;
      case 'it-assets':
        return isIt ? <AssetRegister /> : <UnauthorizedView role="IT" />;
      case 'it-requests':
        return isIt ? <ItRequests /> : <UnauthorizedView role="IT" />;

      // CEO & Leadership views
      case 'ceo-dashboard':
        return isCeo || isDirector ? <CeoDashboard /> : <UnauthorizedView role="CEO" />;
      case 'ceo-fnf-approvals':
        return isCeo || isDirector ? <FnfSettlementView isCeoView={true} /> : <UnauthorizedView role="CEO" />;
      case 'ceo-orgchart':
        return isCeo || isDirector ? <OrgChart /> : <UnauthorizedView role="CEO" />;
      case 'ceo-calendar':
        return isCeo || isDirector ? <MyAttendance /> : <UnauthorizedView role="CEO" />;

      // Admin views
      case 'admin-users':
      case 'user-management':
        return isAdmin ? <UserManagement /> : <UnauthorizedView role="SYSTEM_ADMIN" />;
      case 'admin-audit':
      case 'audit-log':
        return isAdmin ? <AuditLog /> : <UnauthorizedView role="SYSTEM_ADMIN" />;
      case 'admin-security':
      case 'security-compliance':
        return isAdmin ? <SecurityCompliance /> : <UnauthorizedView role="SYSTEM_ADMIN" />;

      default:
        return <EmployeeDashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 pb-24 md:pb-10 focus:outline-none" key={activeNav}>
          {renderContent()}
        </main>
      </div>

      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />
      <ToastContainer />
      <BirthdayModal />
    </div>
  );
};

const ROLE_NAMES: Record<string, string> = {
  MANAGER: 'Manager',
  HR: 'HR',
  ACCOUNTS: 'Accounts',
  IT: 'IT',
  CEO: 'CEO',
  DIRECTOR: 'Director',
  SYSTEM_ADMIN: 'System admin'
};

const UnauthorizedView: React.FC<{ role: string }> = ({ role }) => (
  <div className="px-6 py-20 text-center max-w-md mx-auto">
    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
      <Lock className="w-5 h-5" />
    </div>
    <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">This page needs the {ROLE_NAMES[role] ?? role} role</h2>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
      Ask HR or a system admin to add the role to your account, then sign in again.
    </p>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PendingCountsProvider>
            <MainPortal />
          </PendingCountsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
