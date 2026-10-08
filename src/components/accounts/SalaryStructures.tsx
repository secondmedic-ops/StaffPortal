import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { accountsApi } from '../../api';
import { SalaryStructure } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { Lock, Search, Edit3, DollarSign, Calculator, ShieldCheck, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const SalaryStructures: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [search, setSearch] = useState('');
  const [editingStruct, setEditingStruct] = useState<SalaryStructure | null>(null);

  // Form State
  const [annualCtc, setAnnualCtc] = useState<number>(1200000);
  const [effectiveFrom, setEffectiveFrom] = useState<string>('2026-04-01');
  const [saving, setSaving] = useState(false);

  const fetchStructures = async () => {
    try {
      setLoading(true);
      const data = await accountsApi.getSalaryStructures();
      setStructures(data);
    } catch (err: any) {
      showToast('Confidential Error', err.message || 'Failed to load structures', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStructures();
  }, [currentUser]);

  // Real-time calculation helpers
  const monthlyGross = Math.round(annualCtc / 12);
  const calcBasic = Math.round(monthlyGross * 0.40);
  const calcHra = Math.round(monthlyGross * 0.20);
  const calcPf = Math.round(Math.min(calcBasic * 0.12, 1800)); // standard statutory PF rule
  const calcPt = 200;
  const calcSpecialAllowance = monthlyGross - calcBasic - calcHra;
  const estimatedNet = monthlyGross - calcPf - calcPt;

  const openEditModal = (struct: SalaryStructure) => {
    setEditingStruct(struct);
    setAnnualCtc(struct.annualCtc);
    setEffectiveFrom(struct.effectiveFrom);
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStruct) return;
    setSaving(true);
    try {
      await accountsApi.updateSalaryStructure(editingStruct.employeeId, {
        annualCtc,
        basicSalary: calcBasic,
        hra: calcHra,
        specialAllowance: calcSpecialAllowance,
        pfEmployee: calcPf,
        professionalTax: calcPt,
        effectiveFrom
      });
      showToast('Structure Updated', `Compensation package updated for ${editingStruct.employeeName}. Audit record logged.`, 'success');
      setEditingStruct(null);
      fetchStructures();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to save salary structure', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filtered = structures.filter(s =>
    s.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    s.employeeCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Compensation Masters & Salary Structures</h1>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Confidential to Accounts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            CTC breakdown, statutory PF/PT rules and effective revisions (Restricted from HR and System Admin)
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonLoader type="table" rows={5} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5 text-right">Annual CTC</th>
                  <th className="px-5 py-3.5 text-right">Monthly Gross</th>
                  <th className="px-5 py-3.5 text-right">Basic (40%)</th>
                  <th className="px-5 py-3.5 text-right">HRA (20%)</th>
                  <th className="px-5 py-3.5 text-right">Special Allw.</th>
                  <th className="px-5 py-3.5 text-right">Statutory PF</th>
                  <th className="px-5 py-3.5">Effective Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{s.employeeName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{s.employeeCode}</div>
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-900">
                      ₹{s.annualCtc.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-teal-800">
                      ₹{s.grossSalary.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-slate-700">
                      ₹{s.basicSalary.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-slate-700">
                      ₹{s.hra.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-slate-700">
                      ₹{s.specialAllowance.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-slate-600">
                      ₹{s.pfEmployee.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-mono">
                      {formatDate(s.effectiveFrom)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => openEditModal(s)}
                        className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-teal-800 hover:bg-teal-50 font-medium transition-colors inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Structure Modal with Auto-Calculator */}
      {editingStruct && (
        <Modal
          isOpen={!!editingStruct}
          onClose={() => setEditingStruct(null)}
          title={`Revise Salary Structure: ${editingStruct.employeeName}`}
          subtitle={`Current Annual CTC: ₹${editingStruct.annualCtc.toLocaleString('en-IN')}`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveStructure} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Annual CTC (INR) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="10000"
                    value={annualCtc}
                    onChange={e => setAnnualCtc(Number(e.target.value))}
                    className="w-full text-xs pl-7 pr-3 py-2 rounded-lg border border-slate-300 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Effective Revision Date
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                  required
                />
              </div>
            </div>

            {/* Dynamic Real-Time Breakdown Preview */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-teal-700" />
                  Auto-Computed Monthly Breakdown (INR)
                </span>
                <span className="text-xs font-mono font-bold text-teal-800">
                  Gross: ₹{monthlyGross.toLocaleString('en-IN')} / mo
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between p-2 bg-white rounded border border-slate-100">
                  <span className="text-slate-600">Basic Salary (40%):</span>
                  <span className="font-mono font-bold">₹{calcBasic.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded border border-slate-100">
                  <span className="text-slate-600">HRA (20%):</span>
                  <span className="font-mono font-bold">₹{calcHra.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded border border-slate-100">
                  <span className="text-slate-600">Special Allowance (Residual):</span>
                  <span className="font-mono font-bold">₹{calcSpecialAllowance.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded border border-slate-100">
                  <span className="text-slate-600">Statutory PF (12% capped):</span>
                  <span className="font-mono font-bold text-rose-700">₹{calcPf.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded border border-slate-100">
                  <span className="text-slate-600">Professional Tax (PT):</span>
                  <span className="font-mono font-bold text-rose-700">₹{calcPt.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between p-2 bg-teal-50 rounded border border-teal-200">
                  <span className="font-bold text-teal-900">Estimated Take-Home:</span>
                  <span className="font-mono font-extrabold text-teal-800">₹{estimatedNet.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingStruct(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Apply Revision & Log Audit'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
