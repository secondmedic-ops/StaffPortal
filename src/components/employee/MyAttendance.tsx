import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { meApi } from '../../api';
import { AttendanceRecord, Holiday, LeaveRequest } from '../../types';
import { formatTime, formatDate, getMonthName, getTodayIsoString } from '../../utils/dateUtils';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  HelpCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

interface SelectedDayState {
  dateStr: string;
  record?: AttendanceRecord;
  holiday?: Holiday;
  leave?: LeaveRequest;
  isSunday: boolean;
  isFuture: boolean;
  category: 'PRESENT' | 'HALF_DAY' | 'ON_LEAVE' | 'LEAVE_PENDING' | 'WEEK_OFF' | 'HOLIDAY' | 'ABSENT' | 'UPCOMING';
  statusLabel: string;
}

export const MyAttendance: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const todayDate = new Date();
  const [month, setMonth] = useState(todayDate.getMonth() + 1);
  const [year, setYear] = useState(todayDate.getFullYear());
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [selectedDay, setSelectedDay] = useState<SelectedDayState | null>(null);

  // Regularization modal state
  const [showRegModal, setShowRegModal] = useState(false);
  const [regInTime, setRegInTime] = useState('09:30 AM');
  const [regOutTime, setRegOutTime] = useState('06:30 PM');
  const [regReason, setRegReason] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const [att, cal] = await Promise.all([
        meApi.getAttendance(month, year),
        meApi.getCalendar(month, year)
      ]);
      setAttendanceList(att);
      setHolidays(cal.holidays || []);
      setMyLeaves(cal.myLeaves || []);
    } catch (err: any) {
      showToast('Attendance Error', err.message || 'Failed to load attendance records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [month, year, currentUser?.id]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  const todayStr = getTodayIsoString();
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 is Sun

  // Compute month metrics taking regular leaves, holidays and week offs into account
  let presentDays = 0;
  let halfDays = 0;
  let leaveDays = 0;
  let absentDays = 0;
  let weekOffs = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isSunday = new Date(year, month - 1, d).getDay() === 0;
    const holiday = holidays.find(h => h.holidayDate === dateStr);
    const approvedLeave = myLeaves.find(l => l.status === 'APPROVED' && dateStr >= l.fromDate && dateStr <= l.toDate);
    const record = attendanceList.find(a => a.workDate === dateStr);
    const isPastOrToday = dateStr <= todayStr;

    if (record) {
      if (record.status === 'PRESENT') presentDays++;
      else if (record.status === 'HALF_DAY') halfDays++;
      else if (record.status === 'ON_LEAVE') leaveDays++;
      else if (record.status === 'WEEK_OFF') weekOffs++;
      else if (record.status === 'ABSENT') {
        if (approvedLeave) leaveDays++;
        else absentDays++;
      }
    } else if (holiday) {
      // Company holiday (paid non-working day)
    } else if (isSunday) {
      weekOffs++;
    } else if (approvedLeave) {
      leaveDays++;
    } else if (isPastOrToday) {
      absentDays++;
    }
  }

  const submitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;
    if (!regReason.trim()) {
      showToast('Validation Error', 'Please provide a valid reason for regularization', 'error');
      return;
    }

    setSubmittingReg(true);
    try {
      await meApi.requestRegularization({
        workDate: selectedDay.dateStr,
        requestedIn: regInTime,
        requestedOut: regOutTime,
        reason: regReason
      });
      showToast(
        'Regularization Requested',
        `Request submitted to reporting manager for ${formatDate(selectedDay.dateStr)}`,
        'success'
      );
      setShowRegModal(false);
      setRegReason('');
      fetchAttendance();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to submit regularization', 'error');
    } finally {
      setSubmittingReg(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">My Attendance Register</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Official monthly attendance ledger with punch timestamps, regular leaves, and company holidays
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200 min-w-36 text-center border border-slate-200/60 dark:border-slate-700/60">
            {getMonthName(month)} {year}
          </div>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium">Present Days</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{presentDays}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium">Half Days</div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">{halfDays}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium">Leave Days</div>
          <div className="text-xl font-bold text-sky-700 dark:text-sky-400 mt-1">{leaveDays}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium">Absent (LOP)</div>
          <div className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">{absentDays}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium">Week-Offs</div>
          <div className="text-xl font-bold text-slate-600 dark:text-slate-300 mt-1">{weekOffs}</div>
        </div>
      </div>

      {/* Colour-coded Calendar Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50/80 dark:bg-slate-850 p-3 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors">
        <span className="font-semibold text-slate-600 dark:text-slate-300">Colour Codes:</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Present</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500" /> Absent</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> Half-Day</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500" /> Regular Leave</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400" /> Week-Off</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500" /> Company Holiday</span>
        <span className="text-[12.5px] text-slate-400 dark:text-slate-500 ml-auto hidden sm:inline">Click any day to view details or request regularization</span>
      </div>

      {/* Monthly Grid Calendar */}
      {loading ? (
        <SkeletonLoader rows={5} />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition-colors">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-center text-xs font-bold text-slate-600 dark:text-slate-300 py-2.5">
            <span className="text-rose-600 dark:text-rose-400">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
            {/* Empty cells before month start */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-24 bg-slate-50/40 dark:bg-slate-950/40 p-2" />
            ))}

            {/* Days in current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const record = attendanceList.find(a => a.workDate === dateStr);
              const holiday = holidays.find(h => h.holidayDate === dateStr);
              const approvedLeave = myLeaves.find(l => l.status === 'APPROVED' && dateStr >= l.fromDate && dateStr <= l.toDate);
              const pendingLeave = myLeaves.find(l => l.status === 'PENDING' && dateStr >= l.fromDate && dateStr <= l.toDate);
              const dayOfWeek = new Date(year, month - 1, day).getDay();
              const isSunday = dayOfWeek === 0;
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;

              // Status determination
              let badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
              let statusLabel = '—';
              let category: SelectedDayState['category'] = 'UPCOMING';

              if (holiday) {
                badgeColor = 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800';
                statusLabel = holiday.name;
                category = 'HOLIDAY';
              } else if (approvedLeave) {
                badgeColor = 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800';
                statusLabel = `Leave (${approvedLeave.leaveTypeCode || 'Approved'})`;
                category = 'ON_LEAVE';
              } else if (pendingLeave) {
                badgeColor = 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
                statusLabel = `${pendingLeave.leaveTypeCode || 'Leave'} (Pending)`;
                category = 'LEAVE_PENDING';
              } else if (record) {
                if (record.status === 'PRESENT') {
                  badgeColor = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                  statusLabel = 'Present';
                  category = 'PRESENT';
                } else if (record.status === 'HALF_DAY') {
                  badgeColor = 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                  statusLabel = 'Half Day';
                  category = 'HALF_DAY';
                } else if (record.status === 'ON_LEAVE') {
                  badgeColor = 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800';
                  statusLabel = 'Leave';
                  category = 'ON_LEAVE';
                } else if (record.status === 'WEEK_OFF') {
                  badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
                  statusLabel = 'Week Off';
                  category = 'WEEK_OFF';
                } else if (record.status === 'ABSENT') {
                  badgeColor = 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                  statusLabel = 'Absent';
                  category = 'ABSENT';
                }
              } else if (isSunday) {
                badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
                statusLabel = 'Week Off';
                category = 'WEEK_OFF';
              } else if (isFuture) {
                badgeColor = 'bg-slate-50/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-800';
                statusLabel = 'Upcoming';
                category = 'UPCOMING';
              } else {
                badgeColor = 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                statusLabel = 'Absent';
                category = 'ABSENT';
              }

              return (
                <div
                  key={dateStr}
                  onClick={() =>
                    setSelectedDay({
                      dateStr,
                      record,
                      holiday,
                      leave: approvedLeave || pendingLeave,
                      isSunday,
                      isFuture,
                      category,
                      statusLabel
                    })
                  }
                  className={`min-h-24 p-2 cursor-pointer transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-950/30 flex flex-col justify-between ${
                    isToday ? 'ring-2 ring-teal-600 ring-inset bg-teal-50/20 dark:bg-teal-950/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        isToday
                          ? 'h-6 w-6 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center font-bold'
                          : isSunday
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {day}
                    </span>
                    {record?.isRegularized && (
                      <span className="text-[11.5px] font-bold px-1 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800" title="Regularized">
                        REG
                      </span>
                    )}
                  </div>

                  <div className="mt-1">
                    <div className={`text-[11.5px] font-medium px-1.5 py-0.5 rounded border truncate ${badgeColor}`}>
                      {statusLabel}
                    </div>

                    {record?.punchIn && (
                      <div className="text-[11.5px] font-mono text-slate-500 dark:text-slate-400 mt-1 truncate">
                        {formatTime(record.punchIn)} {record.punchOut ? `– ${formatTime(record.punchOut)}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      {selectedDay && (
        <Modal
          isOpen={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          title={`Attendance Details: ${formatDate(selectedDay.dateStr)}`}
          subtitle={`Employee: ${currentUser?.fullName} (${currentUser?.empCode})`}
        >
          <div className="space-y-4">
            {/* Status overview pill */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Day Status:</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border shadow-2xs">
                {selectedDay.category === 'HOLIDAY' && (
                  <span className="text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800">
                    🎉 Company Holiday
                  </span>
                )}
                {selectedDay.category === 'ON_LEAVE' && (
                  <span className="text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800">
                    🌴 Approved Leave ({selectedDay.leave?.leaveTypeCode || 'LEAVE'})
                  </span>
                )}
                {selectedDay.category === 'LEAVE_PENDING' && (
                  <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800">
                    ⏳ Leave Pending Approval
                  </span>
                )}
                {selectedDay.category === 'WEEK_OFF' && (
                  <span className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    ☕ Weekly Off (Sunday)
                  </span>
                )}
                {selectedDay.category === 'UPCOMING' && (
                  <span className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800">
                    📅 Upcoming Work Day
                  </span>
                )}
                {selectedDay.category === 'PRESENT' && (
                  <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800">
                    ✓ Present
                  </span>
                )}
                {selectedDay.category === 'HALF_DAY' && (
                  <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800">
                    ½ Half Day
                  </span>
                )}
                {selectedDay.category === 'ABSENT' && (
                  <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800">
                    ✕ Absent / No Punch
                  </span>
                )}
              </span>
            </div>

            {/* Context Card based on category */}
            {selectedDay.category === 'HOLIDAY' && selectedDay.holiday && (
              <div className="p-3.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/40 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                <div className="font-bold text-sm text-purple-950 dark:text-purple-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  {selectedDay.holiday.name}
                </div>
                <p className="text-[12px] text-purple-700 dark:text-purple-300">
                  Official gazetted company holiday on the SecondMedic holiday calendar. This is a fully paid non-working day for all staff.
                </p>
              </div>
            )}

            {(selectedDay.category === 'ON_LEAVE' || selectedDay.category === 'LEAVE_PENDING') && selectedDay.leave && (
              <div className="p-3.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-950/40 text-xs space-y-2">
                <div className="font-bold text-sm text-sky-950 dark:text-sky-100 flex items-center justify-between">
                  <span>{selectedDay.leave.leaveTypeName || selectedDay.leave.leaveTypeCode}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-200/80 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
                    {selectedDay.leave.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 text-[12px]">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Duration:</span>
                    <span className="font-medium font-mono">{formatDate(selectedDay.leave.fromDate)} – {formatDate(selectedDay.leave.toDate)} ({selectedDay.leave.totalDays} day/s)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Approver:</span>
                    <span className="font-medium">{selectedDay.leave.currentApproverName || 'Reporting Authority'}</span>
                  </div>
                </div>
                {selectedDay.leave.reason && (
                  <div className="pt-1 text-[12px] text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Reason: </span>
                    {selectedDay.leave.reason}
                  </div>
                )}
              </div>
            )}

            {selectedDay.category === 'WEEK_OFF' && (
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200">Scheduled Weekly Off</div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Under SecondMedic shift policy, Sunday is a scheduled weekly off day.
                </p>
              </div>
            )}

            {selectedDay.category === 'UPCOMING' && (
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200">Upcoming Working Day</div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Standard working shift: 09:30 AM – 06:00 PM. Punch in via mobile app or web portal when you begin your shift.
                </p>
              </div>
            )}

            {/* Attendance Punch Timestamps */}
            {selectedDay.record && (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850">
                    <span className="text-slate-500 dark:text-slate-400 block">Punch In</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5 block">
                      {selectedDay.record.punchIn ? formatTime(selectedDay.record.punchIn) : '—'}
                    </span>
                    {selectedDay.record.inSource && (
                      <span className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-1 block">
                        Source: {selectedDay.record.inSource}
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850">
                    <span className="text-slate-500 dark:text-slate-400 block">Punch Out</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5 block">
                      {selectedDay.record.punchOut ? formatTime(selectedDay.record.punchOut) : '—'}
                    </span>
                    {selectedDay.record.workedHours !== undefined && (
                      <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium mt-1 block">
                        Worked: {selectedDay.record.workedHours} hrs
                      </span>
                    )}
                  </div>
                </div>

                {selectedDay.record.inLat && (
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 text-[12.5px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                    <span>
                      Geotagged Lat: {selectedDay.record.inLat}, Lng: {selectedDay.record.inLng}
                    </span>
                  </div>
                )}

                {selectedDay.record.remarks && (
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-0.5">Remarks:</span>
                    {selectedDay.record.remarks}
                  </div>
                )}
              </>
            )}

            {/* Absent prompt */}
            {selectedDay.category === 'ABSENT' && (
              <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  No Punch or Leave Registered
                </div>
                <p className="text-[12px] leading-relaxed">
                  No biometric punch, web check-in, or regular approved leave was recorded for this past working date. Unregularized absences result in Loss of Pay (LOP) deductions during monthly payroll closing.
                </p>
              </div>
            )}

            {/* Action to regularize (available on Absent days or working records) */}
            {(selectedDay.category === 'ABSENT' || selectedDay.category === 'HALF_DAY' || selectedDay.record) && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="text-[12.5px] text-slate-500 dark:text-slate-400">
                  Missed a punch or network issue?
                </span>
                <button
                  onClick={() => setShowRegModal(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors"
                >
                  Request Regularization
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Regularization Request Form Modal */}
      {showRegModal && selectedDay && (
        <Modal
          isOpen={showRegModal}
          onClose={() => setShowRegModal(false)}
          title="Attendance Regularization Request"
          subtitle={`Date: ${formatDate(selectedDay.dateStr)} • Forwarded to Reporting Authority`}
        >
          <form onSubmit={submitRegularization} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expected In Time
                </label>
                <input
                  type="text"
                  value={regInTime}
                  onChange={e => setRegInTime(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono"
                  placeholder="09:30 AM"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expected Out Time
                </label>
                <input
                  type="text"
                  value={regOutTime}
                  onChange={e => setRegOutTime(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono"
                  placeholder="06:30 PM"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Missed Punch / Discrepancy <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={regReason}
                onChange={e => setRegReason(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                placeholder="Describe reason (e.g. phlebotomy rural route network outage, biometric terminal maintenance)..."
                required
              />
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[12.5px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Regularization requests are audited and sent directly to your Reporting Authority ({currentUser?.managerName || 'Manager'}). Approved requests adjust your payable days for payroll.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRegModal(false)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReg}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {submittingReg ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
