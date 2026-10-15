import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ceoApi } from '../../api';
import {
  Users,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Briefcase,
  Award
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const CeoDashboard: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [roleProposals, setRoleProposals] = useState<any[]>([]);
  const [actioningId, setActioningId] = useState<number | null>(null);

  const fetchCeoData = async () => {
    try {
      setLoading(true);
      const [overview, proposals] = await Promise.all([
        ceoApi.getExecutiveMetrics(),
        ceoApi.getPendingRoleProposals()
      ]);
      setMetrics(overview);
      setRoleProposals(proposals);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load executive portal', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCeoData();
  }, [currentUser?.id]);

  const handleActionProposal = async (id: number, action: 'APPROVE' | 'REJECT') => {
    setActioningId(id);
    try {
      await ceoApi.actionRoleProposal(id, action);
      showToast(
        `Role Proposal ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
        `Two-person authorization fulfilled. System permissions updated.`,
        action === 'APPROVE' ? 'success' : 'info'
      );
      fetchCeoData();
    } catch (err: any) {
      showToast('Action Failed', err.message || 'Unable to update proposal', 'error');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">Executive Command Center</h1>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/70">
              Chief Executive Officer
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Real-time organizational health, clinical workforce presence & statutory authorizations
          </p>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 font-medium">
          Fiscal Quarter: <span className="font-bold text-slate-800 dark:text-slate-200">Q2 FY 2026-27</span>
        </div>
      </div>

      {loading || !metrics ? (
        <SkeletonLoader rows={6} />
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Staff Strength</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{metrics.totalHeadcount}</div>
              <span className="text-[12.5px] text-teal-700 dark:text-teal-300 font-medium mt-1 block">Active Medical & Admin</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Today's Attendance Rate</span>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{metrics.attendancePct}%</div>
              <span className="text-[12.5px] text-slate-400 dark:text-slate-500 mt-1 block">Shift compliance</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Monthly Payroll Budget</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">₹{metrics.monthlyPayrollExpense.toLocaleString('en-IN')}</div>
              <span className="text-[12.5px] text-purple-700 dark:text-purple-300 font-medium mt-1 block">August 2026 Cycle</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">KPI Scorecard Progress</span>
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{metrics.kpiCompletionPct}%</div>
              <span className="text-[12.5px] text-slate-400 dark:text-slate-500 mt-1 block">Quarterly goals locked</span>
            </div>
          </div>

          {/* Department Headcount & Attendance Chart */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              Departmental Staffing & Shift Presence (Today)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Real-time synchronization with biometric punch points and GPS field check-ins
            </p>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.departmentBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="total" name="Total Headcount" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="present" name="Present Today" fill="#0F766E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two-Person Rule Authorizations Queue (CEO Exclusive Sign-Off) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                  Two-Person Security Controls: Pending Role Promotions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Proposed by System Admin • Requires CEO Sign-Off (Decision 0.1 Separation of Powers)
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                {roleProposals.length} Action Required
              </span>
            </div>

            {roleProposals.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                All proposed privilege modifications have been resolved.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {roleProposals.map(prop => (
                  <div key={prop.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {prop.targetUserName} <span className="font-mono text-slate-400 dark:text-slate-500">({prop.targetUserEmail})</span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Proposed Role Elevation: <span className="font-bold text-teal-800 dark:text-teal-300 font-mono">{prop.proposedRole}</span>
                      </div>
                      <div className="text-[12.5px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                        Justification: "{prop.justification}" • Proposed by Admin {prop.proposedByName}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleActionProposal(prop.id, 'REJECT')}
                        disabled={actioningId === prop.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => handleActionProposal(prop.id, 'APPROVE')}
                        disabled={actioningId === prop.id}
                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sign & Authorize
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
