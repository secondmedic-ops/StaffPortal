import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '../../api';
import { Employee, AttendanceRecord } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { Users, CheckCircle2, Clock, AlertCircle, Calendar, ChevronRight, MapPin } from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const TeamDashboard: React.FC = () => {
  const { currentUser, setActiveNav, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<Array<{ employee: Employee; attendance?: AttendanceRecord }>>([]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const data = await teamApi.getTeamAttendance('2026-09-12');
      setTeamMembers(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load team data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [currentUser]);

  const presentCount = teamMembers.filter(m => m.attendance?.status === 'PRESENT').length;
  const onLeaveCount = teamMembers.filter(m => m.attendance?.status === 'ON_LEAVE').length;
  const absentCount = teamMembers.filter(m => !m.attendance || m.attendance.status === 'ABSENT').length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clinical & Field Team Operations</h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervisor overview for direct reports assigned to {currentUser?.fullName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveNav('team-approvals')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs"
          >
            Leave Approvals
          </button>
          <button
            onClick={() => setActiveNav('team-regularization')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            Regularizations
          </button>
        </div>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Direct Reports</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{teamMembers.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Present on Shift Today</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{presentCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Approved Leave</div>
          <div className="text-2xl font-bold text-sky-700 mt-1">{onLeaveCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Absent / Not Punched</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{absentCount}</div>
        </div>
      </div>

      {/* Direct Reports Live Table */}
      {loading ? (
        <SkeletonLoader type="table" rows={4} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Today's Shift Attendance (12 Sep 2026)</h3>
            <span className="text-xs text-slate-500">Auto-refreshed via biometrics & GPS punch</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Role & Type</th>
                  <th className="px-5 py-3">Shift Status</th>
                  <th className="px-5 py-3">Punch In</th>
                  <th className="px-5 py-3">Punch Out</th>
                  <th className="px-5 py-3">Source / Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamMembers.map(({ employee, attendance }) => (
                  <tr key={employee.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{employee.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{employee.empCode} • {employee.officialEmail}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{employee.designation}</div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">
                        {employee.employmentType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={attendance?.status || 'ABSENT'} />
                    </td>
                    <td className="px-5 py-4 font-mono">
                      {attendance?.punchIn ? formatTime(attendance.punchIn) : '—'}
                    </td>
                    <td className="px-5 py-4 font-mono">
                      {attendance?.punchOut ? formatTime(attendance.punchOut) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      {attendance?.inLat ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-teal-700 font-medium">
                          <MapPin className="w-3 h-3" /> Field GPS ({attendance.inLat})
                        </span>
                      ) : (
                        <span className="text-slate-400">Office Web</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
