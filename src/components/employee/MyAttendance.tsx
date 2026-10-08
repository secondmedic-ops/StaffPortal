import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { meApi } from '../../api';
import { AttendanceRecord, Holiday } from '../../types';
import { formatTime, formatDate, getMonthName } from '../../utils/dateUtils';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  HelpCircle
} from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const MyAttendance: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(9); // September
  const [year, setYear] = useState(2026);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

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
      setHolidays(cal.holidays);
    } catch (err: any) {
      showToast('Attendance Error', err.message || 'Failed to load attendance records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
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
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 is Sun

  // Compute metrics
  const presentDays = attendanceList.filter(a => a.status === 'PRESENT').length;
  const halfDays = attendanceList.filter(a => a.status === 'HALF_DAY').length;
  const absentDays = attendanceList.filter(a => a.status === 'ABSENT').length;
  const leaveDays = attendanceList.filter(a => a.status === 'ON_LEAVE').length;
  const weekOffs = attendanceList.filter(a => a.status === 'WEEK_OFF').length;

  const handleDayClick = (record?: AttendanceRecord, dateStr?: string) => {
    if (record) {
      setSelectedRecord(record);
    } else if (dateStr) {
      setSelectedRecord({
        id: 0,
        employeeId: currentUser?.id || 0,
        workDate: dateStr,
        shiftId: 1,
        status: 'ABSENT',
        isRegularized: false
      });
    }
  };

  const submitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!regReason.trim()) {
      showToast('Validation Error', 'Please provide a valid reason for regularization', 'error');
      return;
    }

    setSubmittingReg(true);
    try {
      await meApi.requestRegularization({
        workDate: selectedRecord.workDate,
        requestedIn: regInTime,
        requestedOut: regOutTime,
        reason: regReason
      });
      showToast(
        'Regularization Requested',
        `Request submitted to reporting manager for ${formatDate(selectedRecord.workDate)}`,
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
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto transition-colors">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Attendance Register</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Official monthly attendance ledger with punch timestamps and regularization
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
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Present Days</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{presentDays}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Half Days</div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">{halfDays}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Leave Days</div>
          <div className="text-xl font-bold text-sky-700 dark:text-sky-400 mt-1">{leaveDays}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Absent (LOP)</div>
          <div className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">{absentDays}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Week-Offs</div>
          <div className="text-xl font-bold text-slate-600 dark:text-slate-300 mt-1">{weekOffs}</div>
        </div>
      </div>

      {/* Colour-coded Calendar Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50/80 dark:bg-slate-850 p-3 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors">
        <span className="font-semibold text-slate-600 dark:text-slate-300">Colour Codes:</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Present</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500" /> Absent</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> Half-Day</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500" /> Leave</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400" /> Week-Off</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500" /> Holiday</span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto hidden sm:inline">Click any day to view details or request regularization</span>
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

              // Status determination
              let badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
              let statusLabel = 'No Data';

              if (holiday) {
                badgeColor = 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800';
                statusLabel = holiday.name;
              } else if (record) {
                if (record.status === 'PRESENT') {
                  badgeColor = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                  statusLabel = 'Present';
                } else if (record.status === 'HALF_DAY') {
                  badgeColor = 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                  statusLabel = 'Half Day';
                } else if (record.status === 'ABSENT') {
                  badgeColor = 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                  statusLabel = 'Absent';
                } else if (record.status === 'ON_LEAVE') {
                  badgeColor = 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800';
                  statusLabel = 'Leave';
                } else if (record.status === 'WEEK_OFF') {
                  badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
                  statusLabel = 'Week Off';
                }
              }

              const isToday = dateStr === '2026-09-12';

              return (
                <div
                  key={dateStr}
                  onClick={() => handleDayClick(record, dateStr)}
                  className={`min-h-24 p-2 cursor-pointer transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-950/30 flex flex-col justify-between ${
                    isToday ? 'ring-2 ring-teal-600 ring-inset bg-teal-50/20 dark:bg-teal-950/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        isToday
                          ? 'h-6 w-6 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center font-bold'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {day}
                    </span>
                    {record?.isRegularized && (
                      <span className="text-[9px] font-bold px-1 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800" title="Regularized">
                        REG
                      </span>
                    )}
                  </div>

                  <div className="mt-1">
                    <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded border truncate ${badgeColor}`}>
                      {statusLabel}
                    </div>

                    {record?.punchIn && (
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1 truncate">
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
      {selectedRecord && (
        <Modal
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={`Attendance Details: ${formatDate(selectedRecord.workDate)}`}
          subtitle={`Employee: ${currentUser?.fullName} (${currentUser?.empCode})`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Day Status:</span>
              <StatusPill status={selectedRecord.status} size="md" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850">
                <span className="text-slate-500 dark:text-slate-400 block">Punch In</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5 block">
                  {selectedRecord.punchIn ? formatTime(selectedRecord.punchIn) : '—'}
                </span>
                {selectedRecord.inSource && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                    Source: {selectedRecord.inSource}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850">
                <span className="text-slate-500 dark:text-slate-400 block">Punch Out</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5 block">
                  {selectedRecord.punchOut ? formatTime(selectedRecord.punchOut) : '—'}
                </span>
                {selectedRecord.workedHours !== undefined && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 block">
                    Worked: {selectedRecord.workedHours} hrs
                  </span>
                )}
              </div>
            </div>

            {selectedRecord.inLat && (
              <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span>
                  Geotagged Lat: {selectedRecord.inLat}, Lng: {selectedRecord.inLng}
                </span>
              </div>
            )}

            {selectedRecord.remarks && (
              <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-0.5">Remarks:</span>
                {selectedRecord.remarks}
              </div>
            )}

            {/* Action to regularize */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Missed a punch or network issue?
              </span>
              <button
                onClick={() => {
                  setShowRegModal(true);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors"
              >
                Request Regularization
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Regularization Request Form Modal */}
      {showRegModal && selectedRecord && (
        <Modal
          isOpen={showRegModal}
          onClose={() => setShowRegModal(false)}
          title="Attendance Regularization Request"
          subtitle={`Date: ${formatDate(selectedRecord.workDate)} • Forwarded to Reporting Authority`}
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

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
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
