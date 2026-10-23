import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COMPANY } from '../../config/company';
import { formatDate } from '../../utils/dateUtils';
import { ANNIVERSARY_MILESTONES } from '../../config/policy';
import {
  Award,
  ShieldCheck,
  CheckCircle,
  Clock,
  Printer,
  Calendar,
  Sparkles,
  AlertCircle,
  FileCheck,
  Building
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface AnniversaryItem {
  employeeId: number;
  fullName: string;
  empCode: string;
  designation: string;
  departmentName: string;
  dateOfJoining: string;
  milestoneYears: number;
  anniversaryDate: string;
  daysRemaining: number;
}

interface ProbationItem {
  employeeId: number;
  fullName: string;
  empCode: string;
  designation: string;
  departmentName: string;
  dateOfJoining: string;
  probationEndDate: string;
  daysRemaining: number;
}

export const ProbationAnniversaryWidgets: React.FC = () => {
  const { isHr, isManager, currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [anniversaries, setAnniversaries] = useState<AnniversaryItem[]>([]);
  const [probations, setProbations] = useState<ProbationItem[]>([]);

  // Confirmation Letter Modal State
  const [showConfirmLetter, setShowConfirmLetter] = useState(false);
  const [confirmedStaff, setConfirmedStaff] = useState<ProbationItem | null>(null);

  // Extend Modal State
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendingStaff, setExtendingStaff] = useState<ProbationItem | null>(null);
  const [newProbationDate, setNewProbationDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [savingExtension, setSavingExtension] = useState(false);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(today);

      const { data: emps, error } = await supabase
        .from('employees')
        .select('id, full_name, emp_code, designation, date_of_joining, probation_end_date, confirmation_date, status, manager_id, department:departments(name)')
        .eq('status', 'ACTIVE');

      if (error || !emps) return;

      const upcomingAnnivs: AnniversaryItem[] = [];
      const upcomingProbs: ProbationItem[] = [];

      for (const emp of emps) {
        if (!emp.date_of_joining) continue;

        // 1. Check Work Anniversaries
        const doj = new Date(emp.date_of_joining);
        const thisYearAnniv = new Date(today.getFullYear(), doj.getMonth(), doj.getDate());
        if (thisYearAnniv < today) {
          thisYearAnniv.setFullYear(today.getFullYear() + 1);
        }

        const diffTime = thisYearAnniv.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const tenureYears = thisYearAnniv.getFullYear() - doj.getFullYear();

        if (diffDays >= 0 && diffDays <= 30 && (ANNIVERSARY_MILESTONES as readonly number[]).includes(tenureYears)) {
          upcomingAnnivs.push({
            employeeId: emp.id,
            fullName: emp.full_name,
            empCode: emp.emp_code,
            designation: emp.designation,
            departmentName: emp.department?.name || '',
            dateOfJoining: emp.date_of_joining,
            milestoneYears: tenureYears,
            anniversaryDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(thisYearAnniv),
            daysRemaining: diffDays
          });
        }

        // 2. Check Probation End Date (15-day alert or overdue without confirmation)
        if (emp.probation_end_date && !emp.confirmation_date) {
          // If manager, check if emp reports to manager
          if (isManager && !isHr && emp.manager_id !== currentUser?.id) {
            continue;
          }

          const probEnd = new Date(emp.probation_end_date);
          const pDiffTime = probEnd.getTime() - today.getTime();
          const pDiffDays = Math.round(pDiffTime / (1000 * 60 * 60 * 24));

          if (pDiffDays <= 15) {
            upcomingProbs.push({
              employeeId: emp.id,
              fullName: emp.full_name,
              empCode: emp.emp_code,
              designation: emp.designation,
              departmentName: emp.department?.name || '',
              dateOfJoining: emp.date_of_joining,
              probationEndDate: emp.probation_end_date,
              daysRemaining: pDiffDays
            });
          }
        }
      }

      upcomingAnnivs.sort((a, b) => a.daysRemaining - b.daysRemaining);
      upcomingProbs.sort((a, b) => a.daysRemaining - b.daysRemaining);

      setAnniversaries(upcomingAnnivs);
      setProbations(upcomingProbs);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [currentUser?.id, isHr, isManager]);

  const handleConfirmProbation = async (item: ProbationItem) => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          confirmation_date: todayStr,
          status: 'ACTIVE'
        })
        .eq('id', item.employeeId);

      if (error) throw error;
      showToast('Probation Confirmed', `${item.fullName} has been confirmed as a permanent employee.`, 'success');
      setConfirmedStaff(item);
      setShowConfirmLetter(true);
      loadMetrics();
    } catch (err: any) {
      showToast('Confirmation Failed', err.message || 'Could not confirm probation', 'error');
    }
  };

  const handleExtendProbationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingStaff || !newProbationDate) return;

    setSavingExtension(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          probation_end_date: newProbationDate
        })
        .eq('id', extendingStaff.employeeId);

      if (error) throw error;
      showToast('Probation Extended', `Probation for ${extendingStaff.fullName} extended to ${formatDate(newProbationDate)}.`, 'success');
      setShowExtendModal(false);
      setExtendingStaff(null);
      setNewProbationDate('');
      setExtendReason('');
      loadMetrics();
    } catch (err: any) {
      showToast('Extension Failed', err.message || 'Could not extend probation', 'error');
    } finally {
      setSavingExtension(false);
    }
  };

  if (!isHr && !isManager) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Probation Reviews Widget */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Probation End Reviews (15-Day Alert)
            </h3>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
            {probations.length} Due
          </span>
        </div>

        {probations.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No employees currently within 15 days of probation completion.
          </p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {probations.map(p => (
              <div
                key={p.employeeId}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{p.fullName}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.designation} • End Date: <strong>{formatDate(p.probationEndDate)}</strong> ({p.daysRemaining <= 0 ? 'Overdue' : `in ${p.daysRemaining} days`})
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleConfirmProbation(p)}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded shadow-xs transition"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setExtendingStaff(p);
                      const currentEnd = new Date(p.probationEndDate);
                      currentEnd.setMonth(currentEnd.getMonth() + 3);
                      setNewProbationDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(currentEnd));
                      setShowExtendModal(true);
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 rounded transition"
                  >
                    Extend
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Milestone Work Anniversaries Widget */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Work Anniversaries (Next 30 Days)
            </h3>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold">
            {anniversaries.length} Milestones
          </span>
        </div>

        {anniversaries.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No 1, 3, 5, or 10-year milestone anniversaries in the upcoming 30 days.
          </p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {anniversaries.map(a => (
              <div
                key={a.employeeId}
                className="p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {a.fullName}
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {a.designation} • {a.departmentName}
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-full">
                    {a.milestoneYears} Year{a.milestoneYears > 1 ? 's' : ''}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    {a.daysRemaining === 0 ? 'Today 🎉' : `in ${a.daysRemaining} days`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Printable Confirmation Letter Modal */}
      {showConfirmLetter && confirmedStaff && (
        <Modal
          isOpen={showConfirmLetter}
          onClose={() => {
            setShowConfirmLetter(false);
            setConfirmedStaff(null);
          }}
          title="Probation Confirmation Letter"
          subtitle="Officially issued letter confirming permanent employment status."
        >
          <div className="space-y-4 text-xs">
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-slate-800 space-y-4 print-area font-sans">
              <div className="border-b-2 border-teal-700 pb-3 flex justify-between items-start">
                <div>
                  <h1 className="text-lg font-bold text-teal-800">{COMPANY.legalName}</h1>
                  <p className="text-[11px] text-slate-500">{COMPANY.addressLine}</p>
                  <p className="text-[11px] text-slate-500">CIN: {COMPANY.cin}</p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <p>Date: {formatDate(new Date().toISOString())}</p>
                  <p className="font-mono mt-0.5">Ref: SM/CONF/{confirmedStaff.employeeId}</p>
                </div>
              </div>

              <div className="text-center py-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 underline decoration-teal-600 decoration-2 underline-offset-4">
                  LETTER OF CONFIRMATION
                </h2>
              </div>

              <div className="space-y-3 leading-relaxed text-slate-700">
                <p>To,</p>
                <p>
                  <strong>{confirmedStaff.fullName}</strong><br />
                  Employee Code: <strong>{confirmedStaff.empCode}</strong><br />
                  Designation: <strong>{confirmedStaff.designation}</strong>
                </p>
                <p>
                  Dear <strong>{confirmedStaff.fullName}</strong>,
                </p>
                <p>
                  Consequent upon the successful completion of your probation period and based on your performance evaluation, we are pleased to inform you that your services with <strong>{COMPANY.legalName}</strong> have been confirmed with effect from <strong>{formatDate(confirmedStaff.probationEndDate)}</strong>.
                </p>
                <p>
                  All other terms and conditions of your employment as stipulated in your original appointment letter remain unaltered.
                </p>
                <p>
                  We take this opportunity to congratulate you and look forward to your continued dedication and valuable contributions to the growth of SecondMedic.
                </p>
              </div>

              <div className="pt-8">
                <p className="font-bold">For {COMPANY.legalName}</p>
                <div className="h-10 flex items-center">
                  <span className="italic font-serif text-teal-800 font-bold text-xs">Digitally Authorized</span>
                </div>
                <p className="font-bold">Authorized Signatory</p>
                <p className="text-slate-400 text-[10px]">Human Resources & Operations</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print / Save PDF
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Extend Probation Modal */}
      {showExtendModal && extendingStaff && (
        <Modal
          isOpen={showExtendModal}
          onClose={() => setShowExtendModal(false)}
          title={`Extend Probation: ${extendingStaff.fullName}`}
          subtitle="Set a new revised probation end date with HR justification."
        >
          <form onSubmit={handleExtendProbationSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                New Probation End Date *
              </label>
              <input
                type="date"
                value={newProbationDate}
                onChange={e => setNewProbationDate(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Extension Reason / KPI Performance Feedback
              </label>
              <textarea
                rows={3}
                value={extendReason}
                onChange={e => setExtendReason(e.target.value)}
                placeholder="Reason for extension (e.g. additional evaluation of field performance)..."
                required
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExtendModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingExtension}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
              >
                {savingExtension ? 'Saving...' : 'Confirm Extension'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
