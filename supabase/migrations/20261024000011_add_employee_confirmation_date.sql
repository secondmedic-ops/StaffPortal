-- -----------------------------------------------------------------------------
-- 20261024000011_add_employee_confirmation_date.sql
-- Add confirmation_date to employees for probation tracking
-- -----------------------------------------------------------------------------

alter table public.employees
  add column if not exists confirmation_date date;
