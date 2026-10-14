/**
 * Payroll engine checks — run with `npm test`.
 * Each case is hand-calculated so a policy change that alters pay shows up here.
 */
import { computePayroll, numberInWords, splitCtc } from './payrollEngine';
const assert = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
const salary = { basicMonthly: 20000, hraMonthly: 8000, specialMonthly: 12000, otherAllowanceMonthly: 0, tdsMonthly: 1000, pfApplicable: true };
// Sept 2026: 30 days, Sundays 6,13,20,27 (4). 26 working days.
const iso = (d: number) => `2026-09-${String(d).padStart(2, '0')}`;
const punch = (d: number, inH: string, hours: number) => {
  const pin = new Date(`${iso(d)}T${inH}:00`);
  const pout = new Date(pin.getTime() + hours * 3600000);
  return { id: d, employeeId: 1, workDate: iso(d), shiftId: 1, punchIn: pin.toISOString(), punchOut: pout.toISOString(), workedHours: hours, status: 'PRESENT' as const, isRegularized: false };
};
const workdays = Array.from({ length: 30 }, (_, i) => i + 1).filter(d => new Date(2026, 8, d).getDay() !== 0);
const today = '2026-10-13';

// 1. Perfect attendance → full pay
let r = computePayroll({ year: 2026, month: 9, salary, attendance: workdays.map(d => punch(d, '09:20', 9)), leaves: [], holidays: [], today });
assert(r.payableDays === 30 && r.lopDays === 0, `full month payable=30 (got ${r.payableDays})`);
assert(r.grossEarnings === 40000, `gross 40000 (got ${r.grossEarnings})`);
assert(r.deductions.find(d => d.code === 'PF')!.amount === 1800, 'PF capped at 15000*12% = 1800');
assert(r.deductions.find(d => d.code === 'PT')!.amount === 200, 'PT 200');
assert(!r.deductions.find(d => d.code === 'ESI'), 'no ESI above 21000');
assert(r.netPay === 40000 - 1800 - 200 - 1000, `net ${r.netPay}`);

// 2. Two absent days with no leave → 2 LOP, prorated
const att2 = workdays.filter(d => d !== 8 && d !== 9).map(d => punch(d, '09:20', 9));
r = computePayroll({ year: 2026, month: 9, salary, attendance: att2, leaves: [], holidays: [], today });
assert(r.lopDays === 2 && r.absentDays === 2, `2 absent → 2 LOP (got ${r.lopDays})`);
assert(r.grossEarnings === Math.round(20000*28/30)+Math.round(8000*28/30)+Math.round(12000*28/30), `prorated gross ${r.grossEarnings}`);

// 3. Same two days covered by approved paid leave → no LOP
r = computePayroll({ year: 2026, month: 9, salary, attendance: att2, leaves: [{ fromDate: iso(8), toDate: iso(9), isPaid: true }], holidays: [], today });
assert(r.lopDays === 0 && r.paidLeaveDays === 2, 'paid leave covers absence');

// 4. Unpaid (LOP) leave → LOP
r = computePayroll({ year: 2026, month: 9, salary, attendance: att2, leaves: [{ fromDate: iso(8), toDate: iso(9), isPaid: false }], holidays: [], today });
assert(r.lopDays === 2 && r.unpaidLeaveDays === 2, 'LOP leave deducts');

// 5. Late marks: 7 late days → floor(7/3)=2 → 1 day LOP
const att5 = workdays.map((d, i) => punch(d, i < 7 ? '10:05' : '09:20', 9));
r = computePayroll({ year: 2026, month: 9, salary, attendance: att5, leaves: [], holidays: [], today });
assert(r.lateMarks === 7 && r.lateLopDays === 1 && r.payableDays === 29, `7 late → 1 day LOP (got late=${r.lateMarks}, lop=${r.lateLopDays})`);

// 6. Holiday with no punch is paid
const att6 = workdays.filter(d => d !== 14).map(d => punch(d, '09:20', 9));
r = computePayroll({ year: 2026, month: 9, salary, attendance: att6, leaves: [], holidays: [iso(14)], today });
assert(r.lopDays === 0 && r.holidayDays === 1, 'holiday paid');

// 7. Short day (5h) = half; 2h = zero
const att7 = workdays.map(d => (d === 1 ? punch(d, '09:20', 5) : d === 2 ? punch(d, '09:20', 2) : punch(d, '09:20', 9)));
r = computePayroll({ year: 2026, month: 9, salary, attendance: att7, leaves: [], holidays: [], today });
assert(r.lopDays === 1.5, `5h half + 2h zero → 1.5 LOP (got ${r.lopDays})`);

// 8. Missing punch-out in past = half day
const att8 = workdays.map(d => (d === 3 ? { ...punch(d, '09:20', 9), punchOut: undefined, workedHours: undefined } : punch(d, '09:20', 9)));
r = computePayroll({ year: 2026, month: 9, salary, attendance: att8, leaves: [], holidays: [], today });
assert(r.lopDays === 0.5, `missing punch-out → 0.5 LOP (got ${r.lopDays})`);

// 9. Joined mid-month (16th) → only employed days paid, not counted as LOP
r = computePayroll({ year: 2026, month: 9, salary, dateOfJoining: iso(16), attendance: workdays.filter(d => d >= 16).map(d => punch(d, '09:20', 9)), leaves: [], holidays: [], today });
assert(r.payableDays === 15 && r.lopDays === 0, `mid-month joiner payable=15 lop=0 (got ${r.payableDays}/${r.lopDays})`);

// 10. Half-day paid leave + half-day punch
const att10 = workdays.map(d => (d === 4 ? punch(d, '13:30', 4.5) : punch(d, '09:20', 9)));
r = computePayroll({ year: 2026, month: 9, salary, attendance: att10, leaves: [{ fromDate: iso(4), toDate: iso(4), fromHalf: 'FIRST_HALF', isPaid: true }], holidays: [], today });
assert(r.lopDays === 0, `half leave + half work = full day (got lop ${r.lopDays})`);

// 11. Future days in current month are projected, not LOP
r = computePayroll({ year: 2026, month: 10, salary, attendance: [], leaves: [], holidays: [], today: '2026-10-13' });
assert(r.projectedDays > 0 && r.warnings.some(w => w.includes('future')), 'future days projected with warning');

// 12. ESI applies for low gross
r = computePayroll({ year: 2026, month: 9, salary: { ...salary, basicMonthly: 9000, hraMonthly: 3600, specialMonthly: 5400, tdsMonthly: 0 }, attendance: workdays.map(d => punch(d, '09:20', 9)), leaves: [], holidays: [], today });
assert(r.deductions.find(d => d.code === 'ESI')!.amount === Math.ceil(18000 * 0.0075), 'ESI 0.75% when gross ≤ 21000');

// 13. No salary → zero pay + warning
r = computePayroll({ year: 2026, month: 9, salary: null, attendance: [], leaves: [], holidays: [], today });
assert(r.netPay === 0 && r.warnings.some(w => w.includes('salary')), 'no salary warning');

// 14. CTC split sums back to CTC
for (const ctc of [300000, 600000, 1800000]) {
  const s = splitCtc(ctc, 0.5, 0.4, true);
  const gross = s.basicMonthly + s.hraMonthly + s.specialMonthly;
  const erPf = Math.round(Math.min(s.basicMonthly, 15000) * 0.12);
  assert(Math.abs((gross + erPf) * 12 - ctc) <= 24, `split ${ctc}: monthly gross ${gross} + erPF ${erPf} ≈ CTC/12`);
}

// 15. 30-minute grace: 09:55 is on time, 10:05 is late
r = computePayroll({ year: 2026, month: 9, salary, attendance: workdays.map((d, i) => punch(d, i < 6 ? '09:55' : '09:20', 9)), leaves: [], holidays: [], today });
assert(r.lateMarks === 0, `09:55 within 30-min grace → no late marks (got ${r.lateMarks})`);
r = computePayroll({ year: 2026, month: 9, salary, attendance: workdays.map((d, i) => punch(d, i < 3 ? '10:05' : '09:20', 9)), leaves: [], holidays: [], today });
assert(r.lateMarks === 3 && r.lateLopDays === 0.5, `3 late marks → ½ day LOP (got ${r.lateMarks}/${r.lateLopDays})`);

// 16. Flat PT ₹200 even in February
r = computePayroll({ year: 2026, month: 2, salary, attendance: [], leaves: [], holidays: [], today: '2026-01-01' });
assert(r.deductions.find(d => d.code === 'PT')!.amount === 200, 'PT is a flat 200 in February');

// 17. Approved time update replaces a missing punch-out
const att17 = workdays.map(d => (d === 3 ? { ...punch(d, '09:30', 8.5), isRegularized: true } : punch(d, '09:20', 9)));
r = computePayroll({ year: 2026, month: 9, salary, attendance: att17, leaves: [], holidays: [], today });
assert(r.lopDays === 0 && r.days.find(x => x.date === iso(3))!.note === 'Time update approved', 'approved time update → full day');

// 18. Approved time update for a short day still pays only what was worked
const att18 = workdays.map(d => (d === 3 ? { ...punch(d, '09:30', 4.5), isRegularized: true } : punch(d, '09:20', 9)));
r = computePayroll({ year: 2026, month: 9, salary, attendance: att18, leaves: [], holidays: [], today });
assert(r.lopDays === 0.5, `time update for 4.5h → half day (got lop ${r.lopDays})`);

// 19. Working on a Sunday / holiday is counted (for comp-off or overtime)
r = computePayroll({ year: 2026, month: 9, salary, attendance: [...workdays.map(d => punch(d, '09:20', 9)), punch(6, '09:30', 8), punch(14, '09:30', 8)], leaves: [], holidays: [iso(14)], today });
assert(r.holidayWorkedDays === 2 && r.payableDays === 30, `Sunday + holiday worked counted, pay unchanged (got ${r.holidayWorkedDays})`);

// 20. Approved overtime: 1.5 days × (monthly gross ÷ 30) added to earnings
r = computePayroll({ year: 2026, month: 9, salary, attendance: workdays.map(d => punch(d, '09:20', 9)), leaves: [], holidays: [], overtimeDays: 1.5, today });
const ot = r.earnings.find(e => e.code === 'OVERTIME');
assert(ot?.amount === Math.round((40000 / 30) * 1.5), `overtime 1.5 days = ${Math.round((40000 / 30) * 1.5)} (got ${ot?.amount})`);
assert(r.grossEarnings === 42000 && r.deductions.find(d => d.code === 'PF')!.amount === 1800, 'overtime raises gross but not PF');
assert(!r.warnings.some(w => w.includes('Loss of pay')), 'overtime does not trigger a false LOP warning');

// 21. Part-time hourly pay, as on the company part-time payslip:
//     100 h × ₹60 = 6000; PF 12% = 720; ESI 0.75% = 45; total 765; net 5235; no PT.
const hourly = { basicMonthly: 0, hraMonthly: 0, specialMonthly: 0, otherAllowanceMonthly: 0, tdsMonthly: 0, pfApplicable: true, payType: 'HOURLY' as const, hourlyRate: 60 };
const att21 = workdays.slice(0, 20).map(d => punch(d, '10:00', 5)); // 20 days × 5h = 100h
r = computePayroll({ year: 2026, month: 9, salary: hourly, attendance: att21, leaves: [], holidays: [], today });
assert(r.payType === 'HOURLY' && r.workedHours === 100, `hourly worked 100h (got ${r.workedHours})`);
assert(r.grossEarnings === 6000, `100h × 60 = 6000 (got ${r.grossEarnings})`);
assert(r.deductions.find(d => d.code === 'PF')!.amount === 720, 'hourly PF = 12% of gross = 720');
assert(r.deductions.find(d => d.code === 'ESI')!.amount === 45, 'hourly ESI = 0.75% of gross = 45');
assert(!r.deductions.find(d => d.code === 'PT'), 'no Professional Tax on the part-time payslip');
assert(r.totalDeductions === 765 && r.netPay === 5235, `total 765, net 5235 (got ${r.totalDeductions}/${r.netPay})`);
assert(!r.warnings.some(w => w.includes('Loss of pay')), 'hourly pay shows no LOP warning');
assert(r.presentDays === 20 && r.lopDays === 0, `hourly: 20 days worked, no LOP days (got ${r.presentDays}/${r.lopDays})`);

// 22. Arrears add to gross; advance is recovered; missing punch-out hours are not paid
const att22 = [...att21.slice(0, 19), { ...punch(workdays[19], '10:00', 5), punchOut: undefined, workedHours: undefined }];
r = computePayroll({ year: 2026, month: 9, salary: hourly, attendance: att22, leaves: [], holidays: [], today, arrears: 500, advance: 1000 });
assert(r.workedHours === 95 && r.earnings.find(e => e.code === 'HOURLY')!.amount === 5700, `95h paid (got ${r.workedHours})`);
assert(r.earnings.find(e => e.code === 'ARREARS')!.amount === 500 && r.grossEarnings === 6200, 'arrears added to gross');
assert(r.deductions.find(d => d.code === 'ADVANCE')!.amount === 1000, 'advance recovered');
assert(r.warnings.some(w => w.includes('No punch-out')), 'missing punch-out warned');

// 23. Hours are taken from punch times when worked hours were not stored
const att23 = [{ ...punch(1, '10:00', 6), workedHours: undefined }];
r = computePayroll({ year: 2026, month: 9, salary: hourly, attendance: att23, leaves: [], holidays: [], today });
assert(r.workedHours === 6 && r.grossEarnings === 360, `hours from punch times (got ${r.workedHours})`);

// 24. Monthly salary: arrears and advance flow through without touching LOP
r = computePayroll({ year: 2026, month: 9, salary, attendance: workdays.map(d => punch(d, '09:20', 9)), leaves: [], holidays: [], today, arrears: 2000, advance: 3000 });
assert(r.grossEarnings === 42000 && r.deductions.find(d => d.code === 'ADVANCE')!.amount === 3000, 'monthly arrears/advance applied');
assert(!r.warnings.some(w => w.includes('Loss of pay')), 'arrears do not trigger a false LOP warning');

// 25. Amount in words matches the payslip wording
assert(numberInWords(5235) === 'Five Thousand Two Hundred Thirty Five', `5235 in words (got ${numberInWords(5235)})`);

// 26. LWF ₹25 in June and December only
const lwf = (month: number) =>
  computePayroll({ year: 2026, month, salary: hourly, attendance: [], leaves: [], holidays: [], today: '2027-01-15', arrears: 1000 })
    .deductions.find(d => d.code === 'LWF')?.amount ?? 0;
assert(lwf(6) === 25 && lwf(12) === 25 && lwf(11) === 0, `LWF 25 in Jun/Dec, none in Nov (got ${lwf(6)}/${lwf(12)}/${lwf(11)})`);
r = computePayroll({ year: 2026, month: 12, salary, attendance: [], leaves: [], holidays: [], today: '2026-12-01' });
assert(r.deductions.find(d => d.code === 'LWF')?.amount === 25, 'monthly staff also pay LWF in December');
