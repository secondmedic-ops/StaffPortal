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

`20261016000000_full_aadhaar.sql` stores the full Aadhaar number (12 digits, last 4 kept in step).

`20261015000000_hourly_pay_and_payslip.sql` adds `salary_revisions.pay_type`, stores hours on payroll entries and adds `employees.division`; `20261017000000_daily_pay.sql` switches part-time pay to per day (`daily_rate`).

`20261014000000_holiday_work_claims.sql` adds comp-off / overtime claims and makes monthly payroll need approval from the reporting manager of the Accounts person who computed it. For comp-off to credit leave, create a leave type with code `COMP_OFF` in Leave Policy Config.

`20261024000001_branches_and_geofencing.sql` through `20261024000011_add_employee_confirmation_date.sql`:
- **Branch Master**: `branches` table with coordinates, 100m geofence radius, and HR branch management screen with GPS picker.
- **Supabase Storage**: Private buckets (`employee-documents`, `leave-attachments`, `avatars`, `gallery`) with signed URLs and RLS policies.
- **Email Service & Outbox**: `email_outbox` table, `send-email` Edge Function (Gmail SMTP with SSL), and `daily-jobs` scheduler with `pg_cron`.
- **Mandatory Sign-out**: Blocks subsequent punch-in if previous punch is unclosed; regularization banner and audit reports for HR & Managers.
- **Work Mode Selector**: Office / WFH / Field modes with 100m branch geofence enforcement and advance WFH request validation.
- **Single-level Leave Approval**: Direct reporting authority (`employees.manager_id`) sign-off only (skip-level threshold eliminated).
- **Employee 360 & Self-Service**: 6-tab profile with Document Vault, History audit, photo upload/crop (<=300KB WebP), masked statutory numbers, and correction requests.
- **Holidays in Attendance**: 12 mandatory 2026 holidays on attendance month grid & upcoming card; removed separate calendar.
- **Resignation & F&F Settlements**: 30-day notice resignation workflow, Accounts maker-checker F&F tool with CEO sign-off, printable F&F statement, relieving letter, and experience certificate.
- **Branch Photo Gallery**: Multi-upload with client WebP compression, albums, and lightbox viewer.

After migrating, grant the `IT` role to your IT staff (User & Role Mgmt → propose → CEO approves, or insert into `employee_roles`).

## Who sees what

| Login | Gets |
|---|---|
| **Everyone** | Attendance punch (Office/WFH/Field with GPS geofence), leave, payslips, My Assets, My Profile self-service (photo crop, masked PAN/Aadhaar/UAN, correction requests), Company Gallery, Resignation & exit |
| **Manager** *(automatic for anyone with direct reports)* | Leave approvals & regularizations for direct reports (single-level), team calendar/KPIs, team missed sign-outs report |
| **HR** | Staff directory & Employee 360 profile, branch master (GPS coordinates + 100m radius), attendance register (with Company Holidays tab), missed sign-outs report, email outbox log, birthday popups & alerts |
| **Accounts** | **Attendance Payroll**, **Increments & Revisions**, **F&F Settlements** (separation clearance, leave encashment, gratuity, notice adjustments, printable statements) |
| **IT** | IT overview, **Asset Register** (laptops, handsets, company SIMs, warranty, custody history), service desk |
| **CEO** | Org dashboard, approves salary revisions, role changes, and executive sign-off for F&F settlements |

## Leave approval hierarchy

1. Employee applies → request goes to their **reporting manager** (`employees.manager_id`).
2. Single-level approval: once the reporting manager approves, the leave is fully approved (no skip-level threshold required).
3. No reporting manager → **HR queue**. HR can also override any pending request (recorded as "HR Override" in the timeline).

## Edge Functions & Email Service (SMTP via Gmail)

Outbound automated emails and background scheduler jobs run on Supabase Edge Functions (Deno).

### Required Secrets Configuration

All SMTP and service configuration is read strictly from Supabase function secrets (never hardcoded, committed to Git, or exposed to the frontend). Set the secrets in your Supabase project:

```bash
supabase secrets set \
  SMTP_HOST="smtp.gmail.com" \
  SMTP_PORT="465" \
  SMTP_SECURE="true" \
  SMTP_USER="placeholder@gmail.com" \
  SMTP_PASS="placeholder_app_password" \
  SMTP_FROM_NAME="Second Medic" \
  SMTP_FROM_EMAIL="notifications@secondmedic.com" \
  APP_BASE_URL="https://staffportal.secondmedic.workers.dev" \
  HR_EMAIL="hr@secondmedic.com" \
  SMTP_DEBUG="false"
```

### Deploying Edge Functions

Deploy the functions to your linked Supabase project:

```bash
supabase functions deploy send-email
supabase functions deploy daily-jobs
```

The database includes an automated `pg_cron` schedule:
- **`secondmedic-daily-jobs`**: Executes daily at 08:00 IST (`30 2 * * *` UTC) to queue birthday wishes, milestone anniversary alerts (1, 3, 5, 10 yrs), 15-day probation confirmation reminders, missed sign-out notices, and auto-exit processing.
- **`secondmedic-flush-email-outbox`**: Triggers every 5 minutes (`*/5 * * * *`) to process and dispatch pending rows in `public.email_outbox` with exponential retry backoff.

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

## Part-time (per-day) pay and the payslip format

In **Increments & Revisions**, choose *Per day (part-time)* and enter the daily rate. Payroll then pays **days worked × daily rate**: a day counts when it has a punch-in and punch-out, whatever the hours (a day without a punch-out is not paid until a time update is approved). Deductions follow the company part-time payslip: PF 12% of gross, ESI 0.75% of gross (gross ≤ ₹21,000), LWF and advance recovery, no Professional Tax. Accounts can add **arrears** or an **advance recovery** for any employee by opening their payslip under *Run payroll*.

Every payslip prints in the company format (`src/components/common/PayslipView.tsx`, company name and logo in `src/config/company.ts`): division, location, code, name, Aadhaar and PAN, designation, department, ESI number; earnings beside LWF / Advance / ESI / PF; gross and total; net payable worked out, the bank account it was paid into and the amount in words. **Bank details are mandatory**: Register new staff requires bank name, IFSC and account number; HR adds them for existing staff under *Staff directory → Bank & ID*; Run payroll will not save a payslip for anyone without them. The full Aadhaar number is stored (`employee_profiles.aadhaar_number`, readable only by the employee, HR and Accounts) and printed on payslips. LWF is ₹25 in June and December (`STATUTORY_DEDUCTIONS` in `src/config/policy.ts`); other months print 0.00.

## Payroll approval

Accounts computes and saves a month → the **reporting manager of that Accounts person** reviews it under *Payroll Approval* and approves or sends it back → Accounts publishes. The database blocks the person who computed it from approving, blocks the approver from changing amounts, and blocks publishing before approval.

Deductions: PF 12% of basic (₹15,000 ceiling), ESI 0.75% when gross ≤ ₹21,000, Professional Tax flat ₹200/month, TDS from the salary revision. All thresholds live in **`src/config/policy.ts`**.
