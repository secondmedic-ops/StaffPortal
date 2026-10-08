import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../api';
import { Holiday } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { Calendar, Plus, Trash2, CalendarCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const HolidayCalendar: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [date, setDate] = useState('2026-10-02');
  const [year, setYear] = useState('2026');
  const [restricted, setRestricted] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const list = await hrApi.getHolidays();
      setHolidays(list);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load holidays', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [currentUser]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await hrApi.createHoliday({
        name,
        holidayDate: date,
        holidayYear: Number(year),
        isRestricted: restricted
      });
      showToast('Holiday Declared', `${name} scheduled for ${date}.`, 'success');
      setShowModal(false);
      setName('');
      fetchHolidays();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to declare holiday', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, holidayName: string) => {
    if (!confirm(`Delete declared holiday: ${holidayName}?`)) return;
    try {
      await hrApi.deleteHoliday(id);
      showToast('Deleted', `Removed ${holidayName} from calendar.`, 'info');
      fetchHolidays();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to delete', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Declared Company Holidays</h1>
          <p className="text-xs text-slate-500 mt-1">
            Mandatory gazetted and optional restricted holidays (auto-excluded from leave deductions)
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Declare Holiday
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
                  <th className="px-5 py-3.5">Holiday Name</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Day of Week</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holidays.map(h => {
                  const dayOfWeek = new Date(h.holidayDate).toLocaleDateString('en-US', { weekday: 'long' });
                  return (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900 flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-purple-600" />
                        {h.name}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-800">
                        {formatDate(h.holidayDate)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {dayOfWeek}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          h.isRestricted
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {h.isRestricted ? 'Restricted Holiday (RH)' : 'Mandatory Gazetted'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDelete(h.id, h.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete Holiday"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Holiday Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Declare Official Holiday"
          subtitle="Declared dates automatically calculate as non-working in leave duration"
        >
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Holiday Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Gandhi Jayanti"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restricted}
                  onChange={e => setRestricted(e.target.checked)}
                  className="rounded text-teal-700 focus:ring-teal-700"
                />
                Restricted Holiday (Optional elective for employee)
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
                {saving ? 'Declaring...' : 'Save Holiday'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
