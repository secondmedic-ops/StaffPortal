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

Apply `supabase/migrations/20261013000000_staff_lifecycle.sql` (Supabase SQL editor or `supabase db push`). It is idempotent and:

- adds the **IT** role
- creates `employee_profiles`, `assets`, `asset_assignments`, `it_requests`, `lifecycle_tasks`, `salary_revisions`, `payroll_entries`, all with row-level security
- adds triggers so **only the current approver in the reporting line (or HR)** can approve leave/regularizations, salary revisions need a **different approver than the proposer**, published payslips are **immutable**, and leave balances are reserved/released **server-side**
- adds read-only policies so Accounts can read attendance for payroll and managers can see their reporting line

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
| Worked ≥ 8h / regularized | 1 |
| Worked 4–8h, or missing punch-out | ½ |
| Worked < 4h, or absent without approved leave | 0 (LOP) |
| Approved paid leave · mandatory holiday · week-off | 1 |
| Approved LOP leave | 0 |
| Every 3 late marks (after 09:30 + 15 min grace) | −½ |

Deductions: PF 12% of basic (₹15,000 ceiling), ESI 0.75% when gross ≤ ₹21,000, Professional Tax (Maharashtra slab), TDS from the salary revision. All thresholds live in **`src/config/policy.ts`**.
