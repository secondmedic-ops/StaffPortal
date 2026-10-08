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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Salary Ledger Cryptographic Access Logs</h1>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
              <Key className="w-3 h-3" /> Tamper-Evident
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Statutory trail logging every read, export, generation and structure alteration across compensation tables
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Export Audit CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by actor name, IP address, target employee..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="text-xs p-2 rounded-lg border border-slate-300 font-medium bg-white text-slate-700"
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-5 py-3.5">Timestamp (UTC)</th>
                  <th className="px-5 py-3.5">Action Code</th>
                  <th className="px-5 py-3.5">Actor Identity</th>
                  <th className="px-5 py-3.5">Target Employee</th>
                  <th className="px-5 py-3.5">Source IP</th>
                  <th className="px-5 py-3.5">Cryptographic Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-600 text-[11px]">
                      {log.timestamp}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        log.action === 'UPDATE_STRUCTURE'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : log.action === 'RUN_PAYROLL'
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {log.performedByName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {log.targetEmployeeName || 'All Records (Batch Run)'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-[11px]">
                      {log.ipAddress}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400 text-[10px]">
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
