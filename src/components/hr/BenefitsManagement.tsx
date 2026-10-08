import React from 'react';
import { HeartHandshake, Shield, CheckCircle2, Gift, Umbrella } from 'lucide-react';

export const BenefitsManagement: React.FC = () => {
  const benefits = [
    { title: 'Comprehensive Health Insurance', desc: '₹10,00,000 family floater cover including cashless hospitalization and OPD consultations.', enrolled: '142 staff', status: 'Active' },
    { title: 'Term Life & Accident Cover', desc: '3x annual CTC life insurance and permanent disability protection for all full-time employees.', enrolled: '142 staff', status: 'Active' },
    { title: 'Provident Fund (PF) & Gratuity', desc: 'Statutory EPF contribution matched at 12% with gratuity vesting as per Indian Labour Code.', enrolled: '142 staff', status: 'Active' },
    { title: 'Wellness & Gym Allowance', desc: 'Monthly ₹2,500 wellness stipend for gym memberships, yoga classes, or mental health therapy.', enrolled: '98 staff', status: 'Active' },
    { title: 'Annual Health Check-up', desc: 'Full body preventive health screening package annually at SecondMedic partner clinics.', enrolled: '130 staff', status: 'Active' },
    { title: 'Professional Development Stipend', desc: '₹30,000 per year for certifications, medical conferences, and upskilling courses.', enrolled: '64 staff', status: 'Active' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <HeartHandshake className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          Benefits Management
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Manage corporate healthcare plans, insurance policies, wellness allowances, and statutory benefits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Active Insurance Plan</span>
            <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Care Health Supreme</div>
          <p className="text-[11px] text-slate-500 mt-1">Policy #SM-MED-2026-90 (Valid till Mar 2027)</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Employee Enrollment</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">98.6%</div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">142 of 144 eligible staff covered</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Wellness Claims YTD</span>
            <Gift className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹4.8L</div>
          <p className="text-[11px] text-slate-500 mt-1">Processed across 98 claims</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {benefits.map((b, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{b.title}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {b.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{b.desc}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500">Enrolled: <strong className="text-slate-900 dark:text-slate-100">{b.enrolled}</strong></span>
              <button
                onClick={() => alert(`Managing benefit: ${b.title}`)}
                className="text-teal-700 dark:text-teal-400 font-semibold hover:underline"
              >
                Configure Plan →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
