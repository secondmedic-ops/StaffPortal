import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../api';
import type { Holiday } from '../../types';
import { HOLIDAY_TEMPLATES, type HolidayTemplate } from '../../config/holidayTemplates';
import { SHIFT_POLICY } from '../../config/policy';
import { formatDate, getTodayIsoString } from '../../utils/dateUtils';
import { Calendar, Plus, Trash2, CalendarCheck, Download, Pencil, AlertTriangle, PartyPopper } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import {
  PageHeader,
  StatCard,
  EmptyState,
  inputClass,
  compactInputClass,
  labelClass,
  primaryBtn,
  secondaryBtn,
  cardClass,
  tableHeadClass
} from '../common/PageHeader';

const localDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const weekdayName = (iso: string) => localDate(iso).toLocaleDateString('en-US', { weekday: 'long' });
const isWeekOff = (iso: string) => SHIFT_POLICY.weekOffDays.includes(localDate(iso).getDay());
const isOptionalHoliday = (h: Holiday) => Boolean(h.isRestricted || h.isOptional);

export const HolidayCalendar: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());

  const [editing, setEditing] = useState<Holiday | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState(getTodayIsoString());
  const [optional, setOptional] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Array<HolidayTemplate & { selected: boolean; exists: boolean }>>([]);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      setHolidays(await hrApi.getHolidays());
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load holidays', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [currentUser]);

  const yearHolidays = useMemo(
    () => holidays.filter(h => h.holidayDate.startsWith(String(year))).sort((a, b) => a.holidayDate.localeCompare(b.holidayDate)),
    [holidays, year]
  );
  const today = getTodayIsoString();
  const nextHoliday = holidays.filter(h => h.holidayDate >= today && !isOptionalHoliday(h)).sort((a, b) => a.holidayDate.localeCompare(b.holidayDate))[0];
  const yearsAvailable = Array.from(
    new Set([new Date().getFullYear(), new Date().getFullYear() + 1, ...holidays.map(h => Number(h.holidayDate.slice(0, 4))), ...Object.keys(HOLIDAY_TEMPLATES).map(Number)])
  ).sort();

  const openAdd = () => {
    setEditing(null);
    setName('');
    setDate(`${year}-01-01` > today ? `${year}-01-01` : today);
    setOptional(false);
    setShowForm(true);
  };

  const openEdit = (h: Holiday) => {
    setEditing(h);
    setName(h.name);
    setDate(h.holidayDate);
    setOptional(isOptionalHoliday(h));
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const clash = holidays.find(h => h.holidayDate === date && h.id !== editing?.id);
    if (clash) {
      showToast('Date already declared', `${formatDate(date)} is already ${clash.name}.`, 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await hrApi.updateHoliday(editing.id, { name, holidayDate: date, isRestricted: optional, isOptional: optional });
        showToast('Holiday updated', `${name} · ${formatDate(date)}`, 'success');
      } else {
        await hrApi.createHoliday({ name, holidayDate: date, holidayYear: Number(date.slice(0, 4)), isRestricted: optional, isOptional: optional });
        showToast('Holiday declared', `${name} scheduled for ${formatDate(date)}.`, 'success');
      }
      setShowForm(false);
      setYear(Number(date.slice(0, 4)));
      fetchHolidays();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to save holiday', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: Holiday) => {
    if (!confirm(`Delete declared holiday: ${h.name} (${formatDate(h.holidayDate)})?`)) return;
    try {
      await hrApi.deleteHoliday(h.id);
      showToast('Deleted', `Removed ${h.name} from calendar.`, 'info');
      fetchHolidays();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to delete', 'error');
    }
  };

  const openImport = () => {
    const existing = new Set(holidays.map(h => h.holidayDate));
    setImportRows(
      (HOLIDAY_TEMPLATES[year] ?? []).map(t => ({ ...t, exists: existing.has(t.date), selected: !existing.has(t.date) && !t.optional }))
    );
    setShowImport(true);
  };

  const runImport = async () => {
    const rows = importRows.filter(r => r.selected && !r.exists);
    setSaving(true);
    const failed: string[] = [];
    for (const r of rows) {
      try {
        await hrApi.createHoliday({
          name: r.name,
          holidayDate: r.date,
          holidayYear: Number(r.date.slice(0, 4)),
          isRestricted: Boolean(r.optional),
          isOptional: Boolean(r.optional)
        });
      } catch {
        failed.push(r.name);
      }
    }
    setSaving(false);
    setShowImport(false);
    showToast(
      failed.length ? 'Imported with errors' : 'Holiday list imported',
      failed.length ? `Could not add: ${failed.join(', ')}` : `${rows.length} holidays added to ${year}. Payroll & leave now treat them as paid non-working days.`,
      failed.length ? 'warning' : 'success'
    );
    fetchHolidays();
  };

  const mandatory = yearHolidays.filter(h => !isOptionalHoliday(h));
  const optionalCount = yearHolidays.length - mandatory.length;
  const onWeekOff = mandatory.filter(h => isWeekOff(h.holidayDate)).length;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Holiday Calendar"
        subtitle="Mandatory holidays are paid non-working days in leave counting and payroll; restricted holidays are optional for staff"
        actions={
          <>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className={`${compactInputClass} w-24 font-mono`}>
              {yearsAvailable.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {HOLIDAY_TEMPLATES[year] && (
              <button onClick={openImport} className={secondaryBtn}>
                <Download className="w-4 h-4" /> Load {year} list
              </button>
            )}
            <button onClick={openAdd} className={primaryBtn}>
              <Plus className="w-4 h-4" /> Declare Holiday
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={`Mandatory ${year}`} value={mandatory.length} icon={CalendarCheck} tone="purple" />
        <StatCard label="Restricted / optional" value={optionalCount} icon={Calendar} tone="amber" />
        <StatCard label="Falling on week-off" value={onWeekOff} hint="No extra day off" icon={AlertTriangle} tone={onWeekOff ? 'rose' : 'slate'} />
        <StatCard label="Next holiday" value={nextHoliday ? formatDate(nextHoliday.holidayDate) : '—'} hint={nextHoliday?.name} icon={PartyPopper} />
      </div>

      {loading ? (
        <SkeletonLoader rows={5} />
      ) : yearHolidays.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={`No holidays declared for ${year}`}
          message="Until holidays are declared, those days count as absent in payroll. Load the suggested list or declare them one by one."
          action={
            HOLIDAY_TEMPLATES[year] ? (
              <button onClick={openImport} className={`${primaryBtn} mx-auto`}>
                <Download className="w-4 h-4" /> Load {year} holiday list
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-5 py-3">Holiday</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Day</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {yearHolidays.map(h => {
                  const past = h.holidayDate < today;
                  return (
                    <tr key={h.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${past ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-3 font-bold text-slate-900 dark:text-slate-100">
                        <span className="flex items-center gap-2">
                          <CalendarCheck className="w-4 h-4 text-purple-600" />
                          {h.name}
                          {h === nextHoliday && <span className="text-[11.5px] font-bold text-teal-700 dark:text-teal-400">NEXT</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium">{formatDate(h.holidayDate)}</td>
                      <td className="px-5 py-3">
                        {weekdayName(h.holidayDate)}
                        {isWeekOff(h.holidayDate) && <span className="ml-2 text-[11.5px] font-semibold text-rose-600">week-off</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full border ${
                            isOptionalHoliday(h)
                              ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
                          }`}
                        >
                          {isOptionalHoliday(h) ? 'Restricted (optional)' : 'Mandatory'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => openEdit(h)} className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(h)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded" title="Delete">
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

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Holiday' : 'Declare Holiday'}
        subtitle="Mandatory holidays are paid and excluded from leave duration"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={labelClass}>Holiday name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gandhi Jayanti" className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} required />
            {date && <p className="text-[12.5px] text-slate-500 mt-1">{weekdayName(date)}{isWeekOff(date) && ' — falls on a week-off'}</p>}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={optional} onChange={e => setOptional(e.target.checked)} />
            Restricted holiday (optional — staff apply leave to take it)
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? 'Saving…' : 'Save Holiday'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title={`Suggested holiday list · ${year}`}
        subtitle="Review dates (lunar festivals are tentative — confirm with the state gazette), then import"
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
            {importRows.map((r, i) => (
              <label key={r.date + r.name} className={`flex items-center gap-3 px-3 py-2 text-xs ${r.exists ? 'opacity-50' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  disabled={r.exists}
                  checked={r.selected && !r.exists}
                  onChange={e => setImportRows(prev => prev.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))}
                />
                <input
                  type="date"
                  value={r.date}
                  disabled={r.exists}
                  onChange={e => setImportRows(prev => prev.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                  className="text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
                <span className="w-20 text-slate-500">{weekdayName(r.date).slice(0, 3)}</span>
                <span className="flex-1 font-semibold text-slate-800 dark:text-slate-200">{r.name}</span>
                {r.tentative && <span className="text-[11.5px] font-bold text-amber-700 dark:text-amber-400">verify date</span>}
                <span className={`text-[11.5px] font-bold ${r.optional ? 'text-amber-700 dark:text-amber-400' : 'text-purple-700 dark:text-purple-400'}`}>
                  {r.exists ? 'Already added' : r.optional ? 'Optional' : 'Mandatory'}
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12.5px] text-slate-500">{importRows.filter(r => r.selected && !r.exists).length} selected</span>
            <div className="flex gap-2">
              <button onClick={() => setShowImport(false)} className={secondaryBtn}>
                Cancel
              </button>
              <button onClick={runImport} disabled={saving || importRows.every(r => !r.selected || r.exists)} className={primaryBtn}>
                {saving ? 'Importing…' : 'Import selected'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
