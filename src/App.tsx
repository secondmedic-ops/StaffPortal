import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { MobileNav } from './components/common/MobileNav';
import { ToastContainer } from './components/common/ToastContainer';

// Employee Components
import { EmployeeDashboard } from './components/employee/EmployeeDashboard';

import { MyAttendance } from './components/employee/MyAttendance';
import { ApplyLeave } from './components/employee/ApplyLeave';
import { MyLeaveRequests } from './components/employee/MyLeaveRequests';
import { CompanyCalendar } from './components/employee/CompanyCalendar';
import { MyKpis } from './components/employee/MyKpis';
import { MyPayslips } from './components/employee/MyPayslips';

// Manager Components
import { TeamDashboard } from './components/manager/TeamDashboard';
import { TeamApprovals } from './components/manager/TeamApprovals';
import { TeamRegularization } from './components/manager/TeamRegularization';
import { TeamCalendar } from './components/manager/TeamCalendar';
import { TeamKpis } from './components/manager/TeamKpis';

// HR Components
import { EmployeeDirectory } from './components/hr/EmployeeDirectory';
import { OrgChart } from './components/hr/OrgChart';
import { AttendanceRegister } from './components/hr/AttendanceRegister';
import { LeavePolicyConfig } from './components/hr/LeavePolicyConfig';
import { HolidayCalendar } from './components/hr/HolidayCalendar';
import { ApplicantTracking } from './components/hr/ApplicantTracking';
import { BenefitsManagement } from './components/hr/BenefitsManagement';
import { DocumentManagement } from './components/hr/DocumentManagement';
import { MobileCapabilitiesView } from './components/hr/MobileCapabilitiesView';
import { SecurityCompliance } from './components/hr/SecurityCompliance';

// Accounts Components
import { PayrollDashboard } from './components/accounts/PayrollDashboard';
import { SalaryStructures } from './components/accounts/SalaryStructures';
import { PayslipGenerator } from './components/accounts/PayslipGenerator';
import { SalaryAccessLogs } from './components/accounts/SalaryAccessLogs';

// CEO Components
import { CeoDashboard } from './components/ceo/CeoDashboard';

// Admin Components
import { UserManagement } from './components/admin/UserManagement';
import { AuditLog } from './components/admin/AuditLog';

import { AlertTriangle, Stethoscope } from 'lucide-react';

const MainPortal: React.FC = () => {
  const {
    currentUser,
    activeNav,
    isManager,
    isHr,
    isAccounts,
    isCeo,
    isAdmin
  } = useAuth();

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
      case 'attendance':
      case 'my-attendance':
        return <MyAttendance />;
      case 'apply-leave':
        return <ApplyLeave />;
      case 'leave-requests':
      case 'my-leaves':
        return <MyLeaveRequests />;
      case 'calendar':
      case 'company-calendar':
        return <CompanyCalendar />;
      case 'kpis':
      case 'my-kpis':
        return <MyKpis />;
      case 'payslips':
      case 'my-payslips':
        return <MyPayslips />;

      // Manager views
      case 'team-dashboard':
        return isManager ? <TeamDashboard /> : <UnauthorizedView role="MANAGER" />;
      case 'team-approvals':
        return isManager ? <TeamApprovals /> : <UnauthorizedView role="MANAGER" />;
      case 'team-regularization':
        return isManager ? <TeamRegularization /> : <UnauthorizedView role="MANAGER" />;
      case 'team-calendar':
        return isManager ? <TeamCalendar /> : <UnauthorizedView role="MANAGER" />;
      case 'team-kpis':
        return isManager ? <TeamKpis /> : <UnauthorizedView role="MANAGER" />;

      // HR views
      case 'hr-directory':
      case 'employee-directory':
        return isHr ? <EmployeeDirectory /> : <UnauthorizedView role="HR" />;
      case 'hr-orgchart':
      case 'org-chart':
        return isHr ? <OrgChart /> : <UnauthorizedView role="HR" />;
      case 'hr-attendance':
      case 'attendance-register':
        return isHr ? <AttendanceRegister /> : <UnauthorizedView role="HR" />;
      case 'hr-leave-policies':
      case 'leave-policies':
        return isHr ? <LeavePolicyConfig /> : <UnauthorizedView role="HR" />;
      case 'hr-holidays':
      case 'holiday-calendar':
        return isHr ? <HolidayCalendar /> : <UnauthorizedView role="HR" />;
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

      // CEO view
      case 'ceo-dashboard':
        return isCeo ? <CeoDashboard /> : <UnauthorizedView role="CEO" />;
      case 'ceo-orgchart':
        return isCeo ? <OrgChart /> : <UnauthorizedView role="CEO" />;
      case 'ceo-calendar':
        return isCeo ? <CompanyCalendar /> : <UnauthorizedView role="CEO" />;

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 antialiased selection:bg-teal-100 selection:text-teal-900 dark:selection:bg-teal-900 dark:selection:text-teal-100 transition-colors">
      {/* Top Bar */}
      <Header />

      {/* App Body with fixed sidebar and scrollable content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6 focus:outline-none bg-slate-50 dark:bg-slate-950 transition-colors">
          {renderContent()}
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNav />

      {/* Global Toast System */}
      <ToastContainer />
    </div>
  );
};

const UnauthorizedView: React.FC<{ role: string }> = ({ role }) => (
  <div className="p-12 text-center max-w-lg mx-auto space-y-4">
    <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center mx-auto">
      <AlertTriangle className="w-6 h-6" />
    </div>
    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
      Your account does not possess the <strong>{role}</strong> entitlement.
      In accordance with SecondMedic zero-trust security separation, this module requires explicit authorization.
    </p>
    <p className="text-[11px] text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 p-2.5 rounded-lg border border-teal-200 dark:border-teal-800">
      Tip: You can switch to an authorized staff role using the persona selector in the top right header.
    </p>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <MainPortal />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
