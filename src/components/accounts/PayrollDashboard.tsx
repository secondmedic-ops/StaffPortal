import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { accountsApi } from '../../api';
import { PayrollRun } from '../../types';
import { getMonthName } from '../../utils/dateUtils';
import {
  DollarSign,
  Lock,
  Unlock,
  AlertTriangle,
  Play,
  Send,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const PayrollDashboard: React.FC = () => {
  const { currentUser, setActiveNav, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2026);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [actioningRun, setActioningRun] = useState<number | null>(null);

  // Run payroll modal
  const [showRunModal, setShowRunModal] = useState(false);
  const [runMonth, setRunMonth] = useState(8); // August
  const [processing, setProcessing] = useState(false);

  // Publish confirmation modal
  const [publishingRun, setPublishingRun] = useState<PayrollRun | null>(null);

  const fetchPayrollRuns = async () => {
    try {
      setLoading(true);
      const data = await accountsApi.getPayrollRuns(year);
      setRuns(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load payroll runs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollRuns();
  }, [year, currentUser]);

  const handleExecutePayroll = async () => {
    setProcessing(true);
    try {
      const newRun = await accountsApi.executePayrollRun(runMonth, year);
      showToast(
        'Payroll Run Generated',
        `Draft payslips calculated for ${getMonthName(runMonth)} ${year} using frozen HR attendance.`,
        'success'
      );
      setShowRunModal(false);
      fetchPayrollRuns();
    } catch (err: any) {
      showToast('Execution Blocked', err.message || 'Unable to execute payroll', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handlePublishConfirm = async () => {
    if (!publishingRun) return;
    setActioningRun(publishingRun.id);
    try {
      await accountsApi.publishPayroll(publishingRun.id);
      showToast(
        'Payslips Published',
        `Payslips for ${getMonthName(publishingRun.month)} ${publishingRun.year} published to Employee Self-Service. Employees notified.`,
        'success'
      );
      setPublishingRun(null);
      fetchPayrollRuns();
    } catch (err: any) {
      showToast('Publish Failed', err.message || 'Could not publish payslips', 'error');
    } finally {
      setActioningRun(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Accounts & Compensation Console</h1>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Isolated Schema
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Payroll processing, salary structures, tax deductions & confidential payslip disbursement
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRunModal(true)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Execute Monthly Run
          </button>
        </div>
      </div>

      {/* Security Architecture Callout */}
      <div className="p-4 rounded-xl bg-purple-950 text-white shadow-xs border border-purple-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-200">
              Zero-Trust Architecture: Confidential to Accounts
            </h4>
            <p className="text-xs text-purple-100/90 mt-1 leading-relaxed max-w-3xl">
              Salary structures and disbursement ledgers are stored in an isolated database role. Neither HR officers nor System Admins have read access to compensation tables. Every query executed in this console generates an immutable compliance audit record.
            </p>
          </div>
        </div>
      </div>

      {/* Payroll Runs List */}
      {loading ? (
        <SkeletonLoader type="table" rows={4} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Disbursement Cycles ({year})</h3>
            <span className="text-xs text-slate-500">Auto-synced with frozen monthly_attendance_summary</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-5 py-3.5">Payroll Period</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Headcount</th>
                  <th className="px-5 py-3.5 text-right">Gross Earnings</th>
                  <th className="px-5 py-3.5 text-right">Deductions & LOP</th>
                  <th className="px-5 py-3.5 text-right">Net Disbursement</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map(run => (
                  <tr key={run.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">
                        {getMonthName(run.month)} {run.year}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Run ID: #{run.id} • Processed by {run.processedBy}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={run.status} />
                    </td>
                    <td className="px-5 py-4 text-center font-bold font-mono">
                      {run.totalEmployees}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-medium text-slate-900">
                      ₹{run.totalGross.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-medium text-rose-700">
                      ₹{run.totalDeductions.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-extrabold text-teal-800 text-sm">
                      ₹{run.totalNet.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setActiveNav('payslip-generator')}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium"
                        >
                          View Slips
                        </button>
                        {run.status === 'VERIFIED' && (
                          <button
                            onClick={() => setPublishingRun(run)}
                            disabled={actioningRun === run.id}
                            className="px-3 py-1.5 rounded-lg bg-teal-700 text-white hover:bg-teal-800 font-semibold shadow-xs flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" /> Publish
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execute Run Modal */}
      {showRunModal && (
        <Modal
          isOpen={showRunModal}
          onClose={() => setShowRunModal(false)}
          title="Execute Monthly Payroll Calculation"
          subtitle="Reads locked HR attendance and computes salary components and LOP deductions"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900">
              <span className="font-bold block mb-1">Pre-flight Verification:</span>
              <ul className="list-disc list-inside space-y-0.5 text-teal-800">
                <li>HR Attendance Ledger for August 2026: <strong>LOCKED & CERTIFIED</strong></li>
                <li>Active Salary Structures: <strong>Configured</strong></li>
                <li>Statutory Tax & PT Rates: <strong>2026-2027 Slab Applied</strong></li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Month</label>
              <select
                value={runMonth}
                onChange={e => setRunMonth(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium"
              >
                <option value={8}>August 2026 (Ready for processing)</option>
                <option value={9}>September 2026 (In Progress)</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRunModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePayroll}
                disabled={processing}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {processing ? 'Calculating Gross, PT, PF & LOP...' : 'Confirm & Run Calculation'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Publish Confirmation Modal */}
      {publishingRun && (
        <Modal
          isOpen={!!publishingRun}
          onClose={() => setPublishingRun(null)}
          title={`Publish Payslips: ${getMonthName(publishingRun.month)} ${publishingRun.year}`}
          subtitle="This releases finalized salary slips into employees' encrypted Self-Service portals"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to publish <strong>{publishingRun.totalEmployees} payslips</strong> totaling <strong>₹{publishingRun.totalNet.toLocaleString('en-IN')}</strong>. Once published:
            </p>
            <ul className="text-xs text-slate-600 list-disc list-inside space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <li>Employees can immediately view and download their encrypted payslip PDFs.</li>
              <li>Bank disbursement NEFT/RTGS batch file is sealed for bank upload.</li>
              <li>Salary register is locked against accidental modification.</li>
            </ul>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPublishingRun(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishConfirm}
                disabled={actioningRun === publishingRun.id}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800"
              >
                {actioningRun === publishingRun.id ? 'Publishing...' : 'Yes, Publish to Staff'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
