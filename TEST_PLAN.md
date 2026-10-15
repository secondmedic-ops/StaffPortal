# SecondMedic Staff Portal — Test Plan & Architecture Map

## 1. Application Architecture

- **Hosting & Infrastructure:** Cloudflare Worker / Cloudflare Pages with Static Assets SPA routing (`not_found_handling = "single-page-application"`).
- **Frontend Stack:** React 19, TypeScript 5.8, Vite 6.4, Tailwind CSS 4, Lucide Icons, Motion, Recharts.
- **Backend / Database:** Supabase (PostgreSQL with Row Level Security, PostgREST API, Supabase Auth, Storage).
- **Timezone Standard:** Indian Standard Time (IST, UTC+5:30, `Asia/Kolkata`).

---

## 2. User Roles & Personas

| Role Name | Internal Code | Test Account / Persona Email | Access Scope |
|-----------|---------------|------------------------------|--------------|
| **Master Administrator** | `SYSTEM_ADMIN` | `admin@secondmedic.com` | Full administrative control, all modules, user roles, audit logs, payroll, HR, IT |
| **Chief Executive Officer** | `CEO` | `sunita.patil@secondmedic.com` | Executive dashboard, organization chart, company calendar, payroll approval & increments |
| **Head of Human Resources** | `HR` | `anita.roy@secondmedic.com` | People workspace, staff registration, lifecycle (onboarding/exit), directory, policies, holidays, attendance register, ATS, benefits, documents |
| **Accounts Lead** | `ACCOUNTS` | `vikram.malhotra@secondmedic.com` | Payroll workspace, run attendance-based payroll, salary structures, payslip generator, increments & revisions, access logs |
| **IT Lead / Systems Architect** | `IT` | `amit.verma@secondmedic.com` | IT workspace, asset register, hardware/software requests, lifecycle IT tasks |
| **Reporting Manager / Team Lead** | `MANAGER` | (Any user with direct reports > 0, e.g. Anita Roy, Vikram Malhotra) | Team overview, leave approvals (L1/L2), attendance regularization, comp-off/OT claims, team calendar, team KPIs |
| **Staff Doctor / Employee** | `EMPLOYEE` | `rahul.sharma@secondmedic.com` | Self-service workspace: Today dashboard, punch in/out, attendance records, apply for leave, my leaves, comp-off & OT claims, payslips, assets, goals & KPIs, holiday calendar |

---

## 3. Route & View Inventory

All routes are served as SPA paths and mapped to the internal `activeNav` state:

### A. Employee Self-Service Workspace (`me`)
- `/` or `/dashboard` — **Today Dashboard** (`EmployeeDashboard`): Live attendance punch widget (with GPS if enabled), shift countdown, month working summary, today status, leave balance cards, announcement feeds.
- `/attendance` or `/my-attendance` — **My Attendance** (`MyAttendance`): Monthly attendance grid, shift times, late marks, LOP breakdown, regularize missing/late punches modal.
- `/apply-leave` — **Apply for Leave** (`ApplyLeave`): Leave request application form, balance calculation, sandwich rule evaluation, single/multi/half-day pickers, medical certificate attachment, approver preview.
- `/leave-requests` or `/my-leaves` — **My Leave Requests** (`MyLeaveRequests`): Active and historical leave requests, approval workflow timeline tracker, cancel/withdraw pending request.
- `/holiday-work` — **Comp-Off & Overtime** (`HolidayWorkClaims`): Claim overtime pay or compensatory off for working on Sundays and official holidays.
- `/payslips` or `/my-payslips` — **My Payslips** (`MyPayslips`): Confidential monthly payslips, detailed earnings/deductions breakdown, printable payslip view.
- `/my-assets` — **Assets & IT Help** (`MyAssets`): Assigned IT hardware/software inventory, asset acknowledgment, report hardware issue / raise ticket.
- `/kpis` or `/my-kpis` — **Goals & KPIs** (`MyKpis`): Quarterly performance goals, self-assessment rating and actuals submission.
- `/calendar` or `/company-calendar` — **Holiday Calendar** (`CompanyCalendar`): Organization holiday schedule and team availability overview with peer privacy.

### B. Manager / Team Lead Workspace (`team`)
- `/team-dashboard` — **Team Overview** (`TeamDashboard`): Team attendance status today, direct reports count, who is out today.
- `/team-approvals` — **Leave Approvals** (`TeamApprovals`): L1/L2 leave approval queue, overlap conflict warnings, approve/reject with mandatory remarks.
- `/team-regularization` — **Time Updates / Regularizations** (`TeamRegularization`): Review punch regularization requests from direct reports.
- `/team-holiday-work` — **Comp-Off & OT Approvals** (`TeamHolidayWork`): Approve Sunday/holiday work claims.
- `/payroll-approval` — **Manager Payroll Approval** (`PayrollApproval`): Review and approve monthly draft payroll for reporting line.
- `/team-calendar` — **Team Roster & Calendar** (`TeamCalendar`): Team shift schedule and planned leaves calendar.
- `/team-kpis` — **Team KPIs & Appraisals** (`TeamKpis`): Define quarterly goals and submit manager evaluation ratings.

### C. Human Resources Workspace (`hr`)
- `/hr-register` — **Register New Staff** (`NewStaffRegistration`): Onboard new employees, profile, work email, department, designation, salary assignment.
- `/hr-lifecycle` — **Staff Lifecycle** (`StaffLifecycle`): Onboarding and exit checklists and task delegation (IT, HR, Accounts).
- `/hr-directory` — **Staff Directory** (`EmployeeDirectory`): Searchable company directory with contact details and department filtering.
- `/hr-orgchart` — **Org Chart** (`OrgChart`): Interactive organizational reporting hierarchy tree.
- `/hr-attendance` — **Attendance Register** (`AttendanceRegister`): Organization-wide monthly attendance matrix, late count, LOP calculation.
- `/hr-holidays` — **Holiday Configuration** (`HolidayCalendar`): Gazetted and optional holidays management.
- `/hr-leave-policies` — **Leave Policies** (`LeavePolicyConfig`): Leave quota policies, carry-forward caps, sandwich rules.
- `/hr-ats` — **Hiring Pipeline** (`ApplicantTracking`): Recruitment job openings and candidate pipeline.
- `/hr-benefits` — **Benefits Management** (`BenefitsManagement`): Employee health insurance, wellness perks, and benefits.
- `/hr-documents` — **Document Management** (`DocumentManagement`): Company policy documents, templates, contracts.
- `/hr-mobile` — **Mobile App Capabilities** (`MobileCapabilitiesView`): Mobile feature permissions, geofencing, field staff settings.

### D. Accounts Workspace (Confidential Payroll) (`payroll`)
- `/payroll-attendance` — **Run Payroll** (`AttendancePayroll`): End-to-end attendance-based payroll engine computation, gross pay proration, PF/ESI/PT deduction caps, arrears, advances, lock payroll.
- `/payroll-increments` — **Increments & Revisions** (`IncrementsRevisions`): Propose and approve salary revisions (maker-checker rule).
- `/payroll-dashboard` — **Payroll & Tax Dashboard** (`PayrollDashboard`): Annual payroll disbursements, tax projections, statutory reports.
- `/payroll-structures` — **Salary Structures** (`SalaryStructures`): CTC breakdown configurations (Basic, HRA, Special Allowance).
- `/payroll-generate` — **Generate Payslips** (`PayslipGenerator`): Monthly payslip generation and publishing.
- `/payroll-upload` — **Bulk Payslip Upload** (`PayslipGenerator`): Upload pre-computed payslips.
- `/payroll-access-log` — **Salary Access Logs** (`SalaryAccessLogs`): Audit trail of salary viewing and modifications.

### E. IT Operations Workspace (`it`)
- `/it-dashboard` — **IT Operations** (`ItDashboard`): Hardware health, open tickets, asset allocation metrics.
- `/it-assets` — **Asset Register** (`AssetRegister`): Full IT hardware inventory, serial numbers, allocation history.
- `/it-requests` — **IT Help Desk** (`ItRequests`): Internal helpdesk ticketing for equipment, software licenses, access cards.

### F. Executive / CEO Workspace (`ceo`)
- `/ceo-dashboard` — **Executive Dashboard** (`CeoDashboard`): High-level company health, headcount, payroll expenditure, attendance rate.

### G. System Admin Workspace (`admin`)
- `/admin-users` — **User Management** (`UserManagement`): Employee role assignments, access permissions, account activations.
- `/admin-audit` — **System Audit Log** (`AuditLog`): Immutable audit logging of administrative and financial operations.
- `/admin-security` — **Security & Compliance** (`SecurityCompliance`): Security policies, session configurations, encryption status.

---

## 4. API Endpoints & Supabase PostgREST Schema

| API Module | Functions | Database Tables / RPC Involved | Access Roles |
|------------|-----------|--------------------------------|--------------|
| `session.ts` | `getSessionEmployee`, `logAudit` | `employees`, `departments`, `audit_logs` | Authenticated |
| `me.ts` | `getAttendance`, `punch`, `requestRegularization`, `getLeaveBalances`, `applyLeave`, `withdrawLeaveRequest`, `getCalendar`, `getKpis`, `submitKpiSelfReview`, `getMyPayslips`, `getMyAssets`, `acknowledgeAsset`, `reportAssetIssue`, `getMyClaims`, `claimHolidayWork` | `attendance_records`, `attendance_punches`, `leave_requests`, `leave_balances`, `holidays`, `kpis`, `kpi_scores`, `payslips`, `assets`, `holiday_work_claims` | Employee (Self) |
| `team.ts` | `getTeamDashboard`, `getPendingLeaves`, `actionLeave`, `getPendingRegularizations`, `actionRegularization`, `getTeamCalendar`, `getTeamKpis`, `defineKpi`, `reviewKpi`, `getTeamClaims`, `actionClaim` | `employees`, `leave_requests`, `attendance_regularizations`, `kpis`, `holiday_work_claims` | Manager, HR, Admin |
| `compensation.ts` | `getRevisions`, `proposeRevision`, `actionRevision`, `previewMonth`, `saveDraftPayroll`, `approvePayroll`, `publishPayroll` | `salary_revisions`, `payroll_entries`, `attendance_records`, `leave_requests`, `leave_types`, `holidays` | Accounts, CEO, Admin (Strict 403 on Employee) |
| `payroll.ts` | `getPayrollDashboardStatus`, `getSalaryStructures`, `updateSalaryStructure`, `getLopSummary`, `generatePayslips`, `bulkUploadPayslips`, `publishPayslips`, `revokePayslip`, `getAccessLogs` | Supabase Edge Function `payroll` / tables | Accounts, Admin (Strict 403 on Employee) |
| `hr.ts` | `registerStaff`, `getEmployees`, `getOrgChart`, `getMonthlyRegister`, `getLeavePolicies`, `updateLeavePolicy`, `getHolidays`, `saveHoliday`, `deleteHoliday`, `getApplicants`, `getBenefits`, `getDocuments` | `employees`, `departments`, `leave_types`, `holidays`, `job_openings`, `applicants`, `benefits`, `company_documents` | HR, Admin |
| `it.ts` | `getDashboardMetrics`, `getAssets`, `createAsset`, `updateAsset`, `getRequests`, `updateRequest` | `assets`, `it_requests` | IT, Admin |
| `lifecycle.ts` | `getJoinersAndExits`, `getTasks`, `createTask`, `updateTaskStatus`, `initiateExit` | `lifecycle_tasks`, `employees` | HR, IT, Accounts, Manager |
| `overtime.ts` | `getClaims`, `submitClaim`, `reviewClaim` | `holiday_work_claims` | Employee, Manager, HR |

---

## 5. End-to-End Test Matrix & Verification Criteria

### A. Auth & Session
1. **Valid Login:** Login via standard email & password, and demo persona switch. Expect immediate redirect to `/dashboard` with correct employee details.
2. **Invalid Credentials:** Login with incorrect password. Expect user-friendly error message, no app crash, button re-enables.
3. **Empty Fields:** Submitting empty email or whitespace. Form validation prevents submit.
4. **Logout & Back Button:** Click Sign Out, then click browser Back button. Must stay on `/login` and NOT render any protected pages or flash staff profiles.
5. **Deep Link while Logged Out:** Direct URL to `/attendance` or `/payroll-attendance` while unauthenticated renders `/login`, and after login directs to the requested view.
6. **Direct /login while Logged In:** Navigating to `/login` while active session exists cleanly presents the portal without redirect ping-pong.
7. **No Redirect Chains:** Zero 301/302/redirect loops between `/login` and `/dashboard`.

### B. Attendance Punch
1. **Punch In:** Click Punch In. Expect single record created with `work_date` in IST (`Asia/Kolkata`), punch in time, button changes to Punch Out.
2. **Punch Out:** Click Punch Out. Expect worked hours calculated correctly, status updated to `PRESENT`.
3. **Double Click / Rapid Punching:** Click Punch In repeatedly or double-click. Expect exactly one record created, button immediately disables with `Recording...`, no duplicate POSTs or overwrite of punch-in timestamp.
4. **Punch After Midnight:** Punching between 00:00 and 05:30 IST. Correctly maps to today's date in `Asia/Kolkata`, not UTC yesterday.
5. **Slow Network / Throttling:** Network slowed down to 3G. Punch button shows spinner and disabled state until completion.

### C. Leave — Multi-Level Approval
1. **Apply Leave:** Single day, multi-day, half-day, overlapping dates.
   - Overlapping existing leave: blocked with clear toast error.
   - Past dates: allowed/flagged as per policy.
   - Balance check: exceeds quota blocks submission.
2. **Manager Applying for Own Leave:** Approver must not be set to self; routes to skip-level or HR queue (`null`), preventing self-approval deadlock.
3. **Approval Flow (L1 -> L2):**
   - Short leave (<= 3 days): L1 approves -> status becomes `APPROVED` immediately.
   - Long leave (> 3 days): L1 approves -> status remains `PENDING` and forwards to L2 skip-level manager.
   - If skip-level manager is self, missing, or inactive: finalizes approval cleanly without loop or deadlock.
4. **Rejection:** Mandatory remarks required. Rejection at any level immediately terminates the chain (`REJECTED`).
5. **Withdraw / Cancel:** Employee cancels pending leave -> status becomes `WITHDRAWN`, releasing reserved balance.
6. **Balance Updates:** Updated once and consistently.

### D. Team Calendar
1. Month switching (Previous / Next), year transitions.
2. Rapid clicks on month navigation.
3. Verify zero infinite fetch loops, clean loading states, and no flicker.

### E. KPI Reviews
1. Employee self-review submission (actuals, rating, comment).
2. Manager goal definition and review/rating.
3. Terminal states: status transitions are strictly one-directional.

### F. Payroll (Confidentiality & Access Control)
1. Role check: Staff Doctor (`rahul.sharma@secondmedic.com`) attempting to open `/payroll-attendance` or `/payroll-dashboard` sees Unauthorized 403 lock screen.
2. Direct API call as Employee to `compensationApi.getRevisions()` or `previewMonth()` throws 403 Forbidden with zero salary data exposed.
3. Only `ACCOUNTS`, `CEO`, and `SYSTEM_ADMIN` can access payroll calculations and salary structures.

### G. Code Loop Hunting & General QA
1. Zero `useEffect` infinite cycles or missing dependencies.
2. Zero `setInterval` without `clearInterval`.
3. Zero uncaught errors or React warnings in Console (`Maximum update depth exceeded`, `Too many re-renders`).
4. Mobile viewport (375px width) responsiveness and desktop layout.

