import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminApi, hrApi } from '../../api';
import { SystemUser, Role, Employee } from '../../types';
import { Users, Shield, Plus, Lock, Key, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const UserManagement: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Propose Role Modal
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [targetRole, setTargetRole] = useState<Role>(Role.ACCOUNTS);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [uList, eList] = await Promise.all([
        adminApi.getSystemUsers(),
        hrApi.getEmployees()
      ]);
      setUsers(uList);
      setEmployees(eList);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load system users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  const openProposeModal = (user: SystemUser) => {
    setSelectedUser(user);
    setJustification('');
    setShowProposeModal(true);
  };

  const handleProposeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!justification.trim()) {
      showToast('Justification Required', 'State why this privilege elevation is required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await adminApi.proposeRoleAssignment(selectedUser.id, targetRole, justification);
      showToast(
        'Proposal Dispatched to CEO',
        `Role assignment proposal for ${selectedUser.name} (${targetRole}) queued for CEO authorization.`,
        'success'
      );
      setShowProposeModal(false);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to propose role', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLock = async (user: SystemUser) => {
    const action = user.status === 'ACTIVE' ? 'LOCK' : 'UNLOCK';
    if (!confirm(`Are you sure you want to ${action} user account for ${user.name}?`)) return;

    try {
      await adminApi.toggleUserStatus(user.id, action);
      showToast(
        `Account ${action === 'LOCK' ? 'Suspended' : 'Re-activated'}`,
        `Security status updated for ${user.email}.`,
        'info'
      );
      fetchUsers();
    } catch (err: any) {
      showToast('Error', err.message || 'Action failed', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">User Directory & IAM Governance</h1>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800 border border-slate-300">
              System Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authentication credentials, active sessions, and multi-factor role assignments (Strictly no salary table access)
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Users
        </button>
      </div>

      {/* Two-Person Rule Banner */}
      <div className="p-4 rounded-xl bg-slate-900 text-white shadow-xs flex items-start gap-3">
        <Shield className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300">
            Enforced Dual-Control Separation (Spec Decision 0.1)
          </h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            System Administrators can propose role additions or modifications, but privilege changes for elevated roles (such as ACCOUNTS, HR, or CEO) require explicit sign-off from the Chief Executive Officer. System Admin has no database grants on salary tables.
          </p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonLoader type="table" rows={6} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-5 py-3.5">User Identity</th>
                  <th className="px-5 py-3.5">Active Roles</th>
                  <th className="px-5 py-3.5">Account Status</th>
                  <th className="px-5 py-3.5">Last Authentication</th>
                  <th className="px-5 py-3.5 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map(r => (
                          <span
                            key={r}
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                              r === Role.CEO
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : r === Role.ACCOUNTS
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : r === Role.SYSTEM_ADMIN
                                ? 'bg-slate-800 text-white'
                                : r === Role.HR
                                ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={u.status} />
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-GB') : 'Never'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openProposeModal(u)}
                          className="px-2.5 py-1.5 rounded-lg text-teal-800 hover:bg-teal-50 border border-teal-200 font-medium transition-colors inline-flex items-center gap-1"
                        >
                          <Shield className="w-3.5 h-3.5" /> Propose Role
                        </button>
                        <button
                          onClick={() => handleToggleLock(u)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.status === 'ACTIVE'
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                          title={u.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate Account'}
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Propose Role Modal */}
      {showProposeModal && selectedUser && (
        <Modal
          isOpen={showProposeModal}
          onClose={() => setShowProposeModal(false)}
          title={`Propose Role Elevation: ${selectedUser.name}`}
          subtitle="Two-person authorization: System Admin proposes, CEO signs"
        >
          <form onSubmit={handleProposeRole} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Elevated Role</label>
              <select
                value={targetRole}
                onChange={e => setTargetRole(e.target.value as Role)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono font-bold"
              >
                <option value={Role.ACCOUNTS}>ACCOUNTS (Confidential Payroll & Compensation)</option>
                <option value={Role.HR}>HR (Employee Master, Shifts, Attendance Lock)</option>
                <option value={Role.MANAGER}>MANAGER (Direct Reports Approvals & KPIs)</option>
                <option value={Role.SYSTEM_ADMIN}>SYSTEM_ADMIN (IAM & Master Config)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Operational Business Justification <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={justification}
                onChange={e => setJustification(e.target.value)}
                placeholder="e.g. Appointed as Lead Compensation Manager; needs authority to run August 2026 payroll..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProposeModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Dispatch Proposal to CEO'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
