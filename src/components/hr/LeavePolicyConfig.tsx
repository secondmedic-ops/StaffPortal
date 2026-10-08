import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../api';
import { LeaveType } from '../../types';
import { Settings, Plus, Check, X, ShieldAlert } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const LeavePolicyConfig: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [annualQuota, setAnnualQuota] = useState(12);
  const [carryForwardMax, setCarryForwardMax] = useState(30);
  const [requiresDocDays, setRequiresDocDays] = useState(0);
  const [allowHalfDay, setAllowHalfDay] = useState(true);
  const [sandwichRule, setSandwichRule] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchLeavePolicies = async () => {
    try {
      setLoading(true);
      const data = await hrApi.getLeaveTypes();
      setLeaveTypes(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load leave policies', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeavePolicies();
  }, [currentUser]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await hrApi.createLeaveType({
        code: code.toUpperCase(),
        name,
        annualQuota,
        carryForwardMax,
        requiresDocumentAfterDays: requiresDocDays,
        allowHalfDay,
        sandwichRule,
        active: true
      });
      showToast('Policy Created', `Leave rule for ${name} (${code}) established.`, 'success');
      setShowModal(false);
      setCode('');
      setName('');
      fetchLeavePolicies();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to create policy', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leave Policies & Quota Configuration</h1>
          <p className="text-xs text-slate-500 mt-1">
            Rules engine controlling accruals, medical certificate requirements, and sandwich policies
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Leave Category
        </button>
      </div>

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Category Name</th>
                  <th className="px-5 py-3 text-center">Annual Quota</th>
                  <th className="px-5 py-3 text-center">Max Carry Forward</th>
                  <th className="px-5 py-3 text-center">Medical Doc Required</th>
                  <th className="px-5 py-3 text-center">Half Day</th>
                  <th className="px-5 py-3 text-center">Sandwich Rule</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveTypes.map(lt => (
                  <tr key={lt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-bold text-teal-800 font-mono">
                      {lt.code}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {lt.name}
                    </td>
                    <td className="px-5 py-4 text-center font-semibold">
                      {lt.annualQuota > 0 ? `${lt.annualQuota} days` : 'Unlimited / LOP'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {lt.carryForwardMax > 0 ? `${lt.carryForwardMax} days` : 'Lapses at FY'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {lt.requiresDocumentAfterDays > 0 ? (
                        <span className="text-amber-700 font-semibold">
                          After {lt.requiresDocumentAfterDays} days
                        </span>
                      ) : (
                        <span className="text-slate-400">Not required</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {lt.allowHalfDay ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {lt.sandwichRule ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          Active
                        </span>
                      ) : (
                        <span className="text-slate-400">Disabled</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Policy Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Establish Leave Category Policy"
          subtitle="Configure statutory entitlement rules for SecondMedic personnel"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="e.g. ML"
                  maxLength={5}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Maternity Leave"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Annual Quota (Days)</label>
                <input
                  type="number"
                  value={annualQuota}
                  onChange={e => setAnnualQuota(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Max Carry Forward</label>
                <input
                  type="number"
                  value={carryForwardMax}
                  onChange={e => setCarryForwardMax(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Require Doctor Certificate After Days (0 = never)
              </label>
              <input
                type="number"
                value={requiresDocDays}
                onChange={e => setRequiresDocDays(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                required
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowHalfDay}
                  onChange={e => setAllowHalfDay(e.target.checked)}
                  className="rounded text-teal-700 focus:ring-teal-700"
                />
                Allow Half-Day Applications (Morning / Afternoon)
              </label>

              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sandwichRule}
                  onChange={e => setSandwichRule(e.target.checked)}
                  className="rounded text-teal-700 focus:ring-teal-700"
                />
                Enforce Sandwich Rule (Count intervening weekends/holidays)
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800"
              >
                {saving ? 'Establishing...' : 'Save Policy'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
