#!/bin/bash
# Exercises the staff-lifecycle migration's permission rules by impersonating staff.
# Usage: DB_ADMIN_URL=postgres://postgres@localhost:5432/postgres supabase/tests/run_policy_tests.sh
# Creates and drops a throwaway database named sm_policy_test. Never point this at production.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ADMIN="${DB_ADMIN_URL:?set DB_ADMIN_URL to a superuser connection on a scratch Postgres}"
TEST_DB=sm_policy_test
FAILED=0
psql "$ADMIN" -qc "drop database if exists $TEST_DB" -c "create database $TEST_DB" >/dev/null || exit 1
DB_URL="$(echo "$ADMIN" | sed -E "s#/[^/?]*(\?|$)#/$TEST_DB\1#")"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$HERE/stub_schema.sql" || exit 1
for i in 1 2; do  # applied twice to prove idempotency
  for m in "$HERE"/../migrations/*.sql; do
    # stub_schema.sql stands in for the core schema (it seeds fixed test users).
    case "$m" in *_core_schema.sql) continue ;; esac
    psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$m" 2>&1 | grep -i error && exit 1
  done
done
psql "$DB_URL" -qc "insert into employee_roles(employee_id, role) values (7,'IT')"   -c "insert into leave_balances(employee_id, leave_type_id, fy_year, opening) values (3,1,'2025-2026',5),(3,1,'2026-2027',12)"
P="psql $DB_URL -qtA -v ON_ERROR_STOP=1"
as() { # as <emp_n> <sql> ; expect success
  local uid="00000000-0000-0000-0000-00000000000$1"
  $P -c "begin; set local role authenticated; set local request.jwt.claim.sub='$uid'; $2; commit;" 2>&1
}
expect_ok()   { out=$(as "$1" "$2"); if [ $? -eq 0 ]; then echo "ok    $3 ${out:+→ $out}"; else FAILED=1; echo "FAIL  $3 :: $out"; fi; }
expect_fail() { out=$(as "$1" "$2"); if [ $? -ne 0 ]; then echo "ok    $3 (blocked: $(echo "$out" | grep -o 'ERROR:.*' | head -1 | cut -c1-90))"; else FAILED=1; echo "FAIL  $3 should be blocked :: $out"; fi; }
expect_blocked() { out=$(as "$1" "$2 returning id"); rc=$?; rows=$(echo "$out" | grep -E '^[0-9]+$' | head -1); if [ $rc -ne 0 ] || [ -z "$rows" ]; then echo "ok    $3 (blocked: ${out:-0 rows matched})" | cut -c1-150; else FAILED=1; echo "FAIL  $3 should be blocked :: updated id $rows"; fi; }
expect_val()  { out=$(as "$1" "$2" | tail -1); if [ "$out" == "$3" ]; then echo "ok    $4 (=$out)"; else FAILED=1; echo "FAIL  $4 expected $3 got '$out'"; fi; }

$P -c "insert into leave_requests(id, employee_id, leave_type_id, from_date, to_date, total_days, current_approver_id) values (100,3,1,'2026-10-20','2026-10-25',5,2),(101,3,1,'2026-11-02','2026-11-02',1,2)"
$P -c "insert into attendance_regularizations(id, employee_id, work_date, requested_in, requested_out, reason, approver_id) values (200,3,'2026-10-01','09:30','18:30','forgot',2),(201,3,'2026-10-02','09:30','18:30','forgot',2)"

echo "== Leave approvals follow the reporting line =="
expect_blocked 3 "update leave_requests set status='APPROVED' where id=100" "Nurse cannot approve own leave"
expect_blocked 1 "update leave_requests set status='APPROVED' where id=100" "CEO (not current approver, not HR) cannot jump the queue"
expect_blocked 7 "update leave_requests set status='APPROVED' where id=100" "Unrelated IT staff cannot approve"
expect_ok   2 "update leave_requests set current_level=2, current_approver_id=1 where id=100" "Manager (L1) approves & forwards to skip-level"
expect_blocked 2 "update leave_requests set status='APPROVED' where id=100" "Manager can no longer act once forwarded"
expect_ok   1 "update leave_requests set status='APPROVED' where id=100" "CEO (L2 skip-level) gives final approval"
expect_blocked 1 "update leave_requests set status='REJECTED' where id=100" "Closed request cannot be re-actioned"
expect_ok   3 "update leave_requests set status='WITHDRAWN' where id=101" "Employee can withdraw own pending leave"

echo "== Regularization: reporting line or HR only =="
expect_blocked 7 "update attendance_regularizations set status='APPROVED' where id=200" "IT cannot approve nurse regularization"
expect_blocked 3 "update attendance_regularizations set status='APPROVED' where id=200" "Nurse cannot approve own regularization"
expect_ok   1 "update attendance_regularizations set status='APPROVED' where id=200" "CEO (in reporting chain) can approve"
expect_val  3 "select worked_hours || '/' || is_regularized from attendance_records where employee_id=3 and work_date='2026-10-01'" "9.0/true" "Approval writes the times onto the nurse's attendance"
expect_blocked 4 "update attendance_regularizations set status='REJECTED' where id=201" "Reject without remarks is blocked"
expect_ok   4 "update attendance_regularizations set status='REJECTED', approver_remarks='No proof' where id=201" "HR can act on any regularization"
expect_blocked 2 "update attendance_regularizations set status='APPROVED' where id=201" "Closed regularization cannot be re-actioned"
expect_ok   3 "insert into attendance_regularizations(employee_id, work_date, requested_in, requested_out, reason) values (3,'2026-10-05','09:30','18:00','biometric down')" "Nurse requests a time update"
expect_fail 3 "insert into attendance_regularizations(employee_id, work_date, requested_in, requested_out, reason) values (3,'2026-10-05','09:30','18:00','again')" "Second pending request for same day is blocked"
expect_fail 3 "insert into attendance_regularizations(employee_id, work_date, requested_in, requested_out, reason) values (3,'2026-10-06','06:30 PM','09:30 AM','x')" "12-hour / reversed times are rejected"
expect_fail 3 "insert into attendance_regularizations(employee_id, work_date, requested_in, requested_out, reason) values (3,'2099-01-01','09:30','18:00','x')" "Future-dated request is blocked"
$P -c "insert into monthly_attendance_summaries(employee_id, year, month, locked) values (3,2026,9,true)"
expect_fail 3 "insert into attendance_regularizations(employee_id, work_date, requested_in, requested_out, reason) values (3,'2026-09-10','09:30','18:00','x')" "Request in an HR-locked month is blocked"

echo "== IT assets =="
expect_ok   7 "insert into assets(id, asset_tag, category, phone_number, carrier) values (1,'SM-SIM-001','SIM','9800000001','Jio'),(2,'SM-LT-001','LAPTOP',null,null)" "IT adds SIM + laptop"
expect_fail 7 "insert into assets(asset_tag, category, phone_number) values ('SM-SIM-002','SIM','9800000001')" "Duplicate active mobile number rejected"
expect_fail 3 "insert into assets(asset_tag, category) values ('X','LAPTOP')" "Nurse cannot add assets"
expect_ok   7 "update assets set status='ASSIGNED', assigned_to=3, assigned_at=now() where id=1; insert into asset_assignments(asset_id, employee_id, assigned_by) values (1,3,7)" "IT issues SIM to nurse"
expect_val  3 "select count(*) from assets" "1" "Nurse sees only her own asset"
expect_ok   3 "select acknowledge_asset(1)" "Nurse acknowledges receipt"
expect_fail 3 "select acknowledge_asset(2)" "Nurse cannot acknowledge an asset not issued to her"
expect_val  3 "update assets set notes='hack' where id=1 returning id" "" "Nurse cannot edit asset rows"
expect_val  4 "select count(*) from assets" "2" "HR can see all assets (exit clearance)"

echo "== IT requests =="
expect_ok   3 "insert into it_requests(employee_id, request_type, title, raised_by) values (3,'REPAIR','Laptop slow',3)" "Nurse raises request for self"
expect_fail 3 "insert into it_requests(employee_id, request_type, title, raised_by) values (2,'REPAIR','x',3)" "Nurse cannot raise on behalf of others"
expect_ok   4 "insert into it_requests(employee_id, request_type, title, raised_by) values (3,'ONBOARDING','Setup',4)" "HR raises onboarding ticket"
expect_val  3 "update it_requests set status='DONE' returning id" "" "Nurse cannot close tickets"

echo "== Salary revisions: maker-checker & CEO-only approval =="
expect_ok   5 "insert into salary_revisions(id, employee_id, revision_type, effective_from, ctc_annual, basic_monthly, proposed_by) values (1,3,'INCREMENT','2026-11-01',480000,20000,5)" "Accounts A proposes increment"
expect_fail 5 "update salary_revisions set status='APPROVED' where id=1" "Proposer cannot approve own proposal"
expect_fail 6 "update salary_revisions set status='APPROVED' where id=1" "Accounts B cannot approve Accounts A revision (only CEO)"
expect_val  3 "select count(*) from salary_revisions" "0" "Employee cannot see a proposed revision"
expect_fail 4 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, proposed_by) values (3,'INCREMENT','2026-11-01',1,1,4)" "HR cannot propose increments"
expect_ok   4 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, proposed_by) values (3,'JOINING','2026-11-01',1,1,4)" "HR can propose a joining salary"
expect_val  4 "select count(*) from salary_revisions" "0" "HR cannot read salary revisions"
expect_fail 1 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, proposed_by) values (3,'INCREMENT','2026-11-01',500000,22000,1)" "CEO cannot propose for a non-Accounts employee"
expect_ok   1 "insert into salary_revisions(id, employee_id, revision_type, effective_from, ctc_annual, basic_monthly, proposed_by) values (2,5,'INCREMENT','2026-11-01',600000,25000,1)" "CEO can propose increment for Accounts staff"
expect_ok   1 "update salary_revisions set status='APPROVED' where id=2" "CEO can approve own proposal for Accounts staff"
expect_ok   1 "update salary_revisions set status='APPROVED' where id=1" "CEO approves Accounts A proposal"
expect_val  3 "select count(*) from salary_revisions where status='APPROVED'" "1" "Employee sees own approved revision"
expect_val  2 "select count(*) from salary_revisions where employee_id=3 and status='APPROVED'" "1" "Manager sees report's approved salary"
expect_val  2 "select count(*) from salary_revisions where status<>'APPROVED'" "0" "Manager cannot see unapproved proposals"
expect_val  7 "select count(*) from salary_revisions" "0" "Staff outside the reporting line cannot see salary"
expect_val  4 "select count(*) from salary_revisions where status='APPROVED'" "0" "HR still cannot see salaries"
$P -c "select 'approved_by='||approved_by from salary_revisions where id=1"

echo "== Payroll entries: CEO-only approval =="
expect_ok   5 "insert into payroll_entries(id, employee_id, year, month, net_pay, computed_by) values (1,3,2026,9,37000,5)" "Accounts A saves draft"
expect_val  3 "select count(*) from payroll_entries" "0" "Employee cannot see draft payslip"
expect_fail 5 "update payroll_entries set status='PUBLISHED' where id=1" "Cannot publish before approval"
expect_fail 5 "update payroll_entries set status='APPROVED' where id=1" "Accounts A cannot approve own payroll"
expect_blocked 2 "update payroll_entries set status='APPROVED' where id=1" "Manager cannot approve payroll"
expect_val  2 "select count(*) from payroll_entries" "0" "Manager cannot see payroll draft"
expect_blocked 8 "update payroll_entries set status='APPROVED' where id=1" "Director cannot approve payroll"
expect_val  8 "select count(*) from payroll_entries" "0" "Director cannot see payroll draft"
expect_fail 1 "update payroll_entries set net_pay=1 where id=1" "Approver cannot change amounts"
expect_fail 1 "update payroll_entries set worked_hours=200 where id=1" "Approver cannot change worked hours"
expect_fail 1 "update payroll_entries set daily_rate=500 where id=1" "Approver cannot change daily rate"
expect_ok   1 "update payroll_entries set status='APPROVED' where id=1" "CEO approves payroll"
expect_fail 2 "update payroll_entries set status='DRAFT' where id=1" "Manager cannot send approved payroll back to draft"
expect_fail 8 "update payroll_entries set status='DRAFT' where id=1" "Director cannot send approved payroll back to draft"
expect_ok   5 "update payroll_entries set status='DRAFT' where id=1" "Accounts can send approved payroll back to draft"
expect_ok   1 "update payroll_entries set status='APPROVED' where id=1" "CEO approves payroll again"
expect_ok   1 "update payroll_entries set status='DRAFT' where id=1" "CEO can send approved payroll back to draft"
expect_ok   1 "update payroll_entries set status='APPROVED' where id=1" "CEO approves payroll for publishing"
expect_fail 1 "update payroll_entries set status='PUBLISHED' where id=1" "Approver cannot publish (Accounts does)"
expect_ok   5 "update payroll_entries set status='PUBLISHED', published_at=now() where id=1" "Accounts publishes approved payroll"
expect_val  3 "select net_pay from payroll_entries" "37000.00" "Employee sees published payslip"
expect_fail 5 "update payroll_entries set net_pay=1 where id=1" "Published payslip is immutable"

echo "== Per-day (part-time) salary =="
expect_fail 5 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, pay_type, proposed_by) values (3,'JOINING','2026-10-01',0,0,'DAILY',5)" "Per-day salary needs a daily rate"
expect_fail 5 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, pay_type, daily_rate, proposed_by) values (3,'JOINING','2026-10-01',0,0,'HOURLY',60,5)" "Hourly pay type no longer accepted"
expect_ok   5 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, pay_type, daily_rate, proposed_by) values (3,'CORRECTION','2026-10-01',0,0,'DAILY',300,5)" "Accounts proposes a daily rate"

echo "== Comp-off / overtime claims =="
$P -c "insert into leave_types(id, code, name, is_paid) values (9,'COMP_OFF','Comp Off',true)"
expect_ok   3 "insert into holiday_work_claims(id, employee_id, work_date, worked_hours, days, compensation) values (1,3,'2026-09-06',8.5,1,'COMP_OFF'),(2,3,'2026-09-13',5,0.5,'OVERTIME'),(3,3,'2026-09-20',9,1,'OVERTIME')" "Nurse claims 3 Sundays"
expect_fail 3 "insert into holiday_work_claims(employee_id, work_date, days, compensation) values (2,'2026-09-06',1,'OVERTIME')" "Cannot claim for someone else"
expect_fail 3 "insert into holiday_work_claims(id, employee_id, work_date, days, compensation) values (10,3,'2026-09-06',1,'OVERTIME')" "Same date cannot be claimed twice"
expect_blocked 3 "update holiday_work_claims set status='APPROVED' where id=1" "Nurse cannot approve own claim"
expect_blocked 7 "update holiday_work_claims set status='APPROVED' where id=1" "IT cannot approve"
expect_ok   2 "update holiday_work_claims set status='APPROVED' where id=1" "Manager approves comp-off"
expect_val  3 "select accrued::float from leave_balances where leave_type_id=9" "1" "Comp-off day credited to leave balance"
expect_ok   1 "update holiday_work_claims set status='APPROVED' where id=2" "Skip-level manager approves overtime"
expect_ok   4 "update holiday_work_claims set status='REJECTED', approver_remarks='Not rostered' where id=3" "HR rejects a claim"
expect_val  5 "select sum(days) from holiday_work_claims where status='APPROVED' and compensation='OVERTIME'" "0.5" "Accounts sees approved overtime for payroll"
expect_val  2 "select count(*) from leave_balances where leave_type_id=9" "1" "Overtime claim does not credit comp-off"

echo "== Onboarding / exit tasks =="
expect_ok   4 "insert into lifecycle_tasks(id, employee_id, kind, owner_role, title) values (1,3,'ONBOARDING','IT','Laptop'),(2,3,'ONBOARDING','HR','Docs'),(3,3,'ONBOARDING','MANAGER','Welcome')" "HR creates checklist"
expect_val  7 "update lifecycle_tasks set done=true where id=1 returning id" "1" "IT ticks IT task"
expect_val  7 "update lifecycle_tasks set done=true where id=2 returning id" "" "IT cannot tick HR task"
expect_val  2 "update lifecycle_tasks set done=true where id=3 returning id" "3" "Reporting manager ticks MANAGER task"
expect_val  1 "update lifecycle_tasks set done=true where id=3 returning id" "3" "Skip-level manager can also tick MANAGER task"
expect_val  5 "update lifecycle_tasks set done=true where id=3 returning id" "" "Accounts cannot tick MANAGER task"

echo "== Profiles & bank details =="
expect_ok   4 "insert into employee_profiles(employee_id, father_name) values (3,'R. Kumar')" "HR saves personal profile"
expect_fail 4 "insert into employee_financials(employee_id, pan_number, bank_account_number) values (3,'ABCDE1234F','123456789')" "HR cannot save bank details"
expect_ok   5 "insert into employee_financials(employee_id, pan_number, bank_account_number) values (3,'ABCDE1234F','123456789')" "Accounts saves bank details"
expect_val  3 "select pan_number from employee_financials" "ABCDE1234F" "Employee sees own bank & ID details"
expect_val  5 "select count(*) from employee_financials" "1" "Accounts sees bank details"
expect_val  4 "select count(*) from employee_financials" "0" "HR cannot see bank details"
expect_val  2 "select count(*) from employee_financials" "0" "Manager cannot see report's bank details"
expect_val  3 "update employee_financials set bank_account_number='999' returning employee_id" "" "Employee cannot change own bank account"
expect_fail 5 "insert into employee_financials(employee_id, aadhaar_last4) values (2,'12345678')" "Full Aadhaar in the last-4 field rejected"
expect_fail 5 "update employee_financials set aadhaar_number='12345' where employee_id=3" "Aadhaar must be 12 digits"
expect_ok   5 "update employee_financials set aadhaar_number='123456789012' where employee_id=3" "Accounts saves full Aadhaar"
expect_val  3 "select aadhaar_last4 from employee_financials" "9012" "Last 4 digits kept in step"
expect_val  3 "select count(*) from information_schema.columns where table_name='employee_profiles' and column_name like 'bank%'" "0" "No bank columns left on the HR profile table"

echo "== Role grants =="
expect_fail 4 "insert into employee_roles(employee_id, role) values (7,'ACCOUNTS')" "HR cannot grant Accounts"
expect_fail 4 "insert into employee_roles(employee_id, role) values (7,'CEO')" "HR cannot grant CEO"
expect_fail 4 "insert into employee_roles(employee_id, role) values (7,'DIRECTOR')" "HR cannot grant Director"
expect_ok   4 "insert into employee_roles(employee_id, role) values (7,'MANAGER')" "HR can grant Manager"
expect_ok   1 "insert into employee_roles(employee_id, role) values (7,'ACCOUNTS')" "CEO can grant Accounts"
expect_ok   1 "insert into employee_roles(employee_id, role) values (7,'DIRECTOR')" "CEO can grant Director"
expect_val  4 "delete from employee_roles where employee_id=7 and role='ACCOUNTS' returning employee_id" "" "HR cannot remove Accounts"
expect_val  4 "delete from employee_roles where employee_id=7 and role='DIRECTOR' returning employee_id" "" "HR cannot remove Director"
$P -c "delete from employee_roles where employee_id=7 and role in ('ACCOUNTS', 'DIRECTOR')"

echo "== Director role permissions =="
$P -c "insert into leave_requests(id, employee_id, leave_type_id, from_date, to_date, total_days, current_approver_id) values (102,2,1,'2026-11-10','2026-11-12',2,8),(103,5,1,'2026-11-15','2026-11-16',1,1)"
expect_ok   8 "update leave_requests set status='APPROVED' where id=102" "Director approves leave of Manager reporting to him"
expect_blocked 8 "update leave_requests set status='APPROVED' where id=103" "Director blocked from approving leave outside his line"
expect_val  8 "select count(*) from salary_revisions where employee_id=3 and status='APPROVED'" "1" "Director sees approved salary of Nurse under his manager"
expect_fail 8 "update salary_revisions set status='APPROVED' where id=1" "Director cannot approve salary revision"
expect_fail 8 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, proposed_by) values (3,'INCREMENT','2026-12-01',1,1,8)" "Director cannot propose salary revision"
expect_val  8 "select count(*) from employee_financials" "0" "Director cannot read employee financials"
expect_fail 8 "insert into employee_roles(employee_id, role) values (7,'MANAGER')" "Director cannot grant roles"
$P -c "insert into role_proposals(id, target_user_id, target_user_name, target_user_email, proposed_role) values (90, 7, 'IT', 'it@sm.com', 'MANAGER')"
expect_val  8 "select count(*) from role_proposals" "0" "Director cannot see role proposals"
expect_blocked 8 "update role_proposals set status='APPROVED' where id=90" "Director cannot action role proposals"

echo "== Leave balance trigger =="
expect_val 5 "select reserved||'/'||used from leave_balances where fy_year='2026-2027' and leave_type_id=1" "0/5" "Approved 5 days used, withdrawn day released (latest FY row)"


psql "$ADMIN" -qc "drop database if exists $TEST_DB" >/dev/null
[ "$FAILED" -eq 0 ] && echo "All policy checks passed" || echo "Some policy checks FAILED"
exit $FAILED
