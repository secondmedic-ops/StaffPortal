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
  }, [currentUser?.id]);

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
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">Performance Key Result Areas (KPIs)</h1>
            {cycle && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/70">
                {cycle.cycleName}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Official scorecard evaluated for quarterly incentive & appraisal cycles
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Allocated Weight</span>
          <span className="text-lg font-bold text-teal-800 dark:text-teal-300">{totalWeight}% / 100%</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {loading ? (
        <SkeletonLoader rows={4} />
      ) : kpis.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No KPIs Assigned</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
                className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Weight: {kpi.weightPct}%
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{kpi.title}</h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3 text-xs">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[12.5px]">Target Objective</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {kpi.targetValue} {kpi.metricUnit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[12.5px]">Self Actual</span>
                        <span className="font-bold text-teal-700 dark:text-teal-300">
                          {kpi.score?.actualValue !== undefined ? `${kpi.score.actualValue} ${kpi.metricUnit}` : 'Pending Input'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[12.5px]">Final Rating</span>
                        <span className="font-bold text-indigo-700 dark:text-indigo-300">
                          {kpi.score?.finalRating !== undefined ? `${kpi.score.finalRating} / 5.0` : 'Under Review'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openReviewModal(kpi)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950/60 border border-teal-200 dark:border-teal-800/70 transition-colors flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {hasSelfScore ? 'Edit Self-Review' : 'Submit Review'}
                    </button>
                  </div>
                </div>

                {/* Reviews & Feedback comparison bar */}
                {(hasSelfScore || hasMgrScore) && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Self Review */}
                    <div className="bg-slate-50/70 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">My Self-Assessment</span>
                        <span className="font-bold text-teal-800 dark:text-teal-300">{kpi.score?.selfRating} / 5</span>
                      </div>
                      {kpi.score?.selfComment && (
                        <p className="text-slate-600 dark:text-slate-400 mt-1.5 italic text-[12.5px]">
                          "{kpi.score.selfComment}"
                        </p>
                      )}
                    </div>

                    {/* Manager Feedback */}
                    <div className="bg-slate-50/70 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Manager Evaluation</span>
                        <span className="font-bold text-indigo-800 dark:text-indigo-300">
                          {kpi.score?.managerRating ? `${kpi.score.managerRating} / 5` : 'Pending'}
                        </span>
                      </div>
                      {kpi.score?.managerComment ? (
                        <p className="text-slate-600 dark:text-slate-400 mt-1.5 italic text-[12.5px]">
                          "{kpi.score.managerComment}"
                        </p>
                      ) : (
                        <p className="text-slate-400 dark:text-slate-500 mt-1.5 text-[12.5px]">Awaiting supervisor appraisal.</p>
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Actual Value Delivered ({editingKpi.metricUnit})
              </label>
              <input
                type="number"
                step="any"
                value={actualValue}
                onChange={e => setActualValue(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${selfRating >= val ? 'fill-current' : ''}`} />
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Self-Review Comments & Achievement Evidence
              </label>
              <textarea
                rows={3}
                value={selfComment}
                onChange={e => setSelfComment(e.target.value)}
                placeholder="Explain the deliverables, process improvements, or challenges faced during this quarter..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingKpi(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
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
