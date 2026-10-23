import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../api';
import { MonthlyAttendanceSummary, Holiday } from '../../types';
import { HOLIDAY_TEMPLATES, type HolidayTemplate } from '../../config/holidayTemplates';
import { SHIFT_POLICY } from '../../config/policy';
import { getMonthName, formatDate, getTodayIsoString } from '../../utils/dateUtils';
import {
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  Calendar,
  Sparkles,
  Download,
  CalendarDays,
  ListFilter
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

const localDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const weekdayName = (iso: string) => localDate(iso).toLocaleDateString('en-US', { weekday: 'long' });

export const AttendanceRegister: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState<'register' | 'holidays'>('register');
  const [loading, setLoading] = useState(true);

  // Register state
  const todayDate = new Date();
  const [month, setMonth] = useState(todayDate.getMonth() + 1);
  const [year, setYear] = useState(todayDate.getFullYear());
  const [summaries, setSummaries] = useState<MonthlyAttendanceSummary[]>([]);
  const [locking, setLocking] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [workModeFilter, setWorkModeFilter] = useState<string>('ALL');

  // Holidays tab state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState(getTodayIsoString());
  const [holidayOptional, setHolidayOptional] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [importRows, setImportRows] = useState<Array<HolidayTemplate & { selected: boolean; exists: boolean }>>([]);

  const fetchSummaries = async () => {
    try {
      setLoading(true);
      const data = await hrApi.getAttendanceSummary(month, year);
      setSummaries(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load attendance register', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      const data = await hrApi.getHolidays();
      setHolidays(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load holidays', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'register') {
      fetchSummaries();
    } else {
      fetchHolidays();
    }
  }, [activeTab, month, year, holidayYear, currentUser?.id]);

  // Lock Month
  const isMonthLocked = summaries.length > 0 && summaries.every(s => s.locked);
  const totalLopDays = summaries.reduce((acc, s) => acc + s.lopDays, 0);
  const totalPayable = summaries.reduce((acc, s) => acc + s.payableDays, 0);

  const handleLockAttendance = async () => {
    if (!confirm(`Are you sure you want to freeze and lock attendance for ${getMonthName(month)} ${year}? Once locked, Accounts will use this ledger to process monthly payroll.`)) {
      return;
    }

    setLocking(true);
    try {
      await hrApi.lockAttendanceMonth(month, year);
      showToast(
        'Attendance Locked for Payroll',
        `${getMonthName(month)} ${year} attendance frozen. Dispatched ${totalLopDays} total LOP days to Accounts module.`,
        'success'
      );
      fetchSummaries();
    } catch (err: any) {
      showToast('Lock Failed', err.message || 'Could not lock attendance', 'error');
    } finally {
      setLocking(false);
    }
  };

  const handleUnlockRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockReason.trim()) {
      showToast('Reason Required', 'Please provide a justification for unfreezing locked attendance.', 'error');
      return;
    }

    setUnlocking(true);
    try {
      await hrApi.unlockAttendanceMonth(month, year, unlockReason);
      showToast('Ledger Unlocked', `${getMonthName(month)} ${year} attendance reopened for adjustments.`, 'success');
      setShowUnlockModal(false);
      setUnlockReason('');
      fetchSummaries();
    } catch (err: any) {
      showToast('Unlock Failed', err.message || 'Could not unlock attendance', 'error');
    } finally {
      setUnlocking(false);
    }
  };

  // CSV Export for Register
  const exportRegisterCsv = () => {
    if (summaries.length === 0) {
      showToast('No Data', 'No attendance summaries to export.', 'info');
      return;
    }

    const headers = [
      'Emp Code',
      'Employee Name',
      'Department',
      'Calendar Days',
      'Present Days',
      'Approved Leaves',
      'Week-Offs & Holidays',
      'LOP Days',
      'Payable Days'
    ];

    const rows = summaries.map(s => [
      `"${s.employeeCode}"`,
      `"${s.employeeName}"`,
      `"${s.departmentName}"`,
      s.totalDays,
      s.presentDays,
      s.leaveDays,
      s.weekOffDays + s.holidayDays,
      s.lopDays,
      s.payableDays
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_register_${year}_${String(month).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Complete', 'Attendance ledger exported to CSV.', 'success');
  };

  // Holiday actions
  const yearHolidays = useMemo(
    () => holidays.filter(h => h.holidayDate.startsWith(String(holidayYear))).sort((a, b) => a.holidayDate.localeCompare(b.holidayDate)),
    [holidays, holidayYear]
  );

  const openAddHoliday = () => {
    setEditingHoliday(null);
    setHolidayName('');
    setHolidayDate(`${holidayYear}-01-01`);
    setHolidayOptional(false);
    setShowHolidayModal(true);
  };

  const openEditHoliday = (h: Holiday) => {
    setEditingHoliday(h);
    setHolidayName(h.name);
    setHolidayDate(h.holidayDate);
    setHolidayOptional(Boolean(h.isRestricted || h.isOptional));
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim()) {
      showToast('Validation Error', 'Please enter a holiday name.', 'error');
      return;
    }

    setSavingHoliday(true);
    try {
      if (editingHoliday) {
        await hrApi.updateHoliday(editingHoliday.id, {
          name: holidayName,
          holidayDate: holidayDate,
          isRestricted: holidayOptional,
          isOptional: holidayOptional
        });
        showToast('Holiday Updated', `${holidayName} updated.`, 'success');
      } else {
        await hrApi.createHoliday({
          name: holidayName,
          holidayDate: holidayDate,
          isRestricted: holidayOptional,
          isOptional: holidayOptional
        });
        showToast('Holiday Created', `${holidayName} added to calendar.`, 'success');
      }
      setShowHolidayModal(false);
      fetchHolidays();
    } catch (err: any) {
      showToast('Save Failed', err.message || 'Could not save holiday', 'error');
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from company holidays?`)) return;

    try {
      await hrApi.deleteHoliday(id);
      showToast('Holiday Removed', `${name} removed.`, 'success');
      fetchHolidays();
    } catch (err: any) {
      showToast('Delete Failed', err.message || 'Could not delete holiday', 'error');
    }
  };

  const openTemplateModal = () => {
    const list = HOLIDAY_TEMPLATES[holidayYear] ?? [];
    setImportRows(
      list.map(t => ({
        ...t,
        selected: !holidays.some(h => h.holidayDate === t.date),
        exists: holidays.some(h => h.holidayDate === t.date)
      }))
    );
    setShowTemplateModal(true);
  };

  const handleImportTemplates = async () => {
    const toImport = importRows.filter(r => r.selected && !r.exists);
    if (toImport.length === 0) {
      setShowTemplateModal(false);
      return;
    }

    try {
      for (const t of toImport) {
        await hrApi.createHoliday({
          name: t.name,
          holidayDate: t.date,
          isRestricted: Boolean(t.optional),
          isOptional: Boolean(t.optional)
        });
      }
      showToast('Holidays Loaded', `Loaded ${toImport.length} holidays for ${holidayYear}.`, 'success');
      setShowTemplateModal(false);
      fetchHolidays();
    } catch (err: any) {
      showToast('Import Failed', err.message || 'Could not import holidays', 'error');
    }
  };

  return (
    <div className="px-4 sm:px-8 py-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Attendance Register & Holidays
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage company attendance lock for payroll and configure official company holidays.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'register'
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Monthly Register & Lock
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'holidays'
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Holidays Master ({yearHolidays.length})
          </button>
        </div>
      </div>

      {activeTab === 'register' ? (
        /* Register Tab Content */
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (month === 1) {
                    setMonth(12);
                    setYear(y => y - 1);
                  } else setMonth(m => m - 1);
                }}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-sm text-slate-900 dark:text-white min-w-32 text-center">
                {getMonthName(month)} {year}
              </span>
              <button
                onClick={() => {
                  if (month === 12) {
                    setMonth(1);
                    setYear(y => y + 1);
                  } else setMonth(m => m + 1);
                }}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportRegisterCsv}
                className="inline-flex items-center px-3 py-2 text-xs font-medium text-slate-700 bg-white dark:bg-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Export CSV
              </button>

              {!isMonthLocked ? (
                <button
                  onClick={handleLockAttendance}
                  disabled={locking || summaries.length === 0}
                  className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  <Lock className="w-4 h-4 mr-1.5" />
                  {locking ? 'Locking...' : 'Lock Month for Payroll'}
                </button>
              ) : (
                <button
                  onClick={() => setShowUnlockModal(true)}
                  className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                >
                  <Unlock className="w-4 h-4 mr-1.5" />
                  Emergency Unlock
                </button>
              )}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Headcount in Register</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summaries.length}</div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Total Payable Days</span>
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">{totalPayable}</div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Total Loss of Pay (LOP)</span>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{totalLopDays} Days</div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Lock Status</span>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">
                {isMonthLocked ? '🔒 Locked for Payroll' : '🔓 Unlocked / Editable'}
              </div>
            </div>
          </div>

          {/* Register Table */}
          {loading ? (
            <SkeletonLoader rows={6} />
          ) : summaries.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
              <CalendarDays className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                No Attendance Records
              </h3>
              <p className="text-sm mt-1">No employee punches recorded for {getMonthName(month)} {year}.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-5 py-3.5">Employee</th>
                      <th className="px-5 py-3.5">Department</th>
                      <th className="px-5 py-3.5 text-center">Calendar Days</th>
                      <th className="px-5 py-3.5 text-center">Present Days</th>
                      <th className="px-5 py-3.5 text-center">Leaves</th>
                      <th className="px-5 py-3.5 text-center">Off / Holidays</th>
                      <th className="px-5 py-3.5 text-center">LOP</th>
                      <th className="px-5 py-3.5 text-center font-bold text-slate-900 dark:text-white">Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                    {summaries.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900 dark:text-white">{s.employeeName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{s.employeeCode}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{s.departmentName}</td>
                        <td className="px-5 py-3.5 text-center font-mono">{s.totalDays}</td>
                        <td className="px-5 py-3.5 text-center font-mono text-emerald-600 font-medium">{s.presentDays}</td>
                        <td className="px-5 py-3.5 text-center font-mono text-sky-600 font-medium">{s.leaveDays}</td>
                        <td className="px-5 py-3.5 text-center font-mono text-slate-500">{s.weekOffDays + s.holidayDays}</td>
                        <td className="px-5 py-3.5 text-center font-mono font-bold text-rose-600">
                          {s.lopDays > 0 ? `${s.lopDays}d` : '0'}
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono font-black text-teal-700 dark:text-teal-300 bg-teal-50/40 dark:bg-teal-950/20">
                          {s.payableDays}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Holidays Tab Content */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">Year:</span>
              <select
                value={holidayYear}
                onChange={e => setHolidayYear(Number(e.target.value))}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 font-bold"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
              <span className="text-xs text-slate-500">
                ({yearHolidays.length} official company holidays configured)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={openTemplateModal}
                className="inline-flex items-center px-3 py-2 text-xs font-medium text-slate-700 bg-white dark:bg-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Load {holidayYear} Holiday List
              </button>
              <button
                onClick={openAddHoliday}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Holiday
              </button>
            </div>
          </div>

          {/* Holiday List Grid / Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3.5">Holiday Name</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Day of Week</th>
                  <th className="px-6 py-3.5">Classification</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                {yearHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      No holidays configured for {holidayYear}. Click "Load {holidayYear} Holiday List" to populate from policy.
                    </td>
                  </tr>
                ) : (
                  yearHolidays.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        {h.name}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium">{formatDate(h.holidayDate)}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{weekdayName(h.holidayDate)}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {h.isOptional ? 'Optional / Restricted' : 'Mandatory Paid Holiday'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditHoliday(h)}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteHoliday(h.id, h.name)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Emergency Unlock Modal */}
      {showUnlockModal && (
        <Modal
          isOpen={showUnlockModal}
          onClose={() => setShowUnlockModal(false)}
          title={`Emergency Unlock: ${getMonthName(month)} ${year}`}
          subtitle="Unfreezing locked attendance creates an audit trail entry."
        >
          <form onSubmit={handleUnlockRequest} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Justification / Reason for Unlock *
              </label>
              <textarea
                rows={3}
                value={unlockReason}
                onChange={e => setUnlockReason(e.target.value)}
                placeholder="e.g. Retroactive regularization approval requested by HOD..."
                required
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={unlocking}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
              >
                {unlocking ? 'Unlocking...' : 'Confirm Unlock'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add / Edit Holiday Modal */}
      {showHolidayModal && (
        <Modal
          isOpen={showHolidayModal}
          onClose={() => setShowHolidayModal(false)}
          title={editingHoliday ? `Edit Holiday: ${editingHoliday.name}` : 'Add Company Holiday'}
          subtitle="Declared holidays apply as paid non-working days for all company staff."
        >
          <form onSubmit={handleSaveHoliday} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Holiday Name *
              </label>
              <input
                type="text"
                value={holidayName}
                onChange={e => setHolidayName(e.target.value)}
                placeholder="e.g. Maharashtra Day"
                required
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Holiday Date *
              </label>
              <input
                type="date"
                value={holidayDate}
                onChange={e => setHolidayDate(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="optionalCheck"
                checked={holidayOptional}
                onChange={e => setHolidayOptional(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="optionalCheck" className="text-slate-700 dark:text-slate-300 cursor-pointer">
                Restricted / Optional Holiday (Not mandatory)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowHolidayModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingHoliday}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
              >
                {savingHoliday ? 'Saving...' : 'Save Holiday'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Template Import Modal */}
      {showTemplateModal && (
        <Modal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          title={`Load Official ${holidayYear} Holiday List`}
          subtitle="Pre-populate mandatory gazetted holidays defined in company policy."
        >
          <div className="space-y-4 text-xs">
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border rounded-lg p-2">
              {importRows.map((row, idx) => (
                <label key={row.date} className="flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={row.exists}
                      onChange={e => {
                        const updated = [...importRows];
                        updated[idx].selected = e.target.checked;
                        setImportRows(updated);
                      }}
                      className="rounded text-teal-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{row.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{formatDate(row.date)}</div>
                    </div>
                  </div>
                  {row.exists && (
                    <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded">
                      Already in Calendar
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportTemplates}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
              >
                Load Selected Holidays
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
