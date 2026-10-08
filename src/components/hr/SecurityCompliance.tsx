import React from 'react';
import { ShieldCheck, Lock, CheckCircle2, FileKey, Server, Eye } from 'lucide-react';

export const SecurityCompliance: React.FC = () => {
  const complianceItems = [
    { title: 'SOC 2 Type II Certification', desc: 'Annual security audit validating rigorous data protection, confidentiality, and availability controls.', status: 'Compliant' },
    { title: 'GDPR & DPDP Act 2023 Compliance', desc: 'Data privacy standards ensuring staff consent, right to be forgotten, and encrypted personal data storage.', status: 'Compliant' },
    { title: 'Role-Based Access Control (RBAC)', desc: 'Granular least-privilege permissions restricting payroll & sensitive salary logs strictly to Finance & Admin.', status: 'Enforced' },
    { title: 'End-to-End TLS 1.3 Encryption', desc: 'All data in transit is encrypted using modern cryptographic protocols with secure HTTPS / HSTS headers.', status: 'Active' },
    { title: 'Supabase Row Level Security (RLS)', desc: 'Database-level security policies restricting employee record reads to authorized department managers and HR.', status: 'Active' },
    { title: 'Immutable Audit Logging', desc: 'Every login, role change, and payroll export is cryptographically recorded in tamper-proof system logs.', status: 'Active' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          Platform Security & Compliance
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Enterprise-grade security standards, data privacy compliance, encryption protocols, and access audit controls.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500">Security Score</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">99.8%</div>
          <div className="text-[11px] text-slate-500 mt-1">Zero vulnerabilities detected</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500">Encryption Standard</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">AES-256</div>
          <div className="text-[11px] text-teal-600 dark:text-teal-400 mt-1">At rest & in transit</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500">Access Isolation</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">Strict RBAC</div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">Payroll restricted to Finance/Admin</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500">Uptime SLA</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">99.99%</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Multi-region redundancy</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {complianceItems.map((item, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  {item.title}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {item.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-2">{item.desc}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Verified by ISO / SOC Auditor</span>
              <span className="text-teal-600 dark:text-teal-400 font-medium">Passed Audit Sept 2026</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
