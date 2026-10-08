import { Holiday } from '../types';

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function getTodayIsoString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(val?: string | Date | null): string {
  if (!val) return '—';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDateTime(val?: string | Date | null): string {
  if (!val) return '—';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '—';
  const dateStr = formatDate(d);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');
  return `${dateStr}, ${strHours}:${minutes} ${ampm}`;
}

export function formatTime(val?: string | Date | null): string {
  if (!val) return '—';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) {
    if (typeof val === 'string' && val.includes(':')) {
      const parts = val.split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
    }
    return '—';
  }
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

export function getMonthName(monthNumber: number, short = false): string {
  const idx = Math.max(0, Math.min(11, monthNumber - 1));
  return short ? MONTH_NAMES_SHORT[idx] : MONTH_NAMES_FULL[idx];
}

export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateLeaveDays(
  fromDateStr: string,
  toDateStr: string,
  arg3?: any,
  arg4?: any,
  arg5?: any,
  arg6?: any
): {
  totalDays: number;
  workingDays: number;
  weekendDays: number;
  holidayDays: number;
  breakdown: { date: string; isHoliday: boolean; isSunday: boolean }[];
} {
  if (!fromDateStr || !toDateStr) {
    return { totalDays: 0, workingDays: 0, weekendDays: 0, holidayDays: 0, breakdown: [] };
  }

  const start = new Date(fromDateStr);
  const end = new Date(toDateStr);

  if (start > end) {
    return { totalDays: 0, workingDays: 0, weekendDays: 0, holidayDays: 0, breakdown: [] };
  }

  let holidaysSet = new Set<string>();
  let sandwichRule = false;
  let fromHalf: 'FIRST_HALF' | 'SECOND_HALF' | null = null;
  let toHalf: 'FIRST_HALF' | 'SECOND_HALF' | null = null;

  // Detect signature variant:
  // Variant A: (fromDate, toDate, holidayDatesArray, sandwichRule, fromHalf, toHalf)
  if (Array.isArray(arg3)) {
    arg3.forEach((item: any) => {
      if (typeof item === 'string') holidaysSet.add(item);
      else if (item && item.holidayDate) holidaysSet.add(item.holidayDate);
    });
    sandwichRule = Boolean(arg4);
    fromHalf = arg5 || null;
    toHalf = arg6 || null;
  }
  // Variant B: (fromDate, toDate, fromHalf, toHalf, holidaysArray)
  else {
    fromHalf = arg3 || null;
    toHalf = arg4 || null;
    if (Array.isArray(arg5)) {
      arg5.forEach((item: any) => {
        if (typeof item === 'string') holidaysSet.add(item);
        else if (item && item.holidayDate) holidaysSet.add(item.holidayDate);
      });
    }
    sandwichRule = Boolean(arg6);
  }

  const breakdown: { date: string; isHoliday: boolean; isSunday: boolean }[] = [];
  let current = new Date(start);
  let workingDays = 0;
  let weekendDays = 0;
  let holidayDays = 0;

  while (current <= end) {
    const isoDate = toISODate(current);
    const dayOfWeek = current.getDay();
    const isSunday = dayOfWeek === 0;
    const isHoliday = holidaysSet.has(isoDate);

    breakdown.push({
      date: isoDate,
      isHoliday,
      isSunday
    });

    if (isSunday) {
      weekendDays += 1;
    } else if (isHoliday) {
      holidayDays += 1;
    } else {
      workingDays += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  let total = sandwichRule ? (workingDays + weekendDays + holidayDays) : workingDays;

  // Apply half days if first/last days are counted
  const firstDay = breakdown[0];
  if ((sandwichRule || (!firstDay.isSunday && !firstDay.isHoliday)) && fromHalf) {
    total -= 0.5;
  }

  if (breakdown.length > 1) {
    const lastDay = breakdown[breakdown.length - 1];
    if ((sandwichRule || (!lastDay.isSunday && !lastDay.isHoliday)) && toHalf) {
      total -= 0.5;
    }
  }

  return {
    totalDays: Math.max(0, total),
    workingDays,
    weekendDays,
    holidayDays,
    breakdown
  };
}

export const calculateLeaveDuration = calculateLeaveDays;
