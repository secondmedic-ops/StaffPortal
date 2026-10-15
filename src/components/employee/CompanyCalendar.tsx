import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { meApi } from '../../api';
import { Holiday, LeaveRequest } from '../../types';
import { formatDate, getMonthName } from '../../utils/dateUtils';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Lock } from 'lucide-react';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const CompanyCalendar: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(9); // September
  const [year, setYear] = useState(2026);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<Array<{ employeeName: string; fromDate: string; toDate: string; totalDays: number }>>([]);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const data = await meApi.getCalendar(month, year);
      setHolidays(data.holidays);
      setMyLeaves(data.myLeaves);
      setTeamLeaves(data.teamLeaves);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load calendar', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
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

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">Organization & Team Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Official gazetted holidays and team availability schedule
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200 min-w-36 text-center">
            {getMonthName(month)} {year}
          </div>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-teal-700 dark:text-teal-300 flex-shrink-0" />
          <span>
            <strong>Peer Privacy Policy:</strong> Teammate availability displays names only. Medical and personal leave reasons are strictly confidential to reporting managers.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[12.5px] font-medium">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Holiday</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> My Leave</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Team Out</span>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <SkeletonLoader rows={5} />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-center text-xs font-bold text-slate-600 dark:text-slate-400 py-2.5">
            <span className="text-rose-600 dark:text-rose-400">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
            {/* Empty prefix days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`cal-empty-${i}`} className="min-h-28 bg-slate-50/40 dark:bg-slate-800/50 p-2" />
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const holiday = holidays.find(h => h.holidayDate === dateStr);
              const myLeaveToday = myLeaves.find(l => dateStr >= l.fromDate && dateStr <= l.toDate);
              const teammatesOut = teamLeaves.filter(tl => dateStr >= tl.fromDate && dateStr <= tl.toDate);

              const isToday = dateStr === '2026-09-12';

              return (
                <div
                  key={dateStr}
                  className={`min-h-28 p-2 flex flex-col justify-between transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/50 ${
                    isToday ? 'bg-teal-50/20 dark:bg-teal-950/40 ring-1 ring-teal-600 ring-inset' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        isToday
                          ? 'h-6 w-6 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {day}
                    </span>
                  </div>

                  <div className="space-y-1 mt-1">
                    {/* Holiday badge */}
                    {holiday && (
                      <div
                        className="text-[11.5px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/70 truncate"
                        title={holiday.name}
                      >
                        🎉 {holiday.name}
                      </div>
                    )}

                    {/* My Leave */}
                    {myLeaveToday && (
                      <div
                        className="text-[11.5px] font-medium px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/70 truncate"
                        title={`My Leave: ${myLeaveToday.leaveTypeCode}`}
                      >
                        Me: {myLeaveToday.leaveTypeCode} ({myLeaveToday.status})
                      </div>
                    )}

                    {/* Teammates out */}
                    {teammatesOut.map((t, idx) => (
                      <div
                        key={idx}
                        className="text-[11.5px] font-medium px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/70 truncate flex items-center gap-1"
                        title={`${t.employeeName} on approved leave`}
                      >
                        <Users className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{t.employeeName.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
