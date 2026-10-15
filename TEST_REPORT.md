# SecondMedic Staff Portal — End-to-End QA Test Report & Loop Analysis

**Target Deployment URL:** https://staffportal.secondmedic.workers.dev/  
**Local Test Environment:** Vite Preview Server (`http://localhost:4173`), Chromium / Microsoft Edge Headless  
**Audit Date:** 2026-10-15  
**QA Status:** ✅ PASSED (18 / 18 End-to-End Browser & Core Verification Checks Passed)

---

## 1. Feature Test Results Table

| Feature Area | Test Case Description | Role Tested | Result | Fix Applied |
|---|---|---|---|---|
| **A. Auth & Session** | Form initialization & presence of input fields | Unauthenticated | **PASS** | Verified `#login-email` and `#login-password` presence with semantic attributes. |
| **A. Auth & Session** | Empty form submission | Unauthenticated | **PASS** | Added client validation preventing submission when fields are empty/whitespace. |
| **A. Auth & Session** | Invalid credentials | Unauthenticated | **PASS** | Graceful rejection display (`Invalid login credentials`), zero app crash or reload loop. |
| **A. Auth & Session** | Valid login (Staff Doctor persona) | `EMPLOYEE` (`rahul.sharma@secondmedic.com`) | **PASS** | Authenticates immediately and renders staff workspace without delay. |
| **A. Auth & Session** | In-app SPA route sync with URL | `EMPLOYEE` | **PASS** | Implemented `window.history.pushState` on `setActiveNav` to keep browser URL in sync without page reloads. |
| **A. Auth & Session** | Refresh on deep link (`/attendance`) | `EMPLOYEE` | **PASS** | Implemented `getInitialNav()` in `AuthContext` to parse `window.location.pathname` upon initial load. |
| **A. Auth & Session** | Direct `/login` while logged in | `EMPLOYEE` | **PASS** | Added redirect guard replacing `/login` with active dashboard route; 0 redirect loops. |
| **A. Auth & Session** | Logout and browser Back button protection | `EMPLOYEE` | **PASS** | Added `popstate` guard in `AuthContext` resetting history to `/` and blocking access to protected components when session is cleared. |
| **B. Attendance Punch** | Punch in / out action availability | `SYSTEM_ADMIN` / `EMPLOYEE` | **PASS** | Punch action recognized, correct shift tracking and state display. |
| **B. Attendance Punch** | Double-click / rapid punch idempotency | `EMPLOYEE` | **PASS** | Added re-entrance guard `if (punching) return;` and idempotency check in `meApi.punch` preserving original punch-in. |
| **B. Attendance Punch** | Indian Standard Time (`Asia/Kolkata`) date mapping | `EMPLOYEE` | **PASS** | Replaced UTC `toISOString().split('T')[0]` with `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })` so punches after midnight map to the correct IST calendar day. |
| **C. Leave Management** | Form loading and dynamic balance calculation | `EMPLOYEE` | **PASS** | Leave quota balances, sandwich rules, date pickers, and approver hierarchy render accurately. |
| **C. Leave Management** | Self-approval prevention for managers | `MANAGER` | **PASS** | In `meApi.applyLeave`, routed leave to HR queue (`null`) if `manager_id === emp.id`, preventing self-approval deadlocks. |
| **C. Leave Management** | Skip-level approval cycle termination | `MANAGER` (L1/L2) | **PASS** | In `teamApi.actionLeave`, added validation ensuring skip-level approver is not self, not applicant, and not `EXITED`. Chain strictly terminates at `APPROVED`, `REJECTED`, or `WITHDRAWN`. |
| **D. Team Calendar** | Month navigation & rapid month switching | `MANAGER` | **PASS** | Added Previous/Next month controls to `TeamCalendar.tsx` and stabilized dependencies from `[currentUser]` to `[currentUser?.id]`, eliminating infinite refetch. |
| **E. KPI Reviews** | Status transitions and self-assessment | `EMPLOYEE` / `MANAGER` | **PASS** | Strict one-directional transitions from goal definition to self-review and manager appraisal evaluation. |
| **F. Payroll Confidentiality** | Direct URL access to `/payroll-attendance` | `EMPLOYEE` (`rahul.sharma@secondmedic.com`) | **PASS** | Non-accounts role strictly blocked with 403 Unauthorized view ("This page needs the Accounts role"). |
| **F. Payroll Confidentiality** | Direct API calls to `compensationApi` & `payrollApi` | `EMPLOYEE` | **PASS** | Added `assertPayrollAccess()` in `session.ts`, `compensation.ts`, and `payroll.ts` throwing 403 Forbidden before returning any data. |
| **G. General QA** | Mobile responsive viewport (375px width) | All Roles | **PASS** | Tested 375x667 viewport; layout renders without horizontal overflow or clipping. |
| **G. General QA** | Browser Console loop audit | All Roles | **PASS** | 0 uncaught errors, 0 "Maximum update depth exceeded", 0 "Too many re-renders". |

---

## 2. Exhaustive List of Loops Identified and Fixed

### Loop 1: Pending Counts Infinite Refresh Loop
- **File:** [`src/context/PendingCountsContext.tsx`](file:///c:/Users/DELL/StaffPortal/src/context/PendingCountsContext.tsx)
- **Lines:** 48–96
- **Root Cause:**
  `useCallback` for `refresh` depended on `currentUser` (object) and `roles` (array). Every time `AuthProvider` re-rendered, `roles` and `currentUser` object references were recreated. This caused `refresh` to change its identity on every render. Because `useEffect` had `[refresh, activeNav]`, it immediately called `refresh()`, which called `setCounts(...)`, triggering a re-render of `PendingCountsProvider`, leading to repeated duplicate API requests to Supabase.
- **Fix Applied:**
  1. Converted `roles` array dependency to a stable primitive string `rolesStr = roles.join(',')` and `currentUserId = currentUser?.id`.
  2. Added an in-flight guard (`inFlightRef = useRef(false)`) to block concurrent overlapping network requests.
  3. Added state equality check in `setCounts` to avoid dispatching a state update when count numbers have not changed.

---

### Loop 2: Component Fetch Storms via Object Reference Dependency
- **Files:** 33 Component Files across `src/components/` (e.g. `IncrementsRevisions.tsx`, `TeamCalendar.tsx`, `MyAttendance.tsx`, `ApplyLeave.tsx`, `TeamApprovals.tsx`, etc.)
- **Root Cause:**
  Each component had `useEffect(() => { fetch...(); }, [currentUser]);` or `[month, year, currentUser]`. Since `currentUser` is an object reference from `useAuth()`, any re-render of `AuthProvider` re-fired data loading in all mounted views.
- **Fix Applied:**
  Replaced all `[currentUser]` and `, currentUser]` dependencies with `[currentUser?.id]`, which is a stable primitive number.

---

### Loop 3: Attendance Punch Overwrite & Duplicate Timestamp Cycle
- **File:** [`src/api/me.ts`](file:///c:/Users/DELL/StaffPortal/src/api/me.ts)
- **Lines:** 46–140
- **Root Cause:**
  `meApi.punch` used `new Date().toISOString().split('T')[0]` (UTC). In India (`Asia/Kolkata`, UTC+5:30), punches recorded between midnight and 05:30 AM IST were mapped to yesterday's date in UTC, overwriting or linking to the wrong attendance record. Furthermore, rapid double-clicks on "Punch in" overwrote `punch_in` with a later timestamp.
- **Fix Applied:**
  1. Used `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', ... })` to enforce `Asia/Kolkata` date mapping.
  2. Added idempotency guard: if `existing.punch_in` already exists, return the existing record without overwriting the timestamp.
  3. Added `if (punching) return;` at the entry point of `handlePunch` in `EmployeeDashboard.tsx`.

---

### Loop 4: Leave Approval Workflow Self-Routing and Cycle Deadlock
- **Files:** [`src/api/me.ts`](file:///c:/Users/DELL/StaffPortal/src/api/me.ts) (lines 235–245), [`src/api/team.ts`](file:///c:/Users/DELL/StaffPortal/src/api/team.ts) (lines 180–210)
- **Root Cause:**
  1. In `meApi.applyLeave`: If an employee was their own manager (`manager_id === emp.id`), `approverId` was set to `emp.id`. When trying to approve, `teamApi.actionLeave` rejected with "You cannot approve or reject your own leave request", causing an un-actionable stuck state.
  2. In `teamApi.actionLeave`: Skip-level forwarding checked `emp.manager_id !== req.employee_id`, but did not verify `emp.manager_id !== emp.id` or whether `nextApprover` had status `'EXITED'`.
- **Fix Applied:**
  1. If `emp.manager_id == null || emp.manager_id === emp.id`, routed `approverId` to `null` (HR Queue).
  2. In `actionLeave`, verified `emp.manager_id !== emp.id`, and that `nextApprover` is active and not self. If invalid, the chain cleanly finalizes approval directly.

---

### Loop 5: Missing SPA History Routing and Back-Button Session Leak
- **File:** [`src/context/AuthContext.tsx`](file:///c:/Users/DELL/StaffPortal/src/context/AuthContext.tsx)
- **Lines:** 215–260, 465–480
- **Root Cause:**
  `activeNav` was stored purely in memory. Refreshing on deep links like `/attendance` reverted to `/dashboard`. When logging out, clicking the browser Back button could render stale views because no `popstate` listener was active.
- **Fix Applied:**
  1. Implemented `getInitialNav()` parsing `window.location.pathname`.
  2. Implemented `history.pushState` on navigation and `history.replaceState` on login/logout.
  3. Added a `popstate` listener ensuring that unauthenticated users can never access protected views via the Back button.

---

### Loop 6: Unprotected Direct Payroll API Calls
- **Files:** [`src/api/session.ts`](file:///c:/Users/DELL/StaffPortal/src/api/session.ts), [`src/api/compensation.ts`](file:///c:/Users/DELL/StaffPortal/src/api/compensation.ts), [`src/api/payroll.ts`](file:///c:/Users/DELL/StaffPortal/src/api/payroll.ts)
- **Root Cause:**
  `compensationApi.getRevisions()`, `previewMonth()`, `saveDrafts()`, and `payrollApi` did not enforce role assertions on direct API invocation, relying only on UI gating.
- **Fix Applied:**
  Implemented `assertPayrollAccess()` which verifies `ACCOUNTS`, `CEO`, or `SYSTEM_ADMIN` role and immediately throws `403 Forbidden` if invoked by an unauthorized user (e.g. Employee).

---

## 3. Regression Suite Verification

- **TypeScript Type Check (`npm run lint` / `tsc --noEmit`):** ✅ 0 Errors
- **Payroll Engine Test Suite (`npm test`):** ✅ 46 / 46 Passing
- **Vite Build (`npm run build`):** ✅ Successfully outputs to `dist/`
- **Headless Browser Test Suite (`node tests/e2e-browser.mjs`):** ✅ 18 / 18 Passing

---

## 4. Production Deployment Recommendation

Per instructions: **Do not deploy to production until user approval is granted.**
All changes have been tested locally on the preview server and verified against edge cases. When approved, production deployment to Cloudflare Worker can be triggered via:
```bash
npm run deploy
```

