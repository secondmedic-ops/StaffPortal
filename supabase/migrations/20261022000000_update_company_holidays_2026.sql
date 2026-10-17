-- Update official SecondMedic company holidays for 2026 (12 Days Official Flyer)
-- Reflects official flyer: Republic Day, Holi (Mar 3), Gudhi Padwa (Mar 19), Ram Navami (Mar 26),
-- Maharashtra Day (May 1), Independence Day (Aug 15), Raksha Bandhan (Aug 28), Ganesh Chaturthi (Sep 14),
-- Gandhi Jayanti (Oct 2), Vijayadashami (Oct 20), Bhai Dooj (Nov 11), Christmas (Dec 25).

begin;

-- Remove any 2026 holidays not present in official SecondMedic 2026 flyer
delete from public.holidays
where (holiday_year = 2026 or (holiday_date >= '2026-01-01' and holiday_date <= '2026-12-31'))
  and holiday_date not in (
    '2026-01-26',
    '2026-03-03',
    '2026-03-19',
    '2026-03-26',
    '2026-05-01',
    '2026-08-15',
    '2026-08-28',
    '2026-09-14',
    '2026-10-02',
    '2026-10-20',
    '2026-11-11',
    '2026-12-25'
  );

-- Upsert the 12 official SecondMedic 2026 holidays
insert into public.holidays (holiday_date, name, is_optional, is_restricted, holiday_year)
values
  ('2026-01-26', 'Republic Day', false, false, 2026),
  ('2026-03-03', 'Holi', false, false, 2026),
  ('2026-03-19', 'Gudhi Padwa', false, false, 2026),
  ('2026-03-26', 'Ram Navami', false, false, 2026),
  ('2026-05-01', 'Maharashtra Day', false, false, 2026),
  ('2026-08-15', 'Independence Day', false, false, 2026),
  ('2026-08-28', 'Raksha Bandhan', false, false, 2026),
  ('2026-09-14', 'Ganesh Chaturthi', false, false, 2026),
  ('2026-10-02', 'Gandhi Jayanti', false, false, 2026),
  ('2026-10-20', 'Vijayadashami', false, false, 2026),
  ('2026-11-11', 'Bhai Dooj', false, false, 2026),
  ('2026-12-25', 'Christmas', false, false, 2026)
on conflict (holiday_date) do update set
  name = excluded.name,
  is_optional = excluded.is_optional,
  is_restricted = excluded.is_restricted,
  holiday_year = excluded.holiday_year;

commit;

