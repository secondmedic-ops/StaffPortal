# SecondMedic Staff Portal

React + Supabase portal for staff self-service, reporting-line approvals, HR, IT assets and attendance-based payroll.

## Setup

```bash
bun install            # or npm install
cp .env.example .env   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
npm run lint           # typecheck
npm test               # payroll engine checks

# Database permission tests (scratch Postgres only — creates/drops sm_policy_test)
DB_ADMIN_URL=postgres://postgres@localhost:5432/postgres supabase/tests/run_policy_tests.sh
```

### Database migration

Apply the migrations in `supabase/migrations/` in filename order (Supabase SQL editor or `supabase db push`). They are idempotent.

`20261001000000_core_schema.sql` creates the core tables (employees, departments, roles, leave, attendance, KPIs, audit log) with row-level security, plus starter departments and leave types (EL, CL, SL, COMP_OFF, LOP). Skip it only if your project already has these tables.

`20261013000000_staff_lifecycle.sql`:

- adds the **IT** role
- creates `employee_profiles`, `assets`, `asset_assignments`, `it_requests`, `lifecycle_tasks`, `salary_revisions`, `payroll_entries`, all with row-level security
- adds triggers so **only the current approver in the reporting line (or HR)** can approve leave/regularizations, salary revisions need a **different approver than the proposer**, published payslips are **immutable**, and leave balances are reserved/released **server-side**
- adds read-only policies so Accounts can read attendance for payroll and managers can see their reporting line

`20261014000000_holiday_work_claims.sql` adds comp-off / overtime claims and makes monthly payroll need approval from the reporting manager of the Accounts person who computed it. For comp-off to credit leave, create a leave type with code `COMP_OFF` in Leave Policy Config.

After migrating, grant the `IT` role to your IT staff (User & Role Mgmt → propose → CEO approves, or insert into `employee_roles`).

## Who sees what

| Login | Gets |
|---|---|
| **Everyone** | Attendance punch, leave, payslips (incl. day-by-day attendance breakdown), salary history, **My Assets** (acknowledge receipt, raise IT requests) |
| **Manager** *(automatic for anyone with direct reports)* | Leave approvals & regularizations for their reporting line, team calendar/KPIs, manager onboarding tasks |
| **HR** | **Register New Staff** wizard, onboarding & exit checklists, directory, holiday calendar (with 2026/2027 import), attendance lock, HR leave queue & override |
| **Accounts** | **Attendance Payroll** (compute → draft → approve → publish), **Increments & Revisions** (maker-checker), payroll register CSV, bank details |
| **IT** | IT overview, **Asset Register** (laptops, handsets, company SIMs/mobile numbers, warranty, custody history), service desk |
| **CEO** | Org dashboard, approves salary revisions and role changes |

## Leave approval hierarchy

1. Employee applies → request goes to their **reporting manager** (`employees.manager_id`).
2. Leave longer than `LEAVE_APPROVAL_POLICY.skipLevelThresholdDays` (3) is forwarded to the **manager's manager** after level-1 approval.
3. No reporting manager → **HR queue**. HR can also override any pending request (recorded as "HR Override" in the timeline).

## Salary from attendance

`src/lib/payrollEngine.ts` classifies every day of the month, then prorates salary by paid days:

| Day | Paid |
|---|---|
| Worked ≥ 8h (shift 09:30–18:00) | 1 |
| Worked 4–8h, or missing punch-out | ½ |
| Worked < 4h, or absent without approved leave | 0 (LOP) |
| Approved paid leave · mandatory holiday · week-off | 1 |
| Approved LOP leave | 0 |
| Every 3 late marks (punch-in after 10:00, i.e. 30 min grace) | −½ |

Staff fix a missed or wrong punch with a **time update request** (My Attendance → regularize). Once their manager approves, the approved times replace the day's punches (a record is created if they never punched) and pay follows those hours. Punching in on a Sunday or holiday is counted as **holiday worked**. For each such day (half day if 4–8h) the employee chooses, under **Comp-off & Overtime**:

- **Comp-off**: once the manager approves, the day is credited to their `COMP_OFF` leave balance.
- **Overtime pay**: once the manager approves, payroll adds 1× a day's gross (monthly gross ÷ days in month) to that month's payslip.

## Payroll approval

Accounts computes and saves a month → the **reporting manager of that Accounts person** reviews it under *Payroll Approval* and approves or sends it back → Accounts publishes. The database blocks the person who computed it from approving, blocks the approver from changing amounts, and blocks publishing before approval.

Deductions: PF 12% of basic (₹15,000 ceiling), ESI 0.75% when gross ≤ ₹21,000, Professional Tax flat ₹200/month, TDS from the salary revision. All thresholds live in **`src/config/policy.ts`**.
