import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { accountsApi, meApi } from '../../api';
import { Payslip } from '../../types';
import { getMonthName } from '../../utils/dateUtils';
import {
  FileText,
  UploadCloud,
  Eye,
  CheckCircle2,
  Lock,
  Download,
  Search,
  Filter,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const PayslipGenerator: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(8);
  const [year, setYear] = useState(2026);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'BULK_UPLOAD'>('REGISTER');

  // Preview Modal
  const [previewSlip, setPreviewSlip] = useState<Payslip | null>(null);

  // Bulk Upload State
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      const data = await accountsApi.getAllPayslips(month, year);
      setPayslips(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load payslips', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslips();
  }, [month, year, currentUser]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const filesArr = Array.from(e.dataTransfer.files);
      setUploadedFiles(prev => [...prev, ...filesArr]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...filesArr]);
    }
  };

  const handleExecuteBulkUpload = async () => {
    if (uploadedFiles.length === 0) {
      showToast('No Files', 'Please drop or choose at least one PDF payslip.', 'error');
      return;
    }

    setUploading(true);
    try {
      await accountsApi.uploadBulkPayslips(month, year, uploadedFiles);
      showToast(
        'Upload Processed',
        `Successfully ingested and encrypted ${uploadedFiles.length} CA-prepared payslip PDFs. Matched by employee code.`,
        'success'
      );
      setUploadedFiles([]);
      setActiveTab('REGISTER');
      fetchPayslips();
    } catch (err: any) {
      showToast('Upload Error', err.message || 'Bulk upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const filtered = payslips.filter(p =>
    p.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    p.employeeCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payslip Operations & Bulk Ingestion</h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate system-computed payslips or upload CA-verified signed PDFs
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('REGISTER')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'REGISTER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Disbursement Ledger
          </button>
          <button
            onClick={() => setActiveTab('BULK_UPLOAD')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'BULK_UPLOAD' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" /> Bulk PDF Upload
          </button>
        </div>
      </div>

      {activeTab === 'REGISTER' ? (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or emp code..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Month:</span>
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800">
                {getMonthName(month)} {year}
              </span>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <SkeletonLoader type="table" rows={5} />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                    <tr>
                      <th className="px-5 py-3.5">Employee</th>
                      <th className="px-5 py-3.5">Source</th>
                      <th className="px-5 py-3.5 text-center">Paid / LOP</th>
                      <th className="px-5 py-3.5 text-right">Gross</th>
                      <th className="px-5 py-3.5 text-right">LOP Deduction</th>
                      <th className="px-5 py-3.5 text-right">Total Deductions</th>
                      <th className="px-5 py-3.5 text-right">Net Payable</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{p.employeeName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{p.employeeCode}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {p.source}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-mono">
                          <span className="font-bold text-slate-800">{p.paidDays}d</span>
                          {p.lopDays > 0 && (
                            <span className="text-rose-600 ml-1 font-bold">({p.lopDays}d LOP)</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-800 font-medium">
                          ₹{p.grossAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-rose-700">
                          {p.components.lopDeduction > 0 ? `₹${p.components.lopDeduction.toLocaleString('en-IN')}` : '₹0'}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-rose-700">
                          ₹{p.totalDeductions.toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-extrabold text-teal-800">
                          ₹{p.netAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill status={p.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => setPreviewSlip(p)}
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                            title="Preview Payslip"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Bulk PDF Upload Tab */
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Bulk Ingest Chartered Accountant Payslips</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload multiple encrypted PDF files naming format: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-teal-800">[EMPCODE]_[YYYYMM].pdf</code> (e.g. SM001_202608.pdf)
            </p>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive ? 'border-teal-600 bg-teal-50/30' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
            }`}
          >
            <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">
              Drag and drop bulk PDF files here, or{' '}
              <label className="text-teal-700 hover:underline cursor-pointer">
                browse files
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Supports batch upload up to 100 employee slips</p>
          </div>

          {/* Queued files */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Ready for Ingestion ({uploadedFiles.length} files)
                </span>
                <button
                  onClick={() => setUploadedFiles([])}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Clear All
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-700 truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExecuteBulkUpload}
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {uploading ? 'Validating & Ingesting...' : `Ingest & Publish ${uploadedFiles.length} Slips`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payslip View Modal */}
      {previewSlip && (
        <Modal
          isOpen={!!previewSlip}
          onClose={() => setPreviewSlip(null)}
          title={`Payslip: ${previewSlip.employeeName} (${previewSlip.employeeCode})`}
          subtitle={`${getMonthName(previewSlip.month)} ${previewSlip.year} • Status: ${previewSlip.status}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono">
              <div>Basic: ₹{previewSlip.components.basic.toLocaleString('en-IN')}</div>
              <div>HRA: ₹{previewSlip.components.hra.toLocaleString('en-IN')}</div>
              <div>Special: ₹{previewSlip.components.specialAllowance.toLocaleString('en-IN')}</div>
              <div>PF: ₹{previewSlip.components.pf.toLocaleString('en-IN')}</div>
              <div>PT: ₹{previewSlip.components.pt.toLocaleString('en-IN')}</div>
              <div>LOP Deduct: ₹{previewSlip.components.lopDeduction.toLocaleString('en-IN')}</div>
            </div>
            <div className="flex justify-between items-center bg-teal-900 text-white p-3 rounded-lg">
              <span className="font-bold">Net Salary Payable:</span>
              <span className="text-base font-extrabold font-mono">
                ₹{previewSlip.netAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewSlip(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white"
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
