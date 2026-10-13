import React, { useEffect, useState } from 'react';
import { CalendarPlus, ChevronRight, Clock, FileText, Loader2, LogIn, LogOut, MapPin, Palmtree } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { meApi, compensationApi } from '../../api';
import { AttendanceRecord, LeaveBalance, Holiday } from '../../types';
import { formatTime, getTodayIsoString, getMonthName } from '../../utils/dateUtils';
import { SHIFT_POLICY, ATTENDANCE_POLICY } from '../../config/policy';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { cardClass } from '../common/PageHeader';

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const clock = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const hoursLabel = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

const SHIFT_START = toMinutes(SHIFT_POLICY.startTime);
const SHIFT_END = toMinutes(SHIFT_POLICY.endTime);
const GRACE_END = SHIFT_START + SHIFT_POLICY.graceMinutes;
const RANGE_START = SHIFT_START - 60;
const RANGE_END = SHIFT_END + 90;

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The working day as a line: shift window, grace period, and the moments a
 * half day and a full day are earned from today's punch-in.
 */
const WorkdayLine: React.FC<{ inMin?: number; outMin?: number; nowMin: number }> = ({ inMin, outMin, nowMin }) => {
  const pct = (m: number) => `${(Math.min(Math.max(m, RANGE_START), RANGE_END) - RANGE_START) / (RANGE_END - RANGE_START) * 100}%`;
  const endOfWork = outMin ?? nowMin;
  const halfAt = inMin !== undefined ? inMin + SHIFT_POLICY.halfDayHours * 60 : undefined;
  const fullAt = inMin !== undefined ? inMin + SHIFT_POLICY.fullDayHours * 60 : undefined;
  const mid = Math.round((SHIFT_START + SHIFT_END) / 2 / 30) * 30;
  const ticks: Array<{ m: number; mobile: boolean }> = [
    { m: SHIFT_START, mobile: true },
    { m: Math.round((SHIFT_START + mid) / 2 / 30) * 30, mobile: false },
    { m: mid, mobile: true },
    { m: Math.round((mid + SHIFT_END) / 2 / 30) * 30, mobile: false },
    { m: SHIFT_END, mobile: true }
  ];

  const top = inMin !== undefined ? 'top-6' : 'top-2';
  return (
    <div className="select-none" aria-hidden>
      <div className={`relative ${inMin !== undefined ? 'h-14' : 'h-8'}`}>
        {/* track */}
        <div className={`absolute inset-x-0 ${top} h-2 rounded-full bg-slate-100 dark:bg-slate-800`} />
        {/* shift window */}
        <div
          className={`absolute ${top} h-2 rounded-full bg-slate-200 dark:bg-slate-700`}
          style={{ left: pct(SHIFT_START), width: `calc(${pct(SHIFT_END)} - ${pct(SHIFT_START)})` }}
        />
        {/* grace window */}
        <div
          className={`absolute ${top} h-2 bg-amber-200/80 dark:bg-amber-500/30`}
          style={{ left: pct(SHIFT_START), width: `calc(${pct(GRACE_END)} - ${pct(SHIFT_START)})` }}
        />
        {/* worked time */}
        {inMin !== undefined && (
          <div
            className="absolute top-6 h-2 rounded-full bg-teal-500"
            style={{ left: pct(inMin), width: `calc(${pct(endOfWork)} - ${pct(inMin)})` }}
          />
        )}
        {/* earned markers */}
        {halfAt !== undefined && (
          <div className="absolute top-3.5 -translate-x-1/2 flex flex-col items-center" style={{ left: pct(halfAt) }}>
            <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 -mt-3.5 mb-0.5 whitespace-nowrap">½ day</span>
            <span className="h-5 w-px bg-slate-400 dark:bg-slate-500" />
          </div>
        )}
        {fullAt !== undefined && (
          <div className="absolute top-3.5 -translate-x-1/2 flex flex-col items-center" style={{ left: pct(fullAt) }}>
            <span className="text-[11.5px] font-semibold text-teal-700 dark:text-teal-300 -mt-3.5 mb-0.5 whitespace-nowrap">Full day</span>
            <span className="h-5 w-px bg-teal-600 dark:bg-teal-400" />
          </div>
        )}
        {/* now */}
        {outMin === undefined && nowMin >= RANGE_START && nowMin <= RANGE_END && (
          <div className={`absolute ${inMin !== undefined ? 'top-[18px]' : '-top-0.5'} -translate-x-1/2`} style={{ left: pct(nowMin) }}>
            <span className="block h-4 w-4 rounded-full border-[3px] border-white dark:border-slate-900 bg-ink dark:bg-white shadow" />
          </div>
        )}
      </div>
      <div className="relative h-4 text-[11.5px] text-slate-400 tabular">
        {ticks.map(t => (
          <span key={t.m} className={`absolute -translate-x-1/2 ${t.mobile ? '' : 'hidden sm:inline'}`} style={{ left: pct(t.m) }}>
            {clock(t.m)}
          </span>
        ))}
      </div>
    </div>
  );
};

export const EmployeeDashboard: React.FC = () => {
  const { currentUser, setActiveNav, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [latestPayslip, setLatestPayslip] = useState<{ month: number; year: number } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const todayIso = getTodayIsoString();

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const d = new Date();
      const [att, bal, cal, req, slips] = await Promise.allSettled([
        meApi.getAttendance(d.getMonth() + 1, d.getFullYear()),
        meApi.getLeaveBalances(),
        meApi.getCalendar(d.getMonth() + 1, d.getFullYear()),
        meApi.getLeaveRequests(),
        compensationApi.getMyPublishedEntries()
      ]);
      if (cancelled) return;
      if (att.status === 'fulfilled') setTodayRecord(att.value.find(a => a.workDate === todayIso) ?? null);
      if (bal.status === 'fulfilled') setBalances(bal.value);
      if (cal.status === 'fulfilled') setHolidays(cal.value.holidays.filter(h => h.holidayDate >= todayIso).slice(0, 4));
      if (req.status === 'fulfilled') setPendingLeave(req.value.filter(r => r.status === 'PENDING').length);
      if (slips.status === 'fulfilled') {
        const published = slips.value[0];
        setLatestPayslip(published ? { month: published.month, year: published.year } : null);
      }
      const failed = [att, bal, cal, req].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) showToast('Some details did not load', failed.reason?.message ?? 'Try refreshing the page.', 'error');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const handlePunch = async (type: 'IN' | 'OUT') => {
    setPunching(true);
    let lat: number | undefined;
    let lng: number | undefined;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true })
        );
        lat = Number(pos.coords.latitude.toFixed(6));
        lng = Number(pos.coords.longitude.toFixed(6));
      } catch {
        // Location is optional; the punch is still recorded without it.
      }
    }
    try {
      const updated = await meApi.punch({
        type,
        lat,
        lng,
        source: currentUser?.employmentType === 'FIELD' ? 'MOBILE' : 'WEB'
      });
      setTodayRecord(updated);
      setNow(new Date());
      showToast(
        type === 'IN' ? 'Punched in' : 'Punched out',
        `Recorded at ${formatTime(type === 'IN' ? updated.punchIn : updated.punchOut)}${lat ? ' with your location' : ''}.`,
        'success'
      );
    } catch (err: any) {
      showToast(type === 'IN' ? "Couldn't punch in" : "Couldn't punch out", err.message || 'Try again in a moment.', 'error');
    } finally {
      setPunching(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-8 py-6 max-w-6xl mx-auto space-y-6">
        <SkeletonLoader count={1} height="44px" />
        <SkeletonLoader count={1} height="240px" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonLoader count={1} height="180px" className="lg:col-span-2" />
          <SkeletonLoader count={1} height="180px" />
        </div>
      </div>
    );
  }

  const inDate = todayRecord?.punchIn ? new Date(todayRecord.punchIn) : undefined;
  const outDate = todayRecord?.punchOut ? new Date(todayRecord.punchOut) : undefined;
  const inMin = inDate ? minutesOf(inDate) : undefined;
  const outMin = outDate ? minutesOf(outDate) : undefined;
  const nowMin = minutesOf(now);
  const isWeekOff = (SHIFT_POLICY.weekOffDays as readonly number[]).includes(now.getDay());
  const holidayToday = holidays.find(h => h.holidayDate === todayIso);
  const late = inMin !== undefined && inMin > GRACE_END;
  const workedMin = inMin !== undefined ? Math.max(0, (outMin ?? nowMin) - inMin) : 0;
  const fullAt = inMin !== undefined ? inMin + SHIFT_POLICY.fullDayHours * 60 : undefined;
  const firstName = (currentUser?.fullName ?? '').replace(/^Dr\.?\s+/i, '').split(' ')[0];

  let status: { title: string; detail: string };
  if (outMin !== undefined) {
    const credit = workedMin >= SHIFT_POLICY.fullDayHours * 60 ? 'a full day' : workedMin >= SHIFT_POLICY.halfDayHours * 60 ? 'a half day' : 'less than a half day';
    status = { title: `Day complete: ${hoursLabel(workedMin)}`, detail: `In at ${clock(inMin!)}, out at ${clock(outMin)}. Counts as ${credit}.` };
  } else if (inMin !== undefined) {
    status = {
      title: `Working for ${hoursLabel(workedMin)}`,
      detail: `In at ${clock(inMin)}${late ? ', marked late' : ', on time'}. A full day is earned at ${clock(fullAt!)}.`
    };
  } else if (holidayToday) {
    status = { title: `Holiday: ${holidayToday.name}`, detail: 'If you work today, punch in and claim comp-off or overtime.' };
  } else if (isWeekOff) {
    status = { title: 'Weekly off', detail: 'If you work today, punch in and claim comp-off or overtime.' };
  } else {
    status = {
      title: nowMin > GRACE_END ? 'Not punched in yet' : 'Ready when you are',
      detail:
        nowMin > GRACE_END
          ? `Punching in now counts as a late mark. Every ${ATTENDANCE_POLICY.lateMarksPerHalfDayLop} late marks cost half a day.`
          : `Shift starts ${SHIFT_POLICY.startTime}. Punch in by ${clock(GRACE_END)} to be on time.`
    };
  }

  const dayLabel = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-[26px] sm:text-[30px] font-semibold text-slate-900 dark:text-slate-50">
          {greeting(now)}, {firstName}
        </h1>
        <p className="mt-1 text-[15px] text-slate-500 dark:text-slate-400">
          {currentUser?.designation}
          {currentUser?.departmentName ? `, ${currentUser.departmentName}` : ''}
        </p>
      </div>

      {/* Today's workday */}
      <section className={`${cardClass} overflow-hidden`} aria-labelledby="today-heading">
        <div className="p-5 sm:p-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13.5px] text-slate-500 dark:text-slate-400">
              <Clock className="h-4 w-4" aria-hidden />
              <span id="today-heading">{dayLabel}</span>
              {inMin !== undefined && outMin === undefined && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 text-[12.5px] font-semibold text-teal-800 dark:text-teal-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> On shift
                </span>
              )}
              {late && (
                <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[12.5px] font-semibold text-amber-800 dark:text-amber-300">
                  Late mark
                </span>
              )}
            </div>
            <h2 className="mt-2 text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50 tabular">{status.title}</h2>
            <p className="mt-1 text-[15px] text-slate-600 dark:text-slate-300 max-w-[60ch]">{status.detail}</p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:w-52">
            {inMin === undefined ? (
              <button
                type="button"
                onClick={() => handlePunch('IN')}
                disabled={punching}
                className="h-12 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                {punching ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-[18px] w-[18px]" />}
                {punching ? 'Recording' : 'Punch in'}
              </button>
            ) : outMin === undefined ? (
              <button
                type="button"
                onClick={() => handlePunch('OUT')}
                disabled={punching}
                className="h-12 px-5 rounded-xl bg-ink hover:bg-ink-soft dark:bg-white dark:text-ink dark:hover:bg-slate-200 disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                {punching ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-[18px] w-[18px]" />}
                {punching ? 'Recording' : 'Punch out'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveNav('attendance')}
                className="h-12 px-5 rounded-xl border border-slate-300 dark:border-slate-700 text-[15px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-2"
              >
                View attendance
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveNav('attendance')}
              className="text-[13.5px] font-medium text-teal-700 dark:text-teal-300 hover:underline underline-offset-2"
            >
              Wrong time? Request a time update
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-5 sm:px-6 pt-5 pb-3">
          <WorkdayLine inMin={inMin} outMin={outMin} nowMin={nowMin} />
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-slate-200 dark:bg-slate-700" /> Shift {SHIFT_POLICY.startTime}–{SHIFT_POLICY.endTime}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-amber-200 dark:bg-amber-500/40" /> {SHIFT_POLICY.graceMinutes} min grace
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-teal-500" /> Time worked
            </span>
            {currentUser?.employmentType === 'FIELD' && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> Location is saved with each punch
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave */}
        <section className={`${cardClass} lg:col-span-2 p-5 sm:p-6`} aria-labelledby="leave-heading">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="leave-heading" className="text-[17px] font-semibold text-slate-900 dark:text-slate-100">
                Leave balance
              </h2>
              <p className="text-[13.5px] text-slate-500 dark:text-slate-400">
                {pendingLeave > 0
                  ? `${pendingLeave} ${pendingLeave === 1 ? 'request is' : 'requests are'} waiting for approval.`
                  : 'Days available this financial year.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('apply-leave')}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden /> Apply
            </button>
          </div>

          {balances.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">No leave balances yet. HR sets these up when you join.</p>
          ) : (
            <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800">
              {balances.map(b => (
                <div key={b.id} className="bg-white dark:bg-slate-900 px-4 py-3.5">
                  <dt className="text-[13px] text-slate-500 dark:text-slate-400 truncate" title={b.leaveTypeName}>
                    {b.leaveTypeName}
                  </dt>
                  <dd className="mt-1 font-display text-[26px] leading-none font-semibold text-slate-900 dark:text-slate-50 tabular">
                    {b.available}
                  </dd>
                  <dd className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400 tabular">
                    {b.used} used{b.reserved > 0 ? `, ${b.reserved} pending` : ''}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <button
            type="button"
            onClick={() => setActiveNav('leave-requests')}
            className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-teal-700 dark:text-teal-300 hover:underline underline-offset-2"
          >
            See my leave requests <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </section>

        <div className="space-y-6">
          {/* Payslip */}
          <button
            type="button"
            onClick={() => setActiveNav('payslips')}
            className={`${cardClass} w-full p-5 text-left flex items-center gap-4 hover:border-teal-300 dark:hover:border-teal-700 transition-colors`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                {latestPayslip ? `${getMonthName(latestPayslip.month)} ${latestPayslip.year} payslip` : 'Payslips'}
              </span>
              <span className="block text-[13px] text-slate-500 dark:text-slate-400">
                {latestPayslip ? 'Ready to view and download' : 'Published payslips appear here'}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden />
          </button>

          {/* Holidays */}
          <section className={`${cardClass} p-5`} aria-labelledby="holidays-heading">
            <h2 id="holidays-heading" className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Palmtree className="h-4 w-4 text-slate-400" aria-hidden /> Coming up
            </h2>
            {holidays.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No holidays left on the calendar this year.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {holidays.map(h => {
                  const d = new Date(h.holidayDate + 'T00:00:00');
                  return (
                    <li key={h.id} className="flex items-center gap-3">
                      <span className="w-11 shrink-0 rounded-md border border-slate-200 dark:border-slate-700 text-center leading-none py-1">
                        <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">{getMonthName(d.getMonth() + 1, true)}</span>
                        <span className="block font-display text-[15px] font-semibold text-slate-900 dark:text-slate-100 tabular">{d.getDate()}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{h.name}</span>
                        <span className="block text-[12.5px] text-slate-500 dark:text-slate-400">
                          {d.toLocaleDateString('en-IN', { weekday: 'long' })}
                          {h.isOptional ? ', optional' : ''}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
