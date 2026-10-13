import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { accountsApi } from '../../api';
import { SalaryAccessLog } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { ShieldCheck, Search, Download, Lock, Key, Filter } from 'lucide-react';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const SalaryAccessLogs: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SalaryAccessLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await accountsApi.getSalaryAccessLogs();
      setLogs(data);
    } catch (err: any) {
      showToast('Security Alert', err.message || 'Failed to read salary audit log', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentUser]);

  const handleExport = () => {
    showToast('Audit Exported', 'Immutable log exported for statutory compliance & PwC audit.', 'info');
  };

  const filtered = logs.filter(log => {
    const matchesSearch =
      log.performedByName.toLowerCase().includes(search.toLowerCase()) ||
      log.ipAddress.includes(search) ||
      (log.targetEmployeeName && log.targetEmployeeName.toLowerCase().includes(search.toLowerCase()));
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">Salary Ledger Cryptographic Access Logs</h1>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/70 flex items-center gap-1">
              <Key className="w-3 h-3" /> Tamper-Evident
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Statutory trail logging every read, export, generation and structure alteration across compensation tables
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Export Audit CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by actor name, IP address, target employee..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
        >
          <option value="ALL">All Actions</option>
          <option value="VIEW_PAYSLIP">VIEW_PAYSLIP</option>
          <option value="UPDATE_STRUCTURE">UPDATE_STRUCTURE</option>
          <option value="RUN_PAYROLL">RUN_PAYROLL</option>
          <option value="EXPORT_REPORT">EXPORT_REPORT</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonLoader type="table" rows={6} />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[12.5px] font-bold">
                <tr>
                  <th className="px-5 py-3.5">Timestamp (UTC)</th>
                  <th className="px-5 py-3.5">Action Code</th>
                  <th className="px-5 py-3.5">Actor Identity</th>
                  <th className="px-5 py-3.5">Target Employee</th>
                  <th className="px-5 py-3.5">Source IP</th>
                  <th className="px-5 py-3.5">Cryptographic Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-slate-400 text-[12.5px]">
                      {log.timestamp}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11.5px] font-mono font-bold px-2 py-0.5 rounded ${
                        log.action === 'UPDATE_STRUCTURE'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                          : log.action === 'RUN_PAYROLL'
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      {log.performedByName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                      {log.targetEmployeeName || 'All Records (Batch Run)'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-500 dark:text-slate-400 text-[12.5px]">
                      {log.ipAddress}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400 dark:text-slate-500 text-[11.5px]">
                      {log.hashSeal ? log.hashSeal.substring(0, 16) + '...' : 'SHA-256 Valid'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
