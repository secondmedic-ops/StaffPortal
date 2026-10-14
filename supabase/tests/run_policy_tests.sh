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
expect_ok   4 "update attendance_regularizations set status='REJECTED' where id=201" "HR can act on any regularization"

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

echo "== Salary revisions: maker-checker =="
expect_ok   5 "insert into salary_revisions(id, employee_id, revision_type, effective_from, ctc_annual, basic_monthly, proposed_by) values (1,3,'INCREMENT','2026-11-01',480000,20000,5)" "Accounts A proposes increment"
expect_fail 5 "update salary_revisions set status='APPROVED' where id=1" "Proposer cannot approve own proposal"
expect_val  3 "select count(*) from salary_revisions" "0" "Employee cannot see a proposed revision"
expect_fail 4 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, proposed_by) values (3,'INCREMENT','2026-11-01',1,1,4)" "HR cannot propose increments"
expect_ok   4 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, proposed_by) values (3,'JOINING','2026-11-01',1,1,4)" "HR can propose a joining salary"
expect_val  4 "select count(*) from salary_revisions" "0" "HR cannot read salary revisions"
expect_ok   1 "update salary_revisions set status='APPROVED' where id=1" "CEO approves"
expect_val  3 "select count(*) from salary_revisions where status='APPROVED'" "1" "Employee sees own approved revision"
expect_val  2 "select count(*) from salary_revisions" "0" "Manager cannot see report's salary"
$P -c "select 'approved_by='||approved_by from salary_revisions where id=1"

echo "== Payroll entries: reporting manager of the Accounts person approves =="
expect_ok   5 "insert into payroll_entries(id, employee_id, year, month, net_pay, computed_by) values (1,3,2026,9,37000,5)" "Accounts A saves draft"
expect_val  3 "select count(*) from payroll_entries" "0" "Employee cannot see draft payslip"
expect_fail 5 "update payroll_entries set status='PUBLISHED' where id=1" "Cannot publish before approval"
expect_fail 5 "update payroll_entries set status='APPROVED' where id=1" "Accounts A cannot approve own payroll"
expect_blocked 2 "update payroll_entries set status='APPROVED' where id=1" "Unrelated manager cannot approve"
expect_val  2 "select count(*) from payroll_entries" "0" "Unrelated manager cannot see payroll"
expect_fail 1 "update payroll_entries set net_pay=1 where id=1" "Approver cannot change amounts"
expect_fail 1 "update payroll_entries set worked_hours=200 where id=1" "Approver cannot change worked hours"
expect_fail 1 "update payroll_entries set hourly_rate=500 where id=1" "Approver cannot change hourly rate"
expect_ok   1 "update payroll_entries set status='APPROVED' where id=1" "Accounts A's reporting manager (CEO) approves"
expect_fail 1 "update payroll_entries set status='PUBLISHED' where id=1" "Approver cannot publish (Accounts does)"
expect_ok   5 "update payroll_entries set status='PUBLISHED', published_at=now() where id=1" "Accounts publishes approved payroll"
expect_val  3 "select net_pay from payroll_entries" "37000.00" "Employee sees published payslip"
expect_fail 5 "update payroll_entries set net_pay=1 where id=1" "Published payslip is immutable"

echo "== Hourly (part-time) salary =="
expect_fail 5 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, pay_type, proposed_by) values (3,'JOINING','2026-10-01',0,0,'HOURLY',5)" "Hourly salary needs an hourly rate"
expect_ok   5 "insert into salary_revisions(employee_id, revision_type, effective_from, ctc_annual, basic_monthly, pay_type, hourly_rate, proposed_by) values (3,'CORRECTION','2026-10-01',72000,0,'HOURLY',60,5)" "Accounts proposes an hourly rate"

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

echo "== Profiles =="
expect_ok   4 "insert into employee_profiles(employee_id, pan_number, bank_account_number) values (3,'ABCDE1234F','123456789')" "HR saves profile"
expect_val  3 "select pan_number from employee_profiles" "ABCDE1234F" "Employee sees own profile"
expect_val  5 "select count(*) from employee_profiles" "1" "Accounts sees bank details"
expect_val  2 "select count(*) from employee_profiles" "0" "Manager cannot see report's bank details"
expect_fail 4 "insert into employee_profiles(employee_id, aadhaar_last4) values (2,'12345678')" "Full Aadhaar in the last-4 field rejected"
expect_fail 4 "update employee_profiles set aadhaar_number='12345' where employee_id=3" "Aadhaar must be 12 digits"
expect_ok   4 "update employee_profiles set aadhaar_number='123456789012' where employee_id=3" "HR saves full Aadhaar"
expect_val  3 "select aadhaar_last4 from employee_profiles" "9012" "Last 4 digits kept in step"
expect_val  2 "select count(*) from employee_profiles where aadhaar_number is not null" "0" "Manager cannot see Aadhaar"

echo "== Leave balance trigger =="
expect_val 5 "select reserved||'/'||used from leave_balances where fy_year='2026-2027' and leave_type_id=1" "0/5" "Approved 5 days used, withdrawn day released (latest FY row)"

psql "$ADMIN" -qc "drop database if exists $TEST_DB" >/dev/null
[ "$FAILED" -eq 0 ] && echo "All policy checks passed" || echo "Some policy checks FAILED"
exit $FAILED
