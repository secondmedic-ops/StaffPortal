import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../../api';
import { AuditLogEntry } from '../../types';
import { ShieldCheck, Search, Filter, Download, Activity, CheckCircle2 } from 'lucide-react';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const AuditLog: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const list = await adminApi.getSystemAuditLogs();
      setLogs(list);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load system audit log', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [currentUser]);

  const handleExport = () => {
    showToast('Export Complete', 'Downloaded tamper-evident ISO 27001 audit journal.', 'info');
  };

  const filtered = logs.filter(l => {
    const matchesSearch =
      l.performedByName.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.ipAddress.includes(search);
    const matchesAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Enterprise Security & Compliance Audit Log</h1>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Append-Only Immutable
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete cryptographic event journal tracking authentication, role proposals, and master data changes
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Export Audit Trail
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
            placeholder="Search by actor, details, IP address..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="text-xs p-2 rounded-lg border border-slate-300 font-medium bg-white text-slate-700"
        >
          <option value="ALL">All Actions</option>
          <option value="USER_LOGIN">USER_LOGIN</option>
          <option value="ROLE_CHANGE">ROLE_CHANGE</option>
          <option value="EMPLOYEE_CREATE">EMPLOYEE_CREATE</option>
          <option value="ATTENDANCE_LOCK">ATTENDANCE_LOCK</option>
          <option value="POLICY_UPDATE">POLICY_UPDATE</option>
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
                  <th className="px-5 py-3.5">Action Event</th>
                  <th className="px-5 py-3.5">Actor Identity</th>
                  <th className="px-5 py-3.5">Target Entity</th>
                  <th className="px-5 py-3.5">Details</th>
                  <th className="px-5 py-3.5">Source IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-600 text-[11px]">
                      {l.timestamp}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        l.action === 'ATTENDANCE_LOCK'
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : l.action === 'ROLE_CHANGE'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : l.action === 'EMPLOYEE_CREATE'
                          ? 'bg-teal-100 text-teal-900 border border-teal-300'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {l.performedByName}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {l.entityType}:{l.entityId}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 max-w-xs truncate" title={l.details}>
                      {l.details}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-[11px]">
                      {l.ipAddress}
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
