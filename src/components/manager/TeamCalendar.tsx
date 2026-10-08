import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '../../api';
import { Employee, LeaveRequest } from '../../types';
import { formatDate, getMonthName } from '../../utils/dateUtils';
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const TeamCalendar: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(2026);
  const [reports, setReports] = useState<Employee[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await teamApi.getTeamCalendar(month, year);
        setReports(data.directReports);
        setTeamLeaves(data.leaves);
      } catch (err: any) {
        showToast('Error', err.message || 'Failed to load team calendar', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [month, year, currentUser]);

  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Roster & Shift Availability</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track planned team leaves across the current month to prevent coverage gaps
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-xs text-slate-800 min-w-36 text-center">
            {getMonthName(month)} {year}
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-700">Staff Member</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Working</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-200 border border-sky-300" /> On Leave</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {reports.map(rep => {
              const repLeaves = teamLeaves.filter(l => l.employeeId === rep.id);
              return (
                <div key={rep.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-slate-900">{rep.fullName}</div>
                    <div className="text-[11px] text-slate-500">{rep.designation} • {rep.empCode}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {repLeaves.length === 0 ? (
                      <span className="text-xs text-emerald-700 font-semibold px-2 py-1 bg-emerald-50 rounded border border-emerald-200">
                        Full Availability (0 leaves scheduled)
                      </span>
                    ) : (
                      repLeaves.map(l => (
                        <div
                          key={l.id}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200"
                        >
                          {l.leaveTypeCode}: {formatDate(l.fromDate)} – {formatDate(l.toDate)} ({l.totalDays}d, {l.status})
                        </div>
                      ))
                    )}
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
