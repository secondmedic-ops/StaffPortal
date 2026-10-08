import React, { useState } from 'react';
import { FileText, Download, Upload, Search, CheckCircle, FolderOpen } from 'lucide-react';

interface DocItem {
  id: string;
  name: string;
  category: 'Contract' | 'Policy' | 'Tax' | 'ID Proof' | 'Medical';
  employee: string;
  uploadDate: string;
  size: string;
  status: 'Verified' | 'Pending Review';
}

export const DocumentManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [docs, setDocs] = useState<DocItem[]>([
    { id: 'DOC-101', name: 'Employment_Agreement_Dr_Rahul.pdf', category: 'Contract', employee: 'Dr. Rahul Sharma', uploadDate: '2026-01-10', size: '2.4 MB', status: 'Verified' },
    { id: 'DOC-102', name: 'Form_16_FY2025_26_Anita.pdf', category: 'Tax', employee: 'Anita Roy', uploadDate: '2026-06-15', size: '1.1 MB', status: 'Verified' },
    { id: 'DOC-103', name: 'Aadhaar_PAN_Vikram_Malhotra.pdf', category: 'ID Proof', employee: 'Vikram Malhotra', uploadDate: '2026-03-01', size: '4.8 MB', status: 'Verified' },
    { id: 'DOC-104', name: 'Medical_Council_Registration_Sunita.pdf', category: 'Medical', employee: 'Dr. Sunita Patil', uploadDate: '2025-11-20', size: '1.5 MB', status: 'Verified' },
    { id: 'DOC-105', name: 'SecondMedic_Staff_Handbook_2026.pdf', category: 'Policy', employee: 'HR Department', uploadDate: '2026-01-01', size: '5.2 MB', status: 'Verified' },
    { id: 'DOC-106', name: 'Resignation_Notice_Amit.pdf', category: 'Contract', employee: 'Amit Verma', uploadDate: '2026-09-18', size: '840 KB', status: 'Pending Review' },
  ]);

  const categories = ['Contract', 'Policy', 'Tax', 'ID Proof', 'Medical'];

  const filteredDocs = docs.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.employee.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || d.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Document Management System
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Securely store, verify, and audit employment contracts, tax forms, ID proofs, and policy handbooks.
          </p>
        </div>
        <button
          onClick={() => alert('Document upload modal opened')}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-teal-900/20 transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search document or employee..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs text-slate-500 font-medium">Category:</span>
            {['ALL', ...categories].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'bg-teal-700 dark:bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Document Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Employee / Owner</th>
                <th className="py-3 px-4">Upload Date</th>
                <th className="py-3 px-4">File Size</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredDocs.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>{d.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
                      {d.category}
                    </span>
                  </td>
                  <td className="py-3 px-4">{d.employee}</td>
                  <td className="py-3 px-4 text-slate-500">{d.uploadDate}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{d.size}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      d.status === 'Verified' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => alert(`Downloading secure document: ${d.name}`)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-teal-700 hover:text-white transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
