import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { meApi } from '../../api';
import { KpiCycle, KpiDefinition } from '../../types';
import { Award, CheckCircle2, Clock, Star, Edit3, MessageSquare } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const MyKpis: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<KpiCycle | null>(null);
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [editingKpi, setEditingKpi] = useState<KpiDefinition | null>(null);

  // Form
  const [actualValue, setActualValue] = useState<number>(0);
  const [selfRating, setSelfRating] = useState<number>(4);
  const [selfComment, setSelfComment] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fetchKpis = async () => {
    try {
      setLoading(true);
      const data = await meApi.getKpis();
      setCycle(data.cycle);
      setKpis(data.kpis);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load KPI scorecard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, [currentUser]);

  const openReviewModal = (kpi: KpiDefinition) => {
    setEditingKpi(kpi);
    setActualValue(kpi.score?.actualValue ?? kpi.targetValue);
    setSelfRating(kpi.score?.selfRating ?? 4);
    setSelfComment(kpi.score?.selfComment ?? '');
  };

  const handleSubmitSelfReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKpi) return;
    setSaving(true);
    try {
      await meApi.submitKpiSelfReview(editingKpi.id, {
        actualValue,
        selfRating,
        selfComment
      });
      showToast('Review Submitted', `Self-review saved for "${editingKpi.title}".`, 'success');
      setEditingKpi(null);
      fetchKpis();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to save review', 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = kpis.reduce((acc, k) => acc + k.weightPct, 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Performance Key Result Areas (KPIs)</h1>
            {cycle && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                {cycle.cycleName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official scorecard evaluated for quarterly incentive & appraisal cycles
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-500 block">Total Allocated Weight</span>
          <span className="text-lg font-bold text-teal-800">{totalWeight}% / 100%</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {loading ? (
        <SkeletonLoader rows={4} />
      ) : kpis.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs">
          <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No KPIs Assigned</h3>
          <p className="text-xs text-slate-500 mt-1">
            Your manager has not defined goals for this cycle yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {kpis.map(kpi => {
            const hasSelfScore = kpi.score?.selfRating !== undefined;
            const hasMgrScore = kpi.score?.managerRating !== undefined;

            return (
              <div
                key={kpi.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        Weight: {kpi.weightPct}%
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{kpi.title}</h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Target Objective</span>
                        <span className="font-bold text-slate-800">
                          {kpi.targetValue} {kpi.metricUnit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Self Actual</span>
                        <span className="font-bold text-teal-700">
                          {kpi.score?.actualValue !== undefined ? `${kpi.score.actualValue} ${kpi.metricUnit}` : 'Pending Input'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Final Rating</span>
                        <span className="font-bold text-indigo-700">
                          {kpi.score?.finalRating !== undefined ? `${kpi.score.finalRating} / 5.0` : 'Under Review'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openReviewModal(kpi)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {hasSelfScore ? 'Edit Self-Review' : 'Submit Review'}
                    </button>
                  </div>
                </div>

                {/* Reviews & Feedback comparison bar */}
                {(hasSelfScore || hasMgrScore) && (
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Self Review */}
                    <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">My Self-Assessment</span>
                        <span className="font-bold text-teal-800">{kpi.score?.selfRating} / 5</span>
                      </div>
                      {kpi.score?.selfComment && (
                        <p className="text-slate-600 mt-1.5 italic text-[11px]">
                          "{kpi.score.selfComment}"
                        </p>
                      )}
                    </div>

                    {/* Manager Feedback */}
                    <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Manager Evaluation</span>
                        <span className="font-bold text-indigo-800">
                          {kpi.score?.managerRating ? `${kpi.score.managerRating} / 5` : 'Pending'}
                        </span>
                      </div>
                      {kpi.score?.managerComment ? (
                        <p className="text-slate-600 mt-1.5 italic text-[11px]">
                          "{kpi.score.managerComment}"
                        </p>
                      ) : (
                        <p className="text-slate-400 mt-1.5 text-[11px]">Awaiting supervisor appraisal.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Self Review Form Modal */}
      {editingKpi && (
        <Modal
          isOpen={!!editingKpi}
          onClose={() => setEditingKpi(null)}
          title={`KPI Self-Review: ${editingKpi.title}`}
          subtitle={`Target: ${editingKpi.targetValue} ${editingKpi.metricUnit} • Weight: ${editingKpi.weightPct}%`}
        >
          <form onSubmit={handleSubmitSelfReview} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Actual Value Delivered ({editingKpi.metricUnit})
              </label>
              <input
                type="number"
                step="any"
                value={actualValue}
                onChange={e => setActualValue(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Self Rating (1 = Unsatisfactory, 5 = Exceptional)
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(val => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setSelfRating(val)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                      selfRating === val
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${selfRating >= val ? 'fill-current' : ''}`} />
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Self-Review Comments & Achievement Evidence
              </label>
              <textarea
                rows={3}
                value={selfComment}
                onChange={e => setSelfComment(e.target.value)}
                placeholder="Explain the deliverables, process improvements, or challenges faced during this quarter..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingKpi(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Self-Review'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
