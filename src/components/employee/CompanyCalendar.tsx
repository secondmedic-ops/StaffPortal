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
  }, [month, year, currentUser]);

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Organization & Team Calendar</h1>
          <p className="text-xs text-slate-500 mt-1">
            Official gazetted holidays and team availability schedule
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-xs text-slate-800 min-w-36 text-center">
            {getMonthName(month)} {year}
          </div>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-teal-700 flex-shrink-0" />
          <span>
            <strong>Peer Privacy Policy:</strong> Teammate availability displays names only. Medical and personal leave reasons are strictly confidential to reporting managers.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Holiday</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> My Leave</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Team Out</span>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <SkeletonLoader rows={5} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-600 py-2.5">
            <span className="text-rose-600">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {/* Empty prefix days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`cal-empty-${i}`} className="min-h-28 bg-slate-50/40 p-2" />
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
                  className={`min-h-28 p-2 flex flex-col justify-between transition-colors hover:bg-slate-50/60 ${
                    isToday ? 'bg-teal-50/20 ring-1 ring-teal-600 ring-inset' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        isToday
                          ? 'h-6 w-6 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold'
                          : 'text-slate-800'
                      }`}
                    >
                      {day}
                    </span>
                  </div>

                  <div className="space-y-1 mt-1">
                    {/* Holiday badge */}
                    {holiday && (
                      <div
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 truncate"
                        title={holiday.name}
                      >
                        🎉 {holiday.name}
                      </div>
                    )}

                    {/* My Leave */}
                    {myLeaveToday && (
                      <div
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200 truncate"
                        title={`My Leave: ${myLeaveToday.leaveTypeCode}`}
                      >
                        Me: {myLeaveToday.leaveTypeCode} ({myLeaveToday.status})
                      </div>
                    )}

                    {/* Teammates out */}
                    {teammatesOut.map((t, idx) => (
                      <div
                        key={idx}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 truncate flex items-center gap-1"
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
