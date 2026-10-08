import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { meApi } from '../../api';
import { LeaveType, LeaveBalance, Holiday } from '../../types';
import { calculateLeaveDays, getTodayIsoString } from '../../utils/dateUtils';
import {
  CalendarPlus,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileText,
  X,
  Info,
  ChevronRight
} from 'lucide-react';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const ApplyLeave: React.FC = () => {
  const { currentUser, setActiveNav, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedTypeId, setSelectedTypeId] = useState<number>(1);
  const [fromDate, setFromDate] = useState<string>('2026-09-20');
  const [toDate, setToDate] = useState<string>('2026-09-22');
  const [fromHalf, setFromHalf] = useState<'FIRST_HALF' | 'SECOND_HALF' | null>(null);
  const [toHalf, setToHalf] = useState<'FIRST_HALF' | 'SECOND_HALF' | null>(null);
  const [reason, setReason] = useState('');
  const [contactDuring, setContactDuring] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [balData, calData] = await Promise.all([
          meApi.getLeaveBalances(),
          meApi.getCalendar(9, 2026)
        ]);
        setBalances(balData);
        setHolidays(calData.holidays);

        // Map mock types from balances
        const types: LeaveType[] = balData.map(b => ({
          id: b.leaveTypeId,
          code: b.leaveTypeCode,
          name: b.leaveTypeName,
          annualQuota: 18,
          carryForwardMax: 45,
          requiresDocumentAfterDays: b.leaveTypeCode === 'SL' ? 2 : 0,
          allowHalfDay: true,
          sandwichRule: false,
          active: true
        }));
        setLeaveTypes(types);
        if (types.length > 0) setSelectedTypeId(types[0].id);
      } catch (err: any) {
        showToast('Error', err.message || 'Failed to load leave configuration', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  // Calculate live breakdown
  const currentType = leaveTypes.find(t => t.id === selectedTypeId);
  const currentBalance = balances.find(b => b.leaveTypeId === selectedTypeId);

  const holidayDateStrings = holidays.map(h => h.holidayDate);
  const calculation = fromDate && toDate
    ? calculateLeaveDays(
        fromDate,
        toDate,
        holidayDateStrings,
        currentType?.sandwichRule || false,
        fromHalf,
        toHalf
      )
    : { totalDays: 0, workingDays: 0, weekendDays: 0, holidayDays: 0 };

  const isBalanceExceeded =
    currentBalance &&
    currentType?.code !== 'LOP' &&
    calculation.totalDays > currentBalance.available;

  const requiresDocument =
    currentType?.requiresDocumentAfterDays &&
    calculation.totalDays > currentType.requiresDocumentAfterDays;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setAttachedFile({ name: file.name, size: file.size });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachedFile({ name: file.name, size: file.size });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculation.totalDays <= 0) {
      showToast('Invalid Dates', 'Please select valid leave start and end dates.', 'error');
      return;
    }
    if (isBalanceExceeded) {
      showToast('Insufficient Balance', `Requested ${calculation.totalDays} days exceeds available ${currentBalance?.available} days.`, 'error');
      return;
    }
    if (requiresDocument && !attachedFile) {
      showToast('Document Mandatory', `${currentType?.code} leave for more than ${currentType?.requiresDocumentAfterDays} days requires supporting medical certificate.`, 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('Reason Required', 'Please enter the reason for leave application.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await meApi.applyLeave({
        leaveTypeId: selectedTypeId,
        fromDate,
        toDate,
        fromHalf,
        toHalf,
        totalDays: calculation.totalDays,
        reason,
        contactDuring,
        documentUrl: attachedFile ? 'medical_attachment_simulated_vault.pdf' : undefined
      });

      showToast(
        'Leave Application Submitted!',
        `Applied for ${calculation.totalDays} days ${currentType?.code}. Forwarded to ${currentUser?.managerName || 'Reporting Authority'}.`,
        'success'
      );
      setActiveNav('leave-requests');
    } catch (err: any) {
      showToast('Application Error', err.message || 'Failed to submit leave application', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">Apply for Leave</h1>
        <p className="text-xs text-slate-500 mt-1">
          Submit formal leave request through SecondMedic 2-tier approval workflow
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Fields */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          {/* Leave Type Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Leave Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedTypeId}
              onChange={e => setSelectedTypeId(Number(e.target.value))}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-700"
            >
              {leaveTypes.map(t => {
                const b = balances.find(item => item.leaveTypeId === t.id);
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code}) — Available: {b ? b.available : 0} days
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                From Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                min="2026-01-01"
                max="2027-03-31"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700 font-medium"
                required
              />
              {currentType?.allowHalfDay && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1.5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={fromHalf !== null}
                      onChange={e => setFromHalf(e.target.checked ? 'FIRST_HALF' : null)}
                      className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                    />
                    Half Day (Start)
                  </label>
                  {fromHalf && (
                    <select
                      value={fromHalf}
                      onChange={e => setFromHalf(e.target.value as any)}
                      className="text-[11px] p-1 border rounded"
                    >
                      <option value="FIRST_HALF">Morning (1st Half)</option>
                      <option value="SECOND_HALF">Afternoon (2nd Half)</option>
                    </select>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                To Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                min={fromDate}
                max="2027-03-31"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700 font-medium"
                required
              />
              {currentType?.allowHalfDay && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1.5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={toHalf !== null}
                      onChange={e => setToHalf(e.target.checked ? 'SECOND_HALF' : null)}
                      className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                    />
                    Half Day (End)
                  </label>
                  {toHalf && (
                    <select
                      value={toHalf}
                      onChange={e => setToHalf(e.target.value as any)}
                      className="text-[11px] p-1 border rounded"
                    >
                      <option value="FIRST_HALF">Morning (1st Half)</option>
                      <option value="SECOND_HALF">Afternoon (2nd Half)</option>
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Leave <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Please provide details (e.g. personal family event, planned medical rest)..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
              required
            />
          </div>

          {/* Contact Details During Leave */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Emergency Contact Phone / Location During Leave
            </label>
            <input
              type="text"
              value={contactDuring}
              onChange={e => setContactDuring(e.target.value)}
              placeholder="+91 98765 43210 (Pune / Home)"
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          {/* File Upload (Mandatory for Sick Leave > 2 days) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Supporting Document {requiresDocument && <span className="text-rose-600 font-bold">* Mandatory for SL &gt; 2 days</span>}
              </label>
              <span className="text-[11px] text-slate-400">PDF, JPG, PNG up to 5MB</span>
            </div>

            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                requiresDocument && !attachedFile
                  ? 'border-amber-400 bg-amber-50/40'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
              }`}
            >
              {attachedFile ? (
                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 max-w-sm mx-auto">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-5 h-5 text-teal-700 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-900 truncate">
                      {attachedFile.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <UploadCloud className="w-7 h-7 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-medium text-slate-700">
                    Drag and drop file here, or{' '}
                    <label className="text-teal-700 hover:underline cursor-pointer font-bold">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileInput}
                      />
                    </label>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Medical prescription / certificate / hospital discharge
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Live Summary & Validation */}
        <div className="space-y-4">
          {/* Days Calculation Breakdown */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Leave Duration Breakdown
            </h3>

            <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-100 text-center">
              <div className="text-3xl font-extrabold text-teal-800">
                {calculation.totalDays}
              </div>
              <div className="text-xs font-semibold text-teal-700 mt-0.5">
                Total Chargeable Days
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 pt-1">
              <div className="flex justify-between">
                <span>Calendar Duration:</span>
                <span className="font-semibold text-slate-800">
                  {calculation.workingDays + calculation.weekendDays + calculation.holidayDays} days
                </span>
              </div>
              <div className="flex justify-between">
                <span>Working Days:</span>
                <span className="font-semibold text-slate-800">{calculation.workingDays}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Weekends Excluded:</span>
                <span>-{calculation.weekendDays}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Holidays Excluded:</span>
                <span>-{calculation.holidayDays}</span>
              </div>
            </div>

            {/* Sandwich rule note */}
            <div className="p-2 rounded bg-slate-50 text-[10px] text-slate-500 border border-slate-100">
              {currentType?.sandwichRule
                ? 'Note: Sandwich policy enabled for this leave type (weekends are charged).'
                : 'Note: Standard policy excludes weekends and declared company holidays.'}
            </div>
          </div>

          {/* Available Quota Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Current Balance:</span>
              <span className="font-bold text-slate-800">
                {currentBalance?.available ?? 0} days
              </span>
            </div>

            <div className="flex justify-between items-center text-xs mt-2">
              <span className="text-slate-500">Balance After Approval:</span>
              <span
                className={`font-bold ${
                  isBalanceExceeded ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {currentBalance
                  ? Math.max(0, currentBalance.available - calculation.totalDays)
                  : 0}{' '}
                days
              </span>
            </div>

            {/* Warning if exceeded */}
            {isBalanceExceeded && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>
                  Insufficient leave balance. Applying beyond quota will require HR conversion to LOP (Loss of Pay).
                </span>
              </div>
            )}
          </div>

          {/* Approver Route Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-xs space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Approval Authority Route
            </span>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="h-5 w-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              <span>{currentUser?.managerName || 'Reporting Manager'} (L1)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <span className="h-5 w-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <span>HR Operations (Auto-notified upon approval)</span>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={submitting || isBalanceExceeded || calculation.totalDays <= 0}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all flex items-center justify-center gap-2"
          >
            <CalendarPlus className="w-4 h-4" />
            {submitting ? 'Submitting Application...' : 'Confirm & Submit Application'}
          </button>
        </div>
      </form>
    </div>
  );
};
