import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Hourglass,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Palmtree,
  TimerOff,
  TrendingDown,
  TrendingUp,
  UsersRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { meApi, compensationApi } from '../../api';
import { AttendanceRecord, LeaveBalance, Holiday, LeaveRequest } from '../../types';
import { formatTime, getTodayIsoString, getMonthName, toISODate } from '../../utils/dateUtils';
import { SHIFT_POLICY, ATTENDANCE_POLICY } from '../../config/policy';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { StatusPill } from '../common/StatusPill';
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

const WEEK_OFF = SHIFT_POLICY.weekOffDays as readonly number[];
const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
/** "20 Oct", with the year only when it isn't this year. */
const shortDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {})
  });
};
const firstOf = (name: string) => name.replace(/^Dr\.?\s+/i, '').split(' ')[0];
const isoAdd = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const CardHeader: React.FC<{ title: string; id?: string; action?: React.ReactNode; subtitle?: string }> = ({ title, id, action, subtitle }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <h2 id={id} className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-[12.5px] text-slate-400">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const LinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="shrink-0 inline-flex items-center gap-0.5 text-[12.5px] font-medium text-slate-400 hover:text-teal-600 dark:hover:text-teal-300"
  >
    {children} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
  </button>
);

type Trend = { label: string; tone: 'up' | 'down' | 'flat' };

const TREND_TONE: Record<Trend['tone'], string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-rose-600 dark:text-rose-400',
  flat: 'text-slate-400'
};

const StatTile: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  total?: React.ReactNode;
  trend?: Trend;
  onClick?: () => void;
}> = ({ icon: Icon, label, value, total, trend, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${cardClass} group p-5 text-left flex flex-col justify-between min-h-[148px] hover:-translate-y-0.5 hover:shadow-lift transition-all`}
  >
    <span className="flex items-start justify-between gap-2">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 group-hover:border-teal-300 group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
      </span>
      {trend && (
        <span className={`inline-flex items-center gap-1 text-[12px] font-medium text-right ${TREND_TONE[trend.tone]}`}>
          {trend.tone === 'up' && <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          {trend.tone === 'down' && <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          {trend.label}
        </span>
      )}
    </span>
    <span className="mt-4 block">
      <span className="block text-[13.5px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="mt-1 block font-display tabular text-slate-900 dark:text-slate-50">
        <span className="text-[26px] leading-none font-semibold">{value}</span>
        {total !== undefined && <span className="text-[15px] text-slate-400">/{total}</span>}
      </span>
    </span>
  </button>
);

/** Progress ring: today's hours against a full day. */
const Ring: React.FC<{ value: number; max: number; size?: number; children?: React.ReactNode }> = ({ value, max, size = 148, children }) => {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className={`${frac >= 1 ? 'stroke-emerald-500' : 'stroke-teal-600'} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};

/** Donut of how this month's days were spent. */
const Donut: React.FC<{ parts: { label: string; value: number; color: string }[]; size?: number; children?: React.ReactNode }> = ({
  parts,
  size = 150,
  children
}) => {
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0);
  const gap = total > 0 && parts.filter(p => p.value > 0).length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-slate-800" />
        {total > 0 &&
          parts.map(p => {
            if (p.value <= 0) return null;
            const len = (p.value / total) * c;
            const el = (
              <circle
                key={p.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={stroke}
                stroke={p.color}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

type DayEvent = { kind: 'holiday' | 'leave' | 'pending' | 'team'; label: string };

const EVENT_STYLE: Record<DayEvent['kind'], { dot: string; fill: string; label: string }> = {
  holiday: { dot: 'bg-violet-500', fill: 'bg-violet-500 text-white', label: 'Holiday' },
  leave: { dot: 'bg-teal-600', fill: 'bg-teal-600 text-white', label: 'My leave' },
  pending: { dot: 'bg-amber-400', fill: 'bg-amber-400 text-white', label: 'Leave pending' },
  team: { dot: 'bg-rose-500', fill: '', label: 'Team away' }
};

const MiniCalendar: React.FC<{
  holidays: Holiday[];
  myLeaves: LeaveRequest[];
  teamLeaves: { employeeName: string; fromDate: string; toDate: string }[];
  todayIso: string;
}> = ({ holidays, myLeaves, teamLeaves, todayIso }) => {
  const today = new Date(todayIso + 'T00:00:00');
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(todayIso);

  const events = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const add = (iso: string, e: DayEvent) => map.set(iso, [...(map.get(iso) ?? []), e]);
    holidays.forEach(h => add(h.holidayDate, { kind: 'holiday', label: h.name + (h.isOptional ? ' (optional)' : '') }));
    const spread = (from: string, to: string, fn: (iso: string) => void) => {
      for (let d = from, i = 0; d <= to && i < 62; d = isoAdd(d, 1), i++) fn(d);
    };
    myLeaves.forEach(l =>
      spread(l.fromDate, l.toDate, iso =>
        add(iso, { kind: l.status === 'APPROVED' ? 'leave' : 'pending', label: `${l.leaveTypeName}${l.status === 'PENDING' ? ' (awaiting approval)' : ''}` })
      )
    );
    teamLeaves.forEach(t => spread(t.fromDate, t.toDate, iso => add(iso, { kind: 'team', label: `${t.employeeName} is away` })));
    return map;
  }, [holidays, myLeaves, teamLeaves]);

  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (delta: number) =>
    setView(v => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const selectedEvents = events.get(selected) ?? [];
  const selectedDate = new Date(selected + 'T00:00:00');

  return (
    <section className={`${cardClass} p-5`} aria-labelledby="calendar-heading">
      <div className="flex items-center justify-between">
        <h2 id="calendar-heading" className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
          Calendar
        </h2>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[13.5px] text-slate-500 dark:text-slate-400 tabular">
            {getMonthName(view.m + 1)} {view.y}
          </span>
          <button
            type="button"
            onClick={() => shift(-1)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-y-1 text-center">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="pb-1 text-[12.5px] font-medium text-slate-400">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const iso = toISODate(new Date(view.y, view.m, day));
          const evs = events.get(iso) ?? [];
          const main = evs.find(e => e.kind !== 'team');
          const isToday = iso === todayIso;
          const isSel = iso === selected;
          const off = WEEK_OFF.includes(new Date(view.y, view.m, day).getDay());
          const fill = isToday ? 'bg-teal-600 text-white shadow-primary' : main ? EVENT_STYLE[main.kind].fill : '';
          return (
            <div key={iso} className="flex justify-center">
              <button
                type="button"
                onClick={() => setSelected(iso)}
                aria-label={`${day} ${getMonthName(view.m + 1)}${evs.length ? `: ${evs.map(e => e.label).join(', ')}` : ''}`}
                aria-pressed={isSel}
                className={`relative h-9 w-9 rounded-full text-[13.5px] tabular transition-colors ${
                  fill ||
                  (off ? 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')
                } ${isSel && !isToday ? 'ring-2 ring-teal-300 dark:ring-teal-700' : ''}`}
              >
                {day}
                {evs.some(e => e.kind === 'team') && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-rose-500" aria-hidden />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-slate-500 dark:text-slate-400">
        {(Object.keys(EVENT_STYLE) as DayEvent['kind'][]).map(k => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${EVENT_STYLE[k].dot}`} aria-hidden /> {EVENT_STYLE[k].label}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3.5 py-3">
        <div className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
          {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        {selectedEvents.length === 0 ? (
          <p className="mt-0.5 text-[13.5px] text-slate-600 dark:text-slate-300">
            {WEEK_OFF.includes(selectedDate.getDay()) ? 'Weekly off' : 'Regular working day'}
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {selectedEvents.map((e, i) => (
              <li key={i} className="flex items-center gap-2 text-[13.5px] text-slate-700 dark:text-slate-200">
                <span className={`h-2 w-2 shrink-0 rounded-full ${EVENT_STYLE[e.kind].dot}`} aria-hidden />
                <span className="truncate">{e.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export const EmployeeDashboard: React.FC = () => {
  const { currentUser, setActiveNav, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<{ employeeName: string; fromDate: string; toDate: string; totalDays: number }[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [latestPayslip, setLatestPayslip] = useState<{ month: number; year: number; netPay: number } | null>(null);
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
      if (att.status === 'fulfilled') setMonthRecords(att.value);
      if (bal.status === 'fulfilled') setBalances(bal.value);
      if (cal.status === 'fulfilled') {
        setHolidays(cal.value.holidays);
        setMyLeaves(cal.value.myLeaves);
        setTeamLeaves(cal.value.teamLeaves);
      }
      if (req.status === 'fulfilled') setRequests([...req.value].sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? '')));
      if (slips.status === 'fulfilled') {
        const published = slips.value[0];
        setLatestPayslip(published ? { month: published.month, year: published.year, netPay: published.netPay } : null);
      }
      const failed = [att, bal, cal, req].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) showToast('Some details did not load', failed.reason?.message ?? 'Try refreshing the page.', 'error');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const todayRecord = monthRecords.find(a => a.workDate === todayIso) ?? null;

  const handlePunch = async (type: 'IN' | 'OUT') => {
    if (punching) return;
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
      setMonthRecords(prev => [...prev.filter(r => r.workDate !== updated.workDate), updated]);
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

  /* ---- Month figures ---- */
  const month = useMemo(() => {
    const holidaySet = new Set(holidays.filter(h => !h.isOptional).map(h => h.holidayDate));
    const today = new Date(todayIso + 'T00:00:00');
    let workingSoFar = 0;
    for (let d = 1; d <= today.getDate(); d++) {
      const date = new Date(today.getFullYear(), today.getMonth(), d);
      if (!WEEK_OFF.includes(date.getDay()) && !holidaySet.has(toISODate(date))) workingSoFar++;
    }
    let present = 0;
    let half = 0;
    let onLeave = 0;
    let absent = 0;
    let late = 0;
    let minutes = 0;
    let workedDays = 0;
    for (const r of monthRecords) {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'HALF_DAY') half++;
      else if (r.status === 'ON_LEAVE') onLeave++;
      else if (r.status === 'ABSENT' || r.status === 'LOP') absent++;
      if (r.punchIn && minutesOf(new Date(r.punchIn)) > GRACE_END) late++;
      const m = r.workedHours
        ? r.workedHours * 60
        : r.punchIn && r.punchOut
        ? (new Date(r.punchOut).getTime() - new Date(r.punchIn).getTime()) / 60000
        : 0;
      if (m > 0) {
        minutes += m;
        workedDays++;
      }
    }
    const presentDays = present + half / 2;
    const unmarked = Math.max(0, workingSoFar - present - half - onLeave - absent);
    return { workingSoFar, present, half, onLeave, absent, late, minutes, workedDays, presentDays, unmarked };
  }, [monthRecords, holidays, todayIso]);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] mx-auto space-y-6">
        <SkeletonLoader count={1} height="52px" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map(i => (
            <SkeletonLoader key={i} count={1} height="148px" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <SkeletonLoader count={1} height="300px" className="xl:col-span-2" />
          <SkeletonLoader count={1} height="300px" />
        </div>
      </div>
    );
  }

  /* ---- Today ---- */
  const inDate = todayRecord?.punchIn ? new Date(todayRecord.punchIn) : undefined;
  const outDate = todayRecord?.punchOut ? new Date(todayRecord.punchOut) : undefined;
  const inMin = inDate ? minutesOf(inDate) : undefined;
  const outMin = outDate ? minutesOf(outDate) : undefined;
  const nowMin = minutesOf(now);
  const isWeekOff = WEEK_OFF.includes(now.getDay());
  const holidayToday = holidays.find(h => h.holidayDate === todayIso);
  const late = inMin !== undefined && inMin > GRACE_END;
  const workedMin = inMin !== undefined ? Math.max(0, (outMin ?? nowMin) - inMin) : 0;
  const fullAt = inMin !== undefined ? inMin + SHIFT_POLICY.fullDayHours * 60 : undefined;
  const firstName = firstOf(currentUser?.fullName ?? '');

  let status: { title: string; detail: string };
  if (outMin !== undefined) {
    const credit = workedMin >= SHIFT_POLICY.fullDayHours * 60 ? 'a full day' : workedMin >= SHIFT_POLICY.halfDayHours * 60 ? 'a half day' : 'less than a half day';
    status = { title: 'Day complete', detail: `In at ${clock(inMin!)}, out at ${clock(outMin)}. Counts as ${credit}.` };
  } else if (inMin !== undefined) {
    status = {
      title: late ? 'On shift, marked late' : 'On shift',
      detail: `In at ${clock(inMin)}. A full day is earned at ${clock(fullAt!)}.`
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

  /* ---- Stat tiles ---- */
  const rate = month.workingSoFar > 0 ? Math.round((month.presentDays / month.workingSoFar) * 100) : 0;
  const totalLeave = balances.reduce((s, b) => s + b.opening + b.accrued, 0);
  const availableLeave = balances.reduce((s, b) => s + b.available, 0);
  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const perLop = ATTENDANCE_POLICY.lateMarksPerHalfDayLop;
  const lateToNext = perLop - (month.late % perLop);
  const hoursMonth = month.minutes / 60;
  const avgDay = month.workedDays > 0 ? hoursMonth / month.workedDays : 0;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  const mix = [
    { label: 'Present', value: month.present, color: 'var(--color-teal-600)' },
    { label: 'Half day', value: month.half, color: 'var(--color-teal-300)' },
    { label: 'On leave', value: month.onLeave, color: '#f59e0b' },
    { label: 'Absent', value: month.absent, color: '#f43f5e' },
    { label: 'Unmarked', value: month.unmarked, color: 'var(--color-slate-300)' }
  ];

  const upcoming = holidays.filter(h => h.holidayDate >= todayIso).slice(0, 4);
  const awayToday = teamLeaves.filter(t => t.fromDate <= todayIso && t.toDate >= todayIso);
  const awayLater = teamLeaves.filter(t => t.fromDate > todayIso).sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  const away = [...awayToday.map(t => ({ ...t, today: true })), ...awayLater.map(t => ({ ...t, today: false }))].slice(0, 5);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1440px] mx-auto space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-semibold text-slate-900 dark:text-slate-50">
            {greeting(now)}, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-[14px] text-slate-400">
            {currentUser?.designation}
            {currentUser?.departmentName ? ` · ${currentUser.departmentName}` : ''}
            {currentUser?.empCode ? ` · ${currentUser.empCode}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveNav('attendance')}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2"
          >
            <CalendarCheck className="h-4 w-4" aria-hidden /> My attendance
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('apply-leave')}
            className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium shadow-primary inline-flex items-center gap-2"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden /> Apply for leave
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatTile
              icon={CalendarCheck}
              label="Days present"
              value={fmt(month.presentDays)}
              total={month.workingSoFar}
              trend={{ label: `${rate}%`, tone: rate >= 90 ? 'up' : rate >= 75 ? 'flat' : 'down' }}
              onClick={() => setActiveNav('attendance')}
            />
            <StatTile
              icon={Palmtree}
              label="Leave available"
              value={fmt(availableLeave)}
              total={fmt(totalLeave)}
              trend={pendingCount > 0 ? { label: `${pendingCount} pending`, tone: 'flat' } : undefined}
              onClick={() => setActiveNav('leave-requests')}
            />
            <StatTile
              icon={TimerOff}
              label="Late marks"
              value={month.late}
              trend={{
                label: month.late === 0 ? 'On time' : `${lateToNext} to ½-day cut`,
                tone: month.late === 0 ? 'up' : lateToNext === 1 ? 'down' : 'flat'
              }}
              onClick={() => setActiveNav('attendance')}
            />
            <StatTile
              icon={Hourglass}
              label="Hours this month"
              value={`${Math.round(hoursMonth)}h`}
              trend={
                avgDay > 0
                  ? { label: `${avgDay.toFixed(1)}h/day`, tone: avgDay >= SHIFT_POLICY.fullDayHours ? 'up' : 'down' }
                  : undefined
              }
              onClick={() => setActiveNav('attendance')}
            />
          </div>

          {/* Today + month mix */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <section className={`${cardClass} lg:col-span-3 overflow-hidden`} aria-labelledby="today-heading">
              <div className="p-5 sm:p-6">
                <CardHeader
                  id="today-heading"
                  title="Today"
                  subtitle={now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  action={
                    <div className="flex items-center gap-1.5">
                      {inMin !== undefined && outMin === undefined && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                        </span>
                      )}
                      {late && (
                        <span className="rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                          Late mark
                        </span>
                      )}
                    </div>
                  }
                />
                <div className="mt-5 flex flex-col sm:flex-row items-center gap-6">
                  <Ring value={workedMin} max={SHIFT_POLICY.fullDayHours * 60} size={136}>
                    <span className="font-display text-[22px] font-semibold text-slate-900 dark:text-slate-50 tabular leading-none">
                      {hoursLabel(workedMin)}
                    </span>
                    <span className="mt-1 text-[12px] text-slate-400">of {SHIFT_POLICY.fullDayHours}h day</span>
                  </Ring>
                  <div className="min-w-0 flex-1 w-full text-center sm:text-left">
                    <h3 className="text-[19px] font-semibold text-slate-900 dark:text-slate-50">{status.title}</h3>
                    <p className="mt-1 text-[14px] text-slate-500 dark:text-slate-400">{status.detail}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2">
                      {inMin === undefined ? (
                        <button
                          type="button"
                          onClick={() => handlePunch('IN')}
                          disabled={punching}
                          className="h-11 px-6 whitespace-nowrap rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-60 text-white text-[14.5px] font-medium shadow-primary inline-flex items-center justify-center gap-2 transition-colors"
                        >
                          {punching ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-[18px] w-[18px]" />}
                          {punching ? 'Recording' : 'Punch in'}
                        </button>
                      ) : outMin === undefined ? (
                        <button
                          type="button"
                          onClick={() => handlePunch('OUT')}
                          disabled={punching}
                          className="h-11 px-6 whitespace-nowrap rounded-xl bg-ink hover:bg-ink-soft dark:bg-white dark:text-ink dark:hover:bg-slate-200 disabled:opacity-60 text-white text-[14.5px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
                        >
                          {punching ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-[18px] w-[18px]" />}
                          {punching ? 'Recording' : 'Punch out'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setActiveNav('attendance')}
                        className="text-[13px] font-medium text-teal-600 dark:text-teal-300 hover:underline underline-offset-2 sm:text-left"
                      >
                        Wrong time? Request a correction
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 px-5 sm:px-6 pt-5 pb-3">
                <WorkdayLine inMin={inMin} outMin={outMin} nowMin={nowMin} />
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-500 dark:text-slate-400">
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

            <section className={`${cardClass} lg:col-span-2 p-5 sm:p-6`} aria-labelledby="month-heading">
              <CardHeader
                id="month-heading"
                title="This month"
                subtitle={`${getMonthName(now.getMonth() + 1)} ${now.getFullYear()} · ${month.workingSoFar} working days so far`}
                action={<LinkButton onClick={() => setActiveNav('attendance')}>Details</LinkButton>}
              />
              <div className="mt-5 flex justify-center">
                <Donut parts={mix} size={140}>
                  <span className="font-display text-[26px] font-semibold text-slate-900 dark:text-slate-50 tabular leading-none">{rate}%</span>
                  <span className="mt-1 text-[11.5px] text-slate-400">attendance</span>
                </Donut>
              </div>
              <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {mix.map(p => (
                  <li key={p.label} className="flex items-center gap-2 text-[13px] min-w-0">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                    <span className="flex-1 truncate text-slate-500 dark:text-slate-400">{p.label}</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100 tabular">{p.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Requests + balances + payslip */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <section className={`${cardClass} lg:col-span-3 p-5 sm:p-6`} aria-labelledby="requests-heading">
              <CardHeader
                id="requests-heading"
                title="My leave requests"
                action={
                  <div className="hidden sm:flex items-center gap-3 text-[12px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Approved</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Rejected</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Pending</span>
                  </div>
                }
              />
              {requests.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-8 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">You haven't applied for leave yet.</p>
                  <button
                    type="button"
                    onClick={() => setActiveNav('apply-leave')}
                    className="mt-3 text-[13.5px] font-medium text-teal-600 dark:text-teal-300 hover:underline underline-offset-2"
                  >
                    Apply for leave
                  </button>
                </div>
              ) : (
                <div className="mt-4 -mx-2 overflow-x-auto">
                  <table className="w-full text-left text-[13.5px]">
                    <thead>
                      <tr className="text-[12.5px] text-slate-400">
                        <th className="px-2 py-2 font-medium">Type</th>
                        <th className="px-2 py-2 font-medium">Dates</th>
                        <th className="px-2 py-2 font-medium text-right">Days</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {requests.slice(0, 5).map(r => (
                        <tr key={r.id}>
                          <td className="px-2 py-3 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{r.leaveTypeName}</td>
                          <td className="px-2 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {shortDate(r.fromDate)}
                            {r.toDate !== r.fromDate ? ` – ${shortDate(r.toDate)}` : ''}
                          </td>
                          <td className="px-2 py-3 text-right text-slate-700 dark:text-slate-200">{r.totalDays}</td>
                          <td className="px-2 py-3 whitespace-nowrap">
                            <StatusPill status={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {requests.length > 0 && (
                <div className="mt-3">
                  <LinkButton onClick={() => setActiveNav('leave-requests')}>All requests</LinkButton>
                </div>
              )}
            </section>

            <div className="lg:col-span-2 space-y-6">
              <section className={`${cardClass} p-5 sm:p-6`} aria-labelledby="payslip-heading">
                <CardHeader id="payslip-heading" title="Salary slip" action={<LinkButton onClick={() => setActiveNav('payslips')}>All</LinkButton>} />
                <div className="mt-4 flex items-center gap-4">
                  <span className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500 text-white">
                      <FileText className="h-5 w-5" aria-hidden />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-medium text-slate-900 dark:text-slate-100">
                      {latestPayslip ? `${getMonthName(latestPayslip.month)} ${latestPayslip.year}` : 'No payslip yet'}
                    </div>
                    <div className="text-[12.5px] text-slate-400">
                      {latestPayslip ? `Net pay ${inr(latestPayslip.netPay)}` : 'Published payslips appear here'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('payslips')}
                  disabled={!latestPayslip}
                  className="mt-4 w-full h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 text-white text-sm font-medium inline-flex items-center justify-center gap-2 shadow-primary disabled:shadow-none"
                >
                  <Download className="h-4 w-4" aria-hidden /> View &amp; download
                </button>
              </section>

              <section className={`${cardClass} p-5 sm:p-6`} aria-labelledby="balance-heading">
                <CardHeader id="balance-heading" title="Leave balance" action={<LinkButton onClick={() => setActiveNav('apply-leave')}>Apply</LinkButton>} />
                {balances.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No leave balances yet. HR sets these up when you join.</p>
                ) : (
                  <ul className="mt-4 space-y-3.5">
                    {balances.map(b => {
                      const total = b.opening + b.accrued;
                      const pct = total > 0 ? Math.min(100, ((b.used + b.reserved) / total) * 100) : 0;
                      return (
                        <li key={b.id}>
                          <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                            <span className="truncate text-slate-600 dark:text-slate-300" title={b.leaveTypeName}>
                              {b.leaveTypeName}
                            </span>
                            <span className="tabular text-slate-400">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{b.available}</span> left
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" aria-hidden>
                            <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6 min-w-0">
          <MiniCalendar holidays={holidays} myLeaves={myLeaves} teamLeaves={teamLeaves} todayIso={todayIso} />

          <section className={`${cardClass} p-5`} aria-labelledby="away-heading">
            <CardHeader id="away-heading" title="Who's away" subtitle="Colleagues on approved leave this month" />
            {away.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 inline-flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-slate-400" aria-hidden /> Everyone's in this month.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {away.map((t, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950/60 text-[12.5px] font-semibold text-teal-700 dark:text-teal-300">
                      {t.employeeName
                        .replace(/^Dr\.?\s+/i, '')
                        .split(' ')
                        .map(p => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-slate-800 dark:text-slate-100 truncate">{t.employeeName}</span>
                      <span className="block text-[12px] text-slate-400">
                        {shortDate(t.fromDate)}
                        {t.toDate !== t.fromDate ? ` – ${shortDate(t.toDate)}` : ''} · {t.totalDays} {t.totalDays === 1 ? 'day' : 'days'}
                      </span>
                    </span>
                    {t.today && (
                      <span className="rounded-full bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 text-[11.5px] font-medium text-rose-600 dark:text-rose-300">Today</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${cardClass} p-5`} aria-labelledby="holidays-heading">
            <CardHeader id="holidays-heading" title="Upcoming holidays" action={<LinkButton onClick={() => setActiveNav('calendar')}>View all</LinkButton>} />
            {upcoming.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No holidays left on the calendar this year.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {upcoming.map(h => {
                  const d = new Date(h.holidayDate + 'T00:00:00');
                  return (
                    <li key={h.id} className="flex items-center gap-3">
                      <span className="w-11 shrink-0 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-center leading-none py-1.5">
                        <span className="block text-[11px] text-violet-500 dark:text-violet-300">{getMonthName(d.getMonth() + 1, true)}</span>
                        <span className="block font-display text-[16px] font-semibold text-violet-700 dark:text-violet-200 tabular">{d.getDate()}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium text-slate-800 dark:text-slate-100 truncate">{h.name}</span>
                        <span className="block text-[12px] text-slate-400">
                          {d.toLocaleDateString('en-IN', { weekday: 'long' })}
                          {h.isOptional ? ' · optional' : ''}
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
