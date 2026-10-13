import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '../../api';
import { Employee, KpiCycle, KpiDefinition } from '../../types';
import { Award, Plus, Star, Edit3, MessageSquare } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const TeamKpis: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<KpiCycle | null>(null);
  const [reports, setReports] = useState<Employee[]>([]);
  const [definitions, setDefinitions] = useState<KpiDefinition[]>([]);

  // Define KPI modal
  const [showDefineModal, setShowDefineModal] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number>(0);
  const [newTitle, setNewTitle] = useState('');
  const [newUnit, setNewUnit] = useState('%');
  const [newTarget, setNewTarget] = useState(95);
  const [newWeight, setNewWeight] = useState(25);
  const [savingNew, setSavingNew] = useState(false);

  // Review KPI modal
  const [reviewingKpi, setReviewingKpi] = useState<KpiDefinition | null>(null);
  const [managerRating, setManagerRating] = useState<number>(4);
  const [managerComment, setManagerComment] = useState<string>('');
  const [savingReview, setSavingReview] = useState(false);

  const fetchKpis = async () => {
    try {
      setLoading(true);
      const data = await teamApi.getTeamKpis();
      setCycle(data.cycle);
      setReports(data.reports);
      setDefinitions(data.definitions);
      if (data.reports.length > 0 && !selectedReportId) {
        setSelectedReportId(data.reports[0].id);
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load team KPIs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, [currentUser]);

  const handleDefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('Validation Error', 'KPI title is required', 'error');
      return;
    }

    setSavingNew(true);
    try {
      await teamApi.defineKpi({
        employeeId: selectedReportId,
        title: newTitle,
        metricUnit: newUnit,
        targetValue: newTarget,
        weightPct: newWeight
      });
      showToast('KPI Defined', `Successfully created KPI "${newTitle}".`, 'success');
      setShowDefineModal(false);
      setNewTitle('');
      fetchKpis();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to define KPI', 'error');
    } finally {
      setSavingNew(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingKpi) return;
    setSavingReview(true);
    try {
      await teamApi.reviewKpi(reviewingKpi.id, {
        managerRating,
        managerComment
      });
      showToast('Evaluation Recorded', `Appraisal rating ${managerRating}/5 submitted.`, 'success');
      setReviewingKpi(null);
      setManagerComment('');
      fetchKpis();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to submit review', 'error');
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">Direct Reports KPI Review</h1>
            {cycle && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/70">
                {cycle.cycleName}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Define objectives and evaluate quarterly performance metrics for your team
          </p>
        </div>

        <button
          onClick={() => setShowDefineModal(true)}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Define New Goal
        </button>
      </div>

      {loading ? (
        <SkeletonLoader rows={4} />
      ) : (
        <div className="space-y-6">
          {reports.map(rep => {
            const repKpis = definitions.filter(d => d.employeeId === rep.id);
            const totalWeight = repKpis.reduce((acc, k) => acc + k.weightPct, 0);

            return (
              <div key={rep.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{rep.fullName}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">({rep.empCode} • {rep.designation})</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    totalWeight === 100 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                  }`}>
                    Weight: {totalWeight}% / 100%
                  </span>
                </div>

                <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {repKpis.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                      No KPIs defined for this team member yet. Click "Define New Goal" above.
                    </div>
                  ) : (
                    repKpis.map(kpi => (
                      <div key={kpi.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {kpi.weightPct}%
                            </span>
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{kpi.title}</span>
                          </div>

                          <div className="grid grid-cols-3 gap-4 mt-2 text-xs">
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 text-[11.5px] block">Target</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{kpi.targetValue} {kpi.metricUnit}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 text-[11.5px] block">Self Actual</span>
                              <span className="font-semibold text-teal-800 dark:text-teal-300">
                                {kpi.score?.actualValue !== undefined ? `${kpi.score.actualValue} ${kpi.metricUnit}` : 'Pending'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 text-[11.5px] block">Appraisal Rating</span>
                              <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                {kpi.score?.managerRating !== undefined ? `${kpi.score.managerRating} / 5` : 'Needs Review'}
                              </span>
                            </div>
                          </div>

                          {kpi.score?.selfComment && (
                            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 italic mt-1.5">
                              Employee Self-Comment: "{kpi.score.selfComment}"
                            </p>
                          )}
                        </div>

                        <div>
                          <button
                            onClick={() => {
                              setReviewingKpi(kpi);
                              setManagerRating(kpi.score?.managerRating || 4);
                              setManagerComment(kpi.score?.managerComment || '');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950/60 border border-teal-200 dark:border-teal-800/70 transition-colors flex items-center gap-1"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-500" />
                            {kpi.score?.managerRating ? 'Update Review' : 'Rate & Review'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Define KPI Modal */}
      {showDefineModal && (
        <Modal
          isOpen={showDefineModal}
          onClose={() => setShowDefineModal(false)}
          title="Define Performance Goal"
          subtitle="Assign measurable KPI target to direct report"
        >
          <form onSubmit={handleDefineSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assign to Report</label>
              <select
                value={selectedReportId}
                onChange={e => setSelectedReportId(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
              >
                {reports.map(r => (
                  <option key={r.id} value={r.id}>{r.fullName} ({r.empCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Goal / Deliverable Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. On-Time Phlebotomy Specimen Arrival"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit</label>
                <input
                  type="text"
                  value={newUnit}
                  onChange={e => setNewUnit(e.target.value)}
                  placeholder="%"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Value</label>
                <input
                  type="number"
                  step="any"
                  value={newTarget}
                  onChange={e => setNewTarget(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Weight (%)</label>
                <input
                  type="number"
                  value={newWeight}
                  onChange={e => setNewWeight(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDefineModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingNew}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800"
              >
                {savingNew ? 'Saving...' : 'Create Goal'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review KPI Modal */}
      {reviewingKpi && (
        <Modal
          isOpen={!!reviewingKpi}
          onClose={() => setReviewingKpi(null)}
          title={`Supervisor Appraisal: ${reviewingKpi.title}`}
          subtitle={`Target: ${reviewingKpi.targetValue} ${reviewingKpi.metricUnit} • Weight: ${reviewingKpi.weightPct}%`}
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Manager Rating (1 to 5)</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setManagerRating(v)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border ${
                      managerRating === v
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {v} Star
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Manager Feedback Remarks</label>
              <textarea
                rows={3}
                value={managerComment}
                onChange={e => setManagerComment(e.target.value)}
                placeholder="Detail accomplishments, areas of improvement, and developmental goals..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewingKpi(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingReview}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800"
              >
                {savingReview ? 'Saving...' : 'Submit Evaluation'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
