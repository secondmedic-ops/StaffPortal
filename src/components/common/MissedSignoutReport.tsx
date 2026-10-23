import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../api/hr';
import { branchesApi } from '../../api/branches';
import { PageHeader } from './PageHeader';
import { StatusPill } from './StatusPill';
import { SkeletonLoader } from './SkeletonLoader';
import { formatDate, formatTime } from '../../utils/dateUtils';
import type { Branch } from '../../types';
import {
  Download,
  Search,
  Filter,
  AlertTriangle,
  RefreshCw,
  Clock,
  Building,
  User
} from 'lucide-react';

interface MissedSignoutReportProps {
  forManager?: boolean;
}

export const MissedSignoutReport: React.FC<MissedSignoutReportProps> = ({ forManager = false }) => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Filters
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultStartStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(thirtyDaysAgo);

  const [startDate, setStartDate] = useState(defaultStartStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedRecords, fetchedBranches] = await Promise.all([
        hrApi.getMissedSignouts({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          branchId: selectedBranch !== 'ALL' ? parseInt(selectedBranch, 10) : undefined,
          managerId: forManager ? currentUser?.id : undefined
        }),
        branchesApi.getBranches()
      ]);

      setRecords(fetchedRecords);
      setBranches(fetchedBranches);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load missed sign-out records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, selectedBranch, currentUser?.id]);

  const filteredRecords = records.filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = r.employee?.full_name?.toLowerCase() || '';
    const code = r.employee?.emp_code?.toLowerCase() || '';
    const dept = r.employee?.department?.name?.toLowerCase() || '';
    return name.includes(term) || code.includes(term) || dept.includes(term);
  });

  const exportCsv = () => {
    if (filteredRecords.length === 0) {
      showToast('No Data', 'There are no records to export.', 'info');
      return;
    }

    const headers = [
      'Emp Code',
      'Employee Name',
      'Department',
      'Branch',
      'Work Date',
      'Punch In Time',
      'Work Mode',
      'Status'
    ];

    const rows = filteredRecords.map(r => [
      `"${r.employee?.emp_code || ''}"`,
      `"${r.employee?.full_name || ''}"`,
      `"${r.employee?.department?.name || ''}"`,
      `"${r.employee?.branch?.name || ''}"`,
      `"${r.work_date || ''}"`,
      `"${r.punch_in ? new Date(r.punch_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}"`,
      `"${r.work_mode || 'OFFICE'}"`,
      `"${r.is_regularized ? 'Regularized' : 'Missed Punch-out'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `missed_signouts_${todayStr.replace(/-/g, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Complete', 'Missed sign-outs downloaded to CSV.', 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={forManager ? "Team Missed Sign-Outs" : "Missed Sign-Outs Report"}
        subtitle={
          forManager
            ? "Employees in your reporting line with unclosed punches requiring sign-out or regularization."
            : "Company-wide unclosed punches. Staff must regularize before punching in on subsequent days."
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        }
      />

      {/* Filter Card */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {!forManager && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Branch
              </label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={forManager ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Search Employee
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, emp code, department..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Mandatory Sign-out Policy:</span> Staff who do not punch out are blocked from punching in on subsequent days until an attendance regularization request is approved by their reporting authority.
        </div>
      </div>

      {/* Table view */}
      {loading ? (
        <SkeletonLoader rows={5} />
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
          <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No Missed Sign-Outs
          </h3>
          <p className="text-sm mt-1">
            All attendance punches within the selected period have been properly closed or regularized.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Department & Branch</th>
                  <th className="px-6 py-3.5">Work Date</th>
                  <th className="px-6 py-3.5">Punch In</th>
                  <th className="px-6 py-3.5">Work Mode</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                {filteredRecords.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {r.employee?.full_name || 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.employee?.emp_code || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 dark:text-white text-xs font-medium">
                        {r.employee?.department?.name || '—'}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3" />
                        {r.employee?.branch?.name || 'Corporate HQ'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatDate(r.work_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400 font-mono">
                      {r.punch_in ? formatTime(r.punch_in) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        r.work_mode === 'WFH'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                          : r.work_mode === 'FIELD'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}>
                        {r.work_mode || 'OFFICE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        Punch-Out Missing
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500">
            Showing {filteredRecords.length} unclosed punch record{filteredRecords.length === 1 ? '' : 's'}.
          </div>
        </div>
      )}
    </div>
  );
};
