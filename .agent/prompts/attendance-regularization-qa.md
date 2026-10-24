# Antigravity prompt: attendance time-update flow, Playwright QA and loose-end sweep

Copy everything below the line into Antigravity (Agent Manager → new task, workspace = this repo).

---

You are working in the **SecondMedic Staff Portal** repo (React 18 + TypeScript + Vite, Supabase with RLS, Cloudflare Workers). Read `AGENTS.md` and `.agent/rules/` first and follow them. Use the **Playwright browser** for every UI check. Don't rely on reading code alone.

## 1. The flow under test: how a team lead regularizes attendance

1. **Employee** opens *My Attendance* (`/my-attendance`), clicks a past day (`[data-testid="day-YYYY-MM-DD"]`), then clicks **Request Regularization** and enters 24-hour times (`#reg-in-time`, `#reg-out-time`) and a reason (`#reg-reason`).
   - `meApi.requestRegularization` (`src/api/me.ts`) inserts into `attendance_regularizations` with `approver_id = employee.manager_id`. If the employee has no manager, `approver_id` is null and the request goes to the HR queue.
   - The DB trigger `validate_regularization_request` rejects these requests: non-HH:MM times, out ≤ in, future dates, months HR has locked, and a second PENDING request for the same day.
2. **Team lead** (anyone with `MANAGER` role or direct reports) opens **My team → Time updates** (`/team-regularization`, `src/components/manager/TeamRegularization.tsx`).
   - Each card (`[data-testid="reg-card-<id>"]`) shows the punch on record, the requested in/out times, and the payroll effect (full day ≥ 8h, half day ≥ 4h, otherwise unpaid).
   - **Approve** (`reg-approve-<id>`) sets status to APPROVED. The DB trigger `apply_approved_regularization` then writes IST punch_in/punch_out, worked_hours, `is_regularized=true` and remarks onto `attendance_records` in the same transaction.
   - **Reject** (`reg-reject-<id>`) opens a modal. Remarks (`#reg-reject-remarks`) are mandatory, and the DB enforces this too. The employee sees the remarks on that day.
   - A request can be actioned only once (`.eq('status','PENDING')` plus the DB trigger). Self-approval is blocked. Only the reporting line or HR may act.
3. **HR** gets the scopes *My team / HR queue (no manager) / All pending*. HR users who aren't managers reach the screen from **People → HR time updates**.
4. The sidebar and bell badge `regularizations` come from `PendingCountsContext`. They must equal the number of cards in the queue.

Migration that powers this: `supabase/migrations/20261024000000_regularization_hardening.sql`.

## 2. Run the automated checks (do all of them, fix anything red)

```bash
npm install
npx tsc --noEmit
npm test
npm run build
```

### Playwright end-to-end check (mocked Supabase, safe to run anywhere)
```bash
npx playwright install chromium   # only if Chromium is not already available
VITE_SUPABASE_URL=http://mock.supabase.local VITE_SUPABASE_ANON_KEY=mockkey npx vite --port 5179 --strictPort &
node scripts/e2e/regularization-flow.cjs http://localhost:5179
```
Every line must print `ok`, and the run must end with `no console errors`. Open the screenshots in `scripts/e2e/screenshots/` and look at them.

### Database policy tests (needs a scratch Postgres, never production)
```bash
DB_ADMIN_URL=postgres://postgres@localhost:5432/postgres supabase/tests/run_policy_tests.sh
```
The "Regularization" section must be all `ok`. Known issue: the script currently aborts on the seed migration `20261019000000_register_snehal_kadam.sql`, because its `ON CONFLICT` target isn't present in `supabase/tests/stub_schema.sql`. Fix the harness so data-seed migrations either run against the stub or are skipped. Don't change the seed migration itself.

## 3. Manual Playwright walkthrough against a real **staging/preview** Supabase

Do this only if a non-production project and test logins are available (ask me for them). Never use production data.
1. As an employee with a manager: request a time update for yesterday (09:30 → 18:00). Then try 18:00 → 09:30, a future date, and a duplicate for the same day. All three must fail with a clear toast.
2. As that manager: the badge count equals the number of cards. Reject one request with empty remarks (blocked), then with remarks. Approve the other.
3. As the employee: the day shows the approval, punches 09:30/18:00 IST and the "Regularized" tag. The rejected day shows the manager's remarks.
4. As Accounts: run payroll for the month and confirm the approved day is paid as a full day.
5. As HR (non-manager): *People → HR time updates* shows the HR queue. Approve a request from an employee with no manager.
6. Lock the month in HR → Attendance register, then try to approve or request in that month. Both must be blocked.
Capture a screenshot for each step, and check the browser console and terminal for errors after each one.

## 4. Sweep for similar loose ends (same pattern, other approval flows)

For each flow below, check the same failure classes, write a Playwright check where practical, and fix what's broken:
- **Leave approvals** (`TeamApprovals.tsx`, `teamApi.actionLeave`): skip-level forwarding (> 3 days), the HR queue, the badge count matching the list, and double-action races.
- **Comp-off / OT claims** (`team-holiday-work`): reject remarks, one action only, and the 60-day claim window.
- **Payroll approval** (CEO only): no self-approval, and a published payslip stays immutable.
- **Punch in/out** (`meApi.punch`): IST date boundary near midnight, and a missing punch-out shown as half day.

Failure classes to check every time:
- (a) a status can change twice
- (b) a reject has no reason stored or shown
- (c) the badge count differs from the list
- (d) a role can see a menu item but the route blocks it, or the reverse
- (e) a write happens in two client calls that can half-fail (move it into a DB trigger or RPC)
- (f) time handling: 12h vs 24h, browser timezone vs IST
- (g) the user never sees the outcome of their request

## 5. Rules
- Commit to a feature branch. Never push to `main`, which auto-deploys production.
- New SQL goes in a new idempotent file under `supabase/migrations/`. Don't apply migrations to the production Supabase project without my explicit OK.
- Keep the existing code style. Add `data-testid` only where Playwright needs a stable hook.
- When finished, report:
  - what you checked
  - what failed
  - what you fixed (files)
  - screenshots
  - anything I must do by hand
