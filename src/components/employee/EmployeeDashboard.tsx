import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { meApi } from '../../api';
import { AttendanceRecord, LeaveBalance, Holiday } from '../../types';
import { formatTime, formatDate } from '../../utils/dateUtils';
import {
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  CalendarCheck2,
  Briefcase,
  ChevronRight,
  Award
} from 'lucide-react';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const EmployeeDashboard: React.FC = () => {
  const { currentUser, setActiveNav, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<Holiday[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const [attData, balData, calData, reqData] = await Promise.all([
        meApi.getAttendance(month, year),
        meApi.getLeaveBalances(),
        meApi.getCalendar(month, year),
        meApi.getLeaveRequests()
      ]);

      const todayStr = '2026-09-12'; // sync with prototype current date
      const rec = attData.find(a => a.workDate === todayStr);
      setTodayRecord(rec || null);
      setBalances(balData);

      // Filter upcoming holidays after today
      const upcoming = calData.holidays
        .filter(h => h.holidayDate >= todayStr)
        .slice(0, 3);
      setUpcomingHolidays(upcoming);

      const pendingCount = reqData.filter(r => r.status === 'PENDING').length;
      setPendingRequestsCount(pendingCount);
    } catch (err: any) {
      showToast('Data Error', err.message || 'Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUser]);

  const handlePunch = async (type: 'IN' | 'OUT') => {
    setPunching(true);
    let lat: number | undefined;
    let lng: number | undefined;

    // Capture geolocation if permitted
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: true
          });
        });
        lat = Number(position.coords.latitude.toFixed(6));
        lng = Number(position.coords.longitude.toFixed(6));
      } catch (geoErr) {
        // Fallback to demo coordinate for phlebotomist / field office
        lat = 18.52043;
        lng = 73.85674;
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
      showToast(
        `Punch ${type === 'IN' ? 'In' : 'Out'} Recorded!`,
        `Timestamp logged at ${formatTime(type === 'IN' ? updated.punchIn : updated.punchOut)} (Lat: ${lat || 'N/A'}, Lng: ${lng || 'N/A'})`,
        'success'
      );
    } catch (err: any) {
      showToast('Punch Error', err.message || 'Failed to record attendance', 'error');
    } finally {
      setPunching(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <SkeletonLoader count={1} height="80px" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonLoader count={1} height="280px" />
          <SkeletonLoader count={2} height="130px" className="lg:col-span-2" />
        </div>
      </div>
    );
  }

  const isPunchedIn = Boolean(todayRecord?.punchIn);
  const isPunchedOut = Boolean(todayRecord?.punchOut);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 transition-colors">
      {/* Top Banner: Greeting & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Welcome, {currentUser?.fullName}
            </h1>
            {currentUser?.employmentType === 'FIELD' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <MapPin className="w-3 h-3" /> Field Phlebotomist
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {currentUser?.designation} • {currentUser?.departmentName} • Code: {currentUser?.empCode}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveNav('apply-leave')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 dark:bg-teal-600 text-white hover:bg-teal-800 dark:hover:bg-teal-700 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Calendar className="w-4 h-4" />
            Apply Leave
          </button>
          <button
            onClick={() => setActiveNav('attendance')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 border border-slate-200/60 dark:border-slate-700/60"
          >
            <CalendarCheck2 className="w-4 h-4" />
            My Calendar
          </button>
        </div>
      </div>

      {/* Grid: Punch Card + Leave Balances + Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PUNCH CARD (Large, Accessible) */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Today's Shift Attendance
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {formatDate('2026-09-12')}
              </span>
            </div>

            <div className="my-6 text-center">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 mb-2">
                <Clock className="w-8 h-8" />
              </div>

              {isPunchedOut ? (
                <div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Day Completed
                  </span>
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    Logged <span className="font-bold text-slate-900 dark:text-slate-100">{todayRecord?.workedHours || 8.5} hrs</span> today.
                  </div>
                </div>
              ) : isPunchedIn ? (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" /> Punched In
                  </span>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {formatTime(todayRecord?.punchIn)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Source: {todayRecord?.inSource || 'WEB'} {todayRecord?.inLat ? `• GPS Lat ${todayRecord.inLat}` : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                    Not Punched In Yet
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Shift window: 09:30 AM – 06:30 PM (15m grace)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            {!isPunchedIn ? (
              <button
                onClick={() => handlePunch('IN')}
                disabled={punching || isPunchedOut}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-teal-700 dark:bg-teal-600 text-white hover:bg-teal-800 dark:hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                {punching ? 'Recording GPS Punch...' : isPunchedOut ? 'Shift Completed' : 'Punch In Now'}
              </button>
            ) : (
              <button
                onClick={() => handlePunch('OUT')}
                disabled={punching}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                {punching ? 'Saving Punch Out...' : 'Punch Out (End Day)'}
              </button>
            )}
            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2 flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" /> Auto-captures IP & Geolocation
            </p>
          </div>
        </div>

        {/* LEAVE BALANCES (EL, AL, CL, SL) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Leave Quotas & Balances</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Financial Year 2026-2027</p>
            </div>
            <button
              onClick={() => setActiveNav('leave-requests')}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 flex items-center gap-1"
            >
              View History <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-4">
            {balances.map(b => (
              <div
                key={b.id}
                className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-800 dark:text-teal-400">{b.leaveTypeCode}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Days</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {b.available}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={b.leaveTypeName}>
                  {b.leaveTypeName}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                  <span>Used: {b.used}</span>
                  {b.reserved > 0 && <span className="text-amber-600 dark:text-amber-400 font-semibold">Res: {b.reserved}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Notice about Pending / Holidays */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-2">
            <div
              onClick={() => setActiveNav('leave-requests')}
              className="p-3 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/40 flex items-center justify-between cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    {pendingRequestsCount} Pending Leave {pendingRequestsCount === 1 ? 'Request' : 'Requests'}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">Awaiting reporting authority approval</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>

            <div
              onClick={() => setActiveNav('calendar')}
              className="p-3 rounded-lg border border-purple-200 dark:border-purple-800/70 bg-purple-50/50 dark:bg-purple-950/40 flex items-center justify-between cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <CalendarCheck2 className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                <div>
                  <div className="text-xs font-bold text-purple-900 dark:text-purple-300">
                    {upcomingHolidays[0] ? upcomingHolidays[0].name : 'Upcoming Holidays'}
                  </div>
                  <div className="text-[11px] text-purple-700 dark:text-purple-400">
                    {upcomingHolidays[0] ? formatDate(upcomingHolidays[0].holidayDate) : 'View Holiday Calendar'}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Second Row: Quick Action Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI Card */}
        <div
          onClick={() => setActiveNav('kpis')}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-600 transition-all cursor-pointer shadow-xs flex items-start justify-between"
        >
          <div>
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-semibold text-xs">
              <Award className="w-4 h-4" />
              <span>Quarterly Performance Review</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2">Q2 FY26-27 Cycle Open</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Self-review due by 25 Sep 2026. Rate your SLA and quality deliverables.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 mt-1" />
        </div>

        {/* Payslips Card */}
        <div
          onClick={() => setActiveNav('payslips')}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-600 transition-all cursor-pointer shadow-xs flex items-start justify-between"
        >
          <div>
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-semibold text-xs">
              <Briefcase className="w-4 h-4" />
              <span>Confidential Payslips</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2">August 2026 Available</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Download your salary statement with tax and LOP breakdown.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 mt-1" />
        </div>

        {/* Healthcare Company Values / Helpdesk */}
        <div className="bg-teal-900 dark:bg-teal-950 text-white p-5 rounded-xl shadow-xs flex flex-col justify-between border border-teal-800 dark:border-teal-800/80">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 dark:text-teal-400">
              SecondMedic Care Guarantee
            </span>
            <h4 className="text-sm font-bold mt-1">Clinical Integrity & Precision</h4>
            <p className="text-xs text-teal-100/80 dark:text-teal-200/80 mt-1 leading-relaxed">
              Every on-time sample collection saves a critical diagnosis window for our patients.
            </p>
          </div>
          <div className="text-[11px] text-teal-300 dark:text-teal-400 mt-3 flex items-center justify-between border-t border-teal-800/80 dark:border-teal-800 pt-2">
            <span>Staff Support: hr@secondmedic.com</span>
            <span>Emergency: Ext 204</span>
          </div>
        </div>
      </div>
    </div>
  );
};
