import React, { useState, useEffect } from 'react';
import { emailApi } from '../../api/email';
import { useAuth } from '../../context/AuthContext';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { Modal } from '../common/Modal';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import type { EmailOutboxItem } from '../../types';
import {
  Mail,
  RefreshCw,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  RotateCw,
  Filter,
  Loader2
} from 'lucide-react';

export const EmailLogView: React.FC = () => {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EmailOutboxItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SENT' | 'FAILED'>('ALL');
  const [selectedItem, setSelectedItem] = useState<EmailOutboxItem | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [flushing, setFlushing] = useState(false);

  const fetchOutbox = async () => {
    try {
      setLoading(true);
      const data = await emailApi.getOutbox(statusFilter === 'ALL' ? undefined : statusFilter);
      setItems(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load email outbox', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutbox();
  }, [statusFilter]);

  const handleResend = async (id: number) => {
    setResendingId(id);
    try {
      await emailApi.resendEmail(id);
      showToast('Queued', 'Email has been queued for immediate retransmission.', 'success');
      fetchOutbox();
    } catch (err: any) {
      showToast('Resend Failed', err.message || 'Could not resend email', 'error');
    } finally {
      setResendingId(null);
    }
  };

  const handleTriggerBatch = async () => {
    setFlushing(true);
    try {
      const res = await emailApi.triggerSendBatch();
      showToast('Batch Processed', `Dispatched pending emails (Processed: ${res.processed}).`, 'success');
      fetchOutbox();
    } catch (err: any) {
      showToast('Batch Notice', err.message || 'Edge function dispatched via background runner.', 'info');
      fetchOutbox();
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2.5">
            <Mail className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Email Transmission Log
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Monitor outbound notifications, review delivery statuses, and retry failed SMTP transmissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchOutbox}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleTriggerBatch}
            disabled={flushing}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-xs disabled:opacity-60"
          >
            {flushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Flush Queue Now
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-fit">
        {(['ALL', 'PENDING', 'SENT', 'FAILED'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === s
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Log Table */}
      {loading ? (
        <SkeletonLoader rows={6} />
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
          No outbound emails found for the selected filter.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Template</th>
                  <th className="px-5 py-3.5">Recipient</th>
                  <th className="px-5 py-3.5">Subject</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Attempts</th>
                  <th className="px-5 py-3.5">Created At</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-mono font-semibold text-teal-700 dark:text-teal-400">
                      {row.template}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{row.to}</div>
                      {row.cc && <div className="text-[11px] text-slate-400">CC: {row.cc}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium max-w-xs truncate">
                      {row.subject}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold border ${
                        row.status === 'SENT'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : row.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        {row.status === 'SENT' ? <CheckCircle2 className="w-3 h-3" /> : row.status === 'PENDING' ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-500">
                      {row.attempts} / 3
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(row)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-teal-600 dark:hover:text-teal-400 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                      {(row.status === 'FAILED' || row.status === 'PENDING') && (
                        <button
                          type="button"
                          onClick={() => handleResend(row.id)}
                          disabled={resendingId === row.id}
                          className="px-2.5 py-1 text-xs font-semibold text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg inline-flex items-center gap-1"
                        >
                          {resendingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                          Resend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedItem && (
        <Modal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={`Email Message: #${selectedItem.id}`}
          subtitle={`Template: ${selectedItem.template} • Status: ${selectedItem.status}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div>
                <span className="text-slate-400 block">Recipient (To)</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedItem.to}</span>
              </div>
              <div>
                <span className="text-slate-400 block">CC</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedItem.cc || 'None'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">Subject</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedItem.subject}</span>
              </div>
              {selectedItem.sentAt && (
                <div className="col-span-2">
                  <span className="text-slate-400 block">Delivered At</span>
                  <span className="font-semibold text-emerald-600">{formatDateTime(selectedItem.sentAt)}</span>
                </div>
              )}
            </div>

            {selectedItem.lastError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300">
                <span className="font-semibold block mb-0.5">Last SMTP Error:</span>
                <span className="font-mono">{selectedItem.lastError}</span>
              </div>
            )}

            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Payload JSON</span>
              <pre className="p-3 rounded-lg bg-slate-900 text-teal-300 font-mono text-[11.5px] overflow-x-auto max-h-60">
                {JSON.stringify(selectedItem.payload, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
