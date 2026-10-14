# SecondMedic Staff Portal

React + Supabase portal for staff self-service, reporting-line approvals, HR, IT assets and attendance-based payroll.

## Setup

```bash
npm ci                 # installs from package-lock.json
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

`20261015000000_hourly_pay_and_payslip.sql` adds hourly pay (`salary_revisions.pay_type`, `hourly_rate`), stores hours on payroll entries and adds `employees.division`.

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

## Part-time (hourly) pay and the payslip format

In **Increments & Revisions**, choose *Hourly (part-time)* and enter the hourly rate. Payroll then pays **hours worked × rate** (hours come from punches; a day without a punch-out is not paid until a time update is approved). Deductions follow the company part-time payslip: PF 12% of gross, ESI 0.75% of gross (gross ≤ ₹21,000), LWF and advance recovery, no Professional Tax. Accounts can add **arrears** or an **advance recovery** for any employee by opening their payslip under *Run payroll*.

Every payslip prints in the company format (`src/components/common/PayslipView.tsx`, company name and logo in `src/config/company.ts`): division, location, code, name, masked Aadhaar and PAN, designation, department, ESI number; earnings beside LWF / Advance / ESI / PF; gross and total; net payable worked out, the bank account it was paid into and the amount in words. The LWF rate is `STATUTORY_DEDUCTIONS` in `src/config/policy.ts` (0 until Accounts sets it).

## Payroll approval

Accounts computes and saves a month → the **reporting manager of that Accounts person** reviews it under *Payroll Approval* and approves or sends it back → Accounts publishes. The database blocks the person who computed it from approving, blocks the approver from changing amounts, and blocks publishing before approval.

Deductions: PF 12% of basic (₹15,000 ceiling), ESI 0.75% when gross ≤ ₹21,000, Professional Tax flat ₹200/month, TDS from the salary revision. All thresholds live in **`src/config/policy.ts`**.
