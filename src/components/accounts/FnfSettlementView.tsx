import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { fnfApi } from '../../api/fnf';
import { hrApi } from '../../api/hr';
import { resignationsApi } from '../../api/resignations';
import { COMPANY } from '../../config/company';
import { PageHeader } from '../common/PageHeader';
import { StatusPill } from '../common/StatusPill';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { formatDate } from '../../utils/dateUtils';
import { formatAmount } from '../../lib/payrollEngine';
import type { FnfSettlement, Employee, Resignation } from '../../types';

const formatCurrency = (n: number) => `₹${formatAmount(n)}`;
import {
  FileText,
  Printer,
  Plus,
  CheckCircle,
  XCircle,
  Send,
  Eye,
  Calculator,
  Building,
  Award,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

interface FnfSettlementViewProps {
  isCeoView?: boolean;
}

export const FnfSettlementView: React.FC<FnfSettlementViewProps> = ({ isCeoView = false }) => {
  const { currentUser, isAccounts, isCeo, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<FnfSettlement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [resignations, setResignations] = useState<Resignation[]>([]);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | ''>('');
  const [lastWorkingDay, setLastWorkingDay] = useState('');
  const [payableDays, setPayableDays] = useState<number>(0);
  const [perDayBasic, setPerDayBasic] = useState<number>(0);
  const [salaryDue, setSalaryDue] = useState<number>(0);
  const [leaveEncashmentDays, setLeaveEncashmentDays] = useState<number>(0);
  const [leaveEncashmentAmount, setLeaveEncashmentAmount] = useState<number>(0);
  const [gratuityAmount, setGratuityAmount] = useState<number>(0);
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [noticeShortfallDays, setNoticeShortfallDays] = useState<number>(0);
  const [noticeRecoveryAmount, setNoticeRecoveryAmount] = useState<number>(0);
  const [assetRecoveryAmount, setAssetRecoveryAmount] = useState<number>(0);
  const [otherRecoveries, setOtherRecoveries] = useState<number>(0);
  const [otherPayables, setOtherPayables] = useState<number>(0);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Document View State
  const [selectedSettlement, setSelectedSettlement] = useState<FnfSettlement | null>(null);
  const [docType, setDocType] = useState<'STATEMENT' | 'RELIEVING' | 'EXPERIENCE'>('STATEMENT');
  const [printing, setPrinting] = useState(false);

  // CEO Action State
  const [ceoActionModal, setCeoActionModal] = useState<FnfSettlement | null>(null);
  const [ceoDecision, setCeoDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [ceoRemarks, setCeoRemarks] = useState('');
  const [processingDecision, setProcessingDecision] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fnfList, empList, resList] = await Promise.all([
        fnfApi.getFnfList(),
        hrApi.getEmployees().catch(() => []),
        resignationsApi.getAllResignations('ACCEPTED').catch(() => [])
      ]);
      setSettlements(fnfList);
      setEmployees(empList);
      setResignations(resList);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load F&F data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  // Auto calculate amounts
  useEffect(() => {
    const sDue = Math.round(payableDays * perDayBasic);
    setSalaryDue(sDue);
    const lDue = Math.round(leaveEncashmentDays * perDayBasic);
    setLeaveEncashmentAmount(lDue);
    const nDue = Math.round(noticeShortfallDays * perDayBasic);
    setNoticeRecoveryAmount(nDue);
  }, [payableDays, leaveEncashmentDays, noticeShortfallDays, perDayBasic]);

  const totalEarnings = salaryDue + leaveEncashmentAmount + gratuityAmount + bonusAmount + otherPayables;
  const totalDeductions = noticeRecoveryAmount + assetRecoveryAmount + otherRecoveries;
  const netPayable = Math.max(0, totalEarnings - totalDeductions);

  const handleEmployeeSelect = (empId: number) => {
    setSelectedEmpId(empId);
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    // Check if resignation exists for this emp
    const res = resignations.find(r => (r as any).employeeId === empId);
    if (res?.confirmedLwd) {
      setLastWorkingDay(res.confirmedLwd);
    } else {
      setLastWorkingDay(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()));
    }

    // Default per-day basic estimation (can be edited by Accounts)
    const basicEst = 1000;
    setPerDayBasic(basicEst);
    setPayableDays(20);
    setLeaveEncashmentDays(5);

    // Calculate tenure for Gratuity (if >= 5 years)
    if (emp.dateOfJoining) {
      const doj = new Date(emp.dateOfJoining);
      const tenureYrs = (new Date().getTime() - doj.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (tenureYrs >= 5) {
        // Gratuity: 15 * (monthly basic) * tenure / 26
        const monthlyBasic = basicEst * 26;
        const grat = Math.round((15 * monthlyBasic * tenureYrs) / 26);
        setGratuityAmount(grat);
      } else {
        setGratuityAmount(0);
      }
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !lastWorkingDay) {
      showToast('Validation Error', 'Please select an employee and last working day.', 'error');
      return;
    }

    setSaving(true);
    try {
      const matchRes = resignations.find(r => (r as any).employeeId === selectedEmpId);
      const created = await fnfApi.saveFnfDraft({
        resignationId: matchRes?.id,
        employeeId: selectedEmpId as number,
        lastWorkingDay,
        payableDays,
        perDayBasic,
        salaryDue,
        leaveEncashmentDays,
        leaveEncashmentAmount,
        gratuityAmount,
        bonusAmount,
        noticeShortfallDays,
        noticeRecoveryAmount,
        assetRecoveryAmount,
        otherRecoveries,
        otherPayables,
        netPayable,
        remarks
      });

      showToast('F&F Prepared', 'Full & Final settlement draft saved successfully.', 'success');
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      showToast('Draft Failed', err.message || 'Could not save F&F draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async (id: number) => {
    try {
      await fnfApi.submitFnf(id);
      showToast('Submitted to CEO', 'Settlement forwarded to Executive Leadership for sign-off.', 'success');
      loadData();
    } catch (err: any) {
      showToast('Error', err.message || 'Could not submit F&F', 'error');
    }
  };

  const handleCeoDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ceoActionModal) return;

    setProcessingDecision(true);
    try {
      await fnfApi.ceoActionFnf(ceoActionModal.id, ceoDecision, ceoRemarks);
      showToast(
        ceoDecision === 'APPROVE' ? 'Settlement Approved' : 'Settlement Rejected',
        `Full & Final settlement #${ceoActionModal.id} has been ${ceoDecision.toLowerCase()}d.`,
        'success'
      );
      setCeoActionModal(null);
      setCeoRemarks('');
      loadData();
    } catch (err: any) {
      showToast('Action Failed', err.message || 'Could not record decision', 'error');
    } finally {
      setProcessingDecision(false);
    }
  };

  const filteredSettlements = isCeoView
    ? settlements.filter(s => s.status === 'SUBMITTED' || s.status === 'APPROVED')
    : settlements;

  // Render Printable Document
  const renderDocument = () => {
    if (!selectedSettlement) return null;
    const emp = (selectedSettlement as any).employee || {};

    if (docType === 'STATEMENT') {
      return (
        <div className="bg-white p-8 max-w-3xl mx-auto text-slate-800 font-sans border border-slate-200 rounded-xl print-area">
          {/* Company Header */}
          <div className="border-b-2 border-teal-700 pb-4 mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-teal-800 tracking-tight">{COMPANY.legalName}</h1>
              <p className="text-xs text-slate-500 mt-0.5">{COMPANY.addressLine}</p>
              <p className="text-xs text-slate-500">CIN: {COMPANY.cin} | Email: accounts@secondmedic.com</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold rounded">
                FULL & FINAL SETTLEMENT
              </span>
              <p className="text-[11px] text-slate-400 font-mono mt-1">Ref: FNF-{selectedSettlement.id}-{selectedSettlement.employeeId}</p>
            </div>
          </div>

          {/* Employee & Exit Details */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
            <div>
              <span className="text-slate-500">Employee Name:</span>
              <div className="font-bold text-slate-900 text-sm">{emp.fullName || '—'}</div>
              <div className="text-slate-600 mt-1">Emp Code: <span className="font-mono font-medium">{emp.empCode || '—'}</span></div>
              <div className="text-slate-600">Designation: {emp.designation || 'Staff'}</div>
            </div>
            <div>
              <div className="text-slate-600">Date of Joining: <span className="font-medium">{emp.dateOfJoining ? formatDate(emp.dateOfJoining) : '—'}</span></div>
              <div className="text-slate-600">Last Working Day: <span className="font-bold text-teal-700">{formatDate(selectedSettlement.lastWorkingDay)}</span></div>
              <div className="text-slate-600 mt-1">Prepared By: <span className="font-medium">{(selectedSettlement as any).preparer?.fullName || 'Accounts Dept'}</span></div>
              <div className="text-slate-600">Status: <span className="font-bold text-slate-800">{selectedSettlement.status}</span></div>
            </div>
          </div>

          {/* Earnings & Deductions Tables */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Earnings */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 border-b border-teal-600 pb-1 mb-2">
                A. Earnings & Accruals
              </h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-1.5 text-slate-600">Salary Due ({selectedSettlement.payableDays} days)</td>
                    <td className="py-1.5 text-right font-mono font-medium">{formatCurrency(selectedSettlement.salaryDue)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">Leave Encashment ({selectedSettlement.leaveEncashmentDays} days)</td>
                    <td className="py-1.5 text-right font-mono font-medium">{formatCurrency(selectedSettlement.leaveEncashmentAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">Gratuity</td>
                    <td className="py-1.5 text-right font-mono font-medium">{formatCurrency(selectedSettlement.gratuityAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">Bonus / Incentive</td>
                    <td className="py-1.5 text-right font-mono font-medium">{formatCurrency(selectedSettlement.bonusAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">Other Payables</td>
                    <td className="py-1.5 text-right font-mono font-medium">{formatCurrency(selectedSettlement.otherPayables || 0)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold">
                    <td className="py-2 text-slate-900">Total Earnings (A)</td>
                    <td className="py-2 text-right text-teal-800 font-mono">
                      {formatCurrency(
                        selectedSettlement.salaryDue +
                        selectedSettlement.leaveEncashmentAmount +
                        (selectedSettlement.gratuityAmount || 0) +
                        (selectedSettlement.bonusAmount || 0) +
                        (selectedSettlement.otherPayables || 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Deductions */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 border-b border-rose-600 pb-1 mb-2">
                B. Recoveries & Deductions
              </h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-1.5 text-slate-600">Notice Recovery ({selectedSettlement.noticeShortfallDays || 0} days)</td>
                    <td className="py-1.5 text-right font-mono font-medium">{formatCurrency(selectedSettlement.noticeRecoveryAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">Asset Non-Return Deductions</td>
                    <td className="py-1.5 text-right font-mono font-medium">{formatCurrency(selectedSettlement.assetRecoveryAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">Other Deductions / Advances</td>
                    <td className="py-1.5 text-right font-mono font-medium">{formatCurrency(selectedSettlement.otherRecoveries || 0)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold">
                    <td className="py-2 text-slate-900">Total Deductions (B)</td>
                    <td className="py-2 text-right text-rose-800 font-mono">
                      {formatCurrency(
                        (selectedSettlement.noticeRecoveryAmount || 0) +
                        (selectedSettlement.assetRecoveryAmount || 0) +
                        (selectedSettlement.otherRecoveries || 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net Settlement Banner */}
          <div className="bg-teal-50 border-2 border-teal-600 p-4 rounded-xl flex items-center justify-between mb-8">
            <div>
              <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">Net Payable to Employee (A - B)</span>
              <p className="text-xs text-teal-700 mt-0.5">Subject to statutory TDS withholding as applicable.</p>
            </div>
            <div className="text-2xl font-black text-teal-800 font-mono">
              {formatCurrency(selectedSettlement.netPayable)}
            </div>
          </div>

          {/* Remarks */}
          {selectedSettlement.remarks && (
            <div className="text-xs text-slate-600 mb-6 bg-slate-50 p-3 rounded border border-slate-200">
              <span className="font-semibold text-slate-800">Remarks: </span>
              {selectedSettlement.remarks}
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-12 border-t border-slate-200 text-center text-xs text-slate-600">
            <div>
              <div className="border-b border-dashed border-slate-400 pb-8 mb-2">
                {(selectedSettlement as any).preparer?.fullName || 'Finance Executive'}
              </div>
              <div className="font-bold text-slate-800">Prepared By</div>
              <div className="text-[10px] text-slate-400">Accounts & Finance</div>
            </div>
            <div>
              <div className="border-b border-dashed border-slate-400 pb-8 mb-2">
                {(selectedSettlement as any).approver?.fullName || (selectedSettlement.status === 'APPROVED' ? 'Chief Executive Officer' : 'Pending')}
              </div>
              <div className="font-bold text-slate-800">Approved By</div>
              <div className="text-[10px] text-slate-400">CEO / Leadership</div>
            </div>
            <div>
              <div className="border-b border-dashed border-slate-400 pb-8 mb-2 font-mono">
                {emp.fullName}
              </div>
              <div className="font-bold text-slate-800">Employee Acceptance</div>
              <div className="text-[10px] text-slate-400">Signature / Date</div>
            </div>
          </div>
        </div>
      );
    }

    if (docType === 'RELIEVING') {
      return (
        <div className="bg-white p-12 max-w-3xl mx-auto text-slate-800 font-sans border border-slate-200 rounded-xl print-area space-y-6">
          {/* Header */}
          <div className="border-b-2 border-teal-700 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-teal-800">{COMPANY.legalName}</h1>
              <p className="text-xs text-slate-500">{COMPANY.addressLine}</p>
              <p className="text-xs text-slate-500">CIN: {COMPANY.cin}</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Date: {formatDate(new Date().toISOString())}</p>
              <p className="font-mono mt-1">Ref: SM/REL/{selectedSettlement.id}</p>
            </div>
          </div>

          <div className="text-center py-4">
            <h2 className="text-base font-bold uppercase tracking-widest text-slate-900 underline decoration-teal-600 decoration-2 underline-offset-8">
              RELIEVING LETTER
            </h2>
          </div>

          <div className="text-xs leading-relaxed space-y-4 text-slate-700">
            <p><strong>To Whomsoever It May Concern</strong></p>
            <p>
              This is to certify that <strong>{emp.fullName}</strong> (Employee Code: <strong>{emp.empCode}</strong>) was employed with <strong>{COMPANY.legalName}</strong> as <strong>{emp.designation || 'BD Manager'}</strong> from <strong>{emp.dateOfJoining ? formatDate(emp.dateOfJoining) : 'the commencement of service'}</strong> to <strong>{formatDate(selectedSettlement.lastWorkingDay)}</strong>.
            </p>
            <p>
              We confirm that {emp.fullName} has formally separated from our organization at the close of business hours on <strong>{formatDate(selectedSettlement.lastWorkingDay)}</strong> following the acceptance of resignation and completion of exit formalities.
            </p>
            <p>
              All company property, IT hardware, documentation, and confidential materials assigned to the employee have been surrendered in full, and all accounts stand settled.
            </p>
            <p>
              We thank {emp.fullName} for their valuable contributions during their tenure with SecondMedic and wish them every success in all future professional endeavors.
            </p>
          </div>

          <div className="pt-16 text-xs text-slate-700">
            <p className="font-bold">For {COMPANY.legalName}</p>
            <div className="h-12 flex items-center">
              <span className="font-serif italic text-teal-800 font-bold text-sm">Digitally Authorized</span>
            </div>
            <p className="font-bold">Authorized Signatory</p>
            <p className="text-slate-500">Human Resources & Operations</p>
          </div>
        </div>
      );
    }

    if (docType === 'EXPERIENCE') {
      return (
        <div className="bg-white p-12 max-w-3xl mx-auto text-slate-800 font-sans border border-slate-200 rounded-xl print-area space-y-6">
          {/* Header */}
          <div className="border-b-2 border-teal-700 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-teal-800">{COMPANY.legalName}</h1>
              <p className="text-xs text-slate-500">{COMPANY.addressLine}</p>
              <p className="text-xs text-slate-500">CIN: {COMPANY.cin}</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Date: {formatDate(new Date().toISOString())}</p>
              <p className="font-mono mt-1">Ref: SM/EXP/{selectedSettlement.id}</p>
            </div>
          </div>

          <div className="text-center py-4">
            <h2 className="text-base font-bold uppercase tracking-widest text-slate-900 underline decoration-teal-600 decoration-2 underline-offset-8">
              EXPERIENCE CERTIFICATE
            </h2>
          </div>

          <div className="text-xs leading-relaxed space-y-4 text-slate-700">
            <p><strong>To Whomsoever It May Concern</strong></p>
            <p>
              This is to certify that <strong>{emp.fullName}</strong> was an integral team member at <strong>{COMPANY.legalName}</strong> from <strong>{emp.dateOfJoining ? formatDate(emp.dateOfJoining) : 'commencement'}</strong> to <strong>{formatDate(selectedSettlement.lastWorkingDay)}</strong>.
            </p>
            <p>
              During this tenure, {emp.fullName} held the position of <strong>{emp.designation || 'Staff'}</strong>. In this capacity, they demonstrated high professional commitment, technical diligence, and collaborative integrity.
            </p>
            <p>
              Their conduct and character during the period of employment were found to be exemplary, and they maintained harmonious relations with peers, management, and clients alike.
            </p>
            <p>
              This certificate is issued at the request of the employee upon successful clearance of separation obligations. We wish them continued success and professional growth in their future career.
            </p>
          </div>

          <div className="pt-16 text-xs text-slate-700">
            <p className="font-bold">For {COMPANY.legalName}</p>
            <div className="h-12 flex items-center">
              <span className="font-serif italic text-teal-800 font-bold text-sm">Digitally Authorized</span>
            </div>
            <p className="font-bold">Authorized Signatory</p>
            <p className="text-slate-500">Human Resources & Executive Office</p>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCeoView ? "F&F Settlement Approvals (Executive)" : "Full & Final (F&F) Settlements"}
        subtitle={
          isCeoView
            ? "Executive review and authorization of employee separation settlements, leave encashments, and relieving clearances."
            : "Accounts maker-checker portal to compute exit dues, leave encashments, notice recoveries, and issue formal settlements."
        }
        actions={
          isAccounts && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-2" />
              Prepare F&F Settlement
            </button>
          )
        }
      />

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : filteredSettlements.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
          <Calculator className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No Settlements in Queue
          </h3>
          <p className="text-sm mt-1">
            {isCeoView
              ? "There are currently no F&F settlements awaiting CEO sign-off."
              : "No F&F settlement drafts or records have been generated yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Last Working Day</th>
                  <th className="px-6 py-3.5">Salary Due</th>
                  <th className="px-6 py-3.5">Encashment</th>
                  <th className="px-6 py-3.5">Net Payable</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                {filteredSettlements.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {(s as any).employee?.fullName || 'Staff Member'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {(s as any).employee?.empCode || `EMP #${s.employeeId}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      {formatDate(s.lastWorkingDay)}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      {formatCurrency(s.salaryDue)}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      {formatCurrency(s.leaveEncashmentAmount)}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                      {formatCurrency(s.netPayable)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedSettlement(s);
                            setDocType('STATEMENT');
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded transition"
                          title="View Statement"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" />
                          Statement
                        </button>

                        {isAccounts && s.status === 'DRAFT' && (
                          <button
                            onClick={() => handleSubmitForApproval(s.id)}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded transition"
                            title="Submit to CEO"
                          >
                            <Send className="w-3.5 h-3.5 inline mr-1" />
                            Submit
                          </button>
                        )}

                        {isCeo && s.status === 'SUBMITTED' && (
                          <button
                            onClick={() => {
                              setCeoActionModal(s);
                              setCeoDecision('APPROVE');
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded transition"
                          >
                            CEO Sign-Off
                          </button>
                        )}

                        {s.status === 'APPROVED' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedSettlement(s);
                                setDocType('RELIEVING');
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 rounded border border-teal-200 dark:border-teal-800"
                              title="Print Relieving Letter"
                            >
                              Relieving
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSettlement(s);
                                setDocType('EXPERIENCE');
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800"
                              title="Print Experience Certificate"
                            >
                              Experience
                            </button>
                          </>
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

      {/* Prepare F&F Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-2xl w-full my-8 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Prepare Full & Final (F&F) Settlement
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Select Employee *
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={e => handleEmployeeSelect(Number(e.target.value))}
                    required
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                  >
                    <option value="">-- Choose Staff Member --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.empCode}) - {emp.designation}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Last Working Day (LWD) *
                  </label>
                  <input
                    type="date"
                    value={lastWorkingDay}
                    onChange={e => setLastWorkingDay(e.target.value)}
                    required
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                  />
                </div>
              </div>

              {/* Rate & Days Calculation */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Earnings & Payables</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Per-Day Basic (₹)</label>
                    <input
                      type="number"
                      value={perDayBasic}
                      onChange={e => setPerDayBasic(Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Payable Days (Salary)</label>
                    <input
                      type="number"
                      value={payableDays}
                      onChange={e => setPayableDays(Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Salary Due (₹)</label>
                    <input
                      type="number"
                      value={salaryDue}
                      readOnly
                      className="w-full text-xs rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 px-2 py-1.5 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">EL Balance (Days)</label>
                    <input
                      type="number"
                      value={leaveEncashmentDays}
                      onChange={e => setLeaveEncashmentDays(Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Leave Encashment (₹)</label>
                    <input
                      type="number"
                      value={leaveEncashmentAmount}
                      readOnly
                      className="w-full text-xs rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Gratuity (₹)</label>
                    <input
                      type="number"
                      value={gratuityAmount}
                      onChange={e => setGratuityAmount(Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Bonus / Incentive (₹)</label>
                    <input
                      type="number"
                      value={bonusAmount}
                      onChange={e => setBonusAmount(Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Other Payables (₹)</label>
                    <input
                      type="number"
                      value={otherPayables}
                      onChange={e => setOtherPayables(Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Deductions & Recoveries */}
              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900 space-y-3">
                <span className="font-bold text-rose-800 dark:text-rose-300 block">Recoveries & Deductions</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Notice Shortfall Days</label>
                    <input
                      type="number"
                      value={noticeShortfallDays}
                      onChange={e => setNoticeShortfallDays(Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Notice Recovery (₹)</label>
                    <input
                      type="number"
                      value={noticeRecoveryAmount}
                      readOnly
                      className="w-full text-xs rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Asset Recovery (₹)</label>
                    <input
                      type="number"
                      value={assetRecoveryAmount}
                      onChange={e => setAssetRecoveryAmount(Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Other Recoveries / Deductions (₹)</label>
                  <input
                    type="number"
                    value={otherRecoveries}
                    onChange={e => setOtherRecoveries(Number(e.target.value))}
                    className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5"
                  />
                </div>
              </div>

              {/* Net Payable Output */}
              <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-lg border border-teal-300 dark:border-teal-800 flex items-center justify-between">
                <span className="font-bold text-teal-900 dark:text-teal-200">Net Payable Amount</span>
                <span className="text-base font-black font-mono text-teal-700 dark:text-teal-300">
                  {formatCurrency(netPayable)}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Settlement Remarks / Handover Sign-off Notes
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Notes regarding asset return, no-due clearances..."
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
                >
                  {saving ? 'Saving...' : 'Save Draft Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document View / Print Modal */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-4xl w-full my-6 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between no-print border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDocType('STATEMENT')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                    docType === 'STATEMENT' ? 'bg-teal-600 text-white' : 'text-slate-600 bg-slate-100'
                  }`}
                >
                  F&F Statement
                </button>
                {selectedSettlement.status === 'APPROVED' && (
                  <>
                    <button
                      onClick={() => setDocType('RELIEVING')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                        docType === 'RELIEVING' ? 'bg-teal-600 text-white' : 'text-slate-600 bg-slate-100'
                      }`}
                    >
                      Relieving Letter
                    </button>
                    <button
                      onClick={() => setDocType('EXPERIENCE')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                        docType === 'EXPERIENCE' ? 'bg-teal-600 text-white' : 'text-slate-600 bg-slate-100'
                      }`}
                    >
                      Experience Certificate
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setSelectedSettlement(null)}
                  className="text-slate-400 hover:text-slate-600 px-2 py-1 text-base font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-2">
              {renderDocument()}
            </div>
          </div>
        </div>
      )}

      {/* CEO Decision Modal */}
      {ceoActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              CEO Authorization — F&F Settlement #{ceoActionModal.id}
            </h3>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
              <div>Employee: <strong>{(ceoActionModal as any).employee?.fullName}</strong></div>
              <div>Last Working Day: <strong>{formatDate(ceoActionModal.lastWorkingDay)}</strong></div>
              <div>Net Payable: <strong className="text-teal-600">{formatCurrency(ceoActionModal.netPayable)}</strong></div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  checked={ceoDecision === 'APPROVE'}
                  onChange={() => setCeoDecision('APPROVE')}
                />
                <span className="text-teal-700 dark:text-teal-300">Approve Settlement</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  checked={ceoDecision === 'REJECT'}
                  onChange={() => setCeoDecision('REJECT')}
                />
                <span className="text-rose-700 dark:text-rose-300">Reject / Return to Accounts</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Executive Remarks
              </label>
              <textarea
                rows={3}
                value={ceoRemarks}
                onChange={e => setCeoRemarks(e.target.value)}
                placeholder="Remarks or instructions for disbursement..."
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCeoActionModal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCeoDecisionSubmit}
                disabled={processingDecision}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm ${
                  ceoDecision === 'APPROVE' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processingDecision ? 'Processing...' : `Confirm ${ceoDecision}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
