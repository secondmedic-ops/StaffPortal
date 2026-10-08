import React, { useState } from 'react';
import { Briefcase, Users, Plus, CheckCircle, Clock, XCircle, Search, Filter } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  role: string;
  department: string;
  stage: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';
  appliedDate: string;
  rating: number;
}

export const ApplicantTracking: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: 'CAND-101', name: 'Dr. Priya Nair', role: 'Senior Cardiologist', department: 'Clinical', stage: 'Interview', appliedDate: '2026-09-15', rating: 4.8 },
    { id: 'CAND-102', name: 'Rohan Deshmukh', role: 'Full Stack React Engineer', department: 'Engineering', stage: 'Offer', appliedDate: '2026-09-12', rating: 4.9 },
    { id: 'CAND-103', name: 'Sneha Kulkarni', role: 'HR Operations Specialist', department: 'Human Resources', stage: 'Screening', appliedDate: '2026-09-18', rating: 4.2 },
    { id: 'CAND-104', name: 'Karan Mehra', role: 'Finance Analyst', department: 'Accounts', stage: 'Applied', appliedDate: '2026-09-19', rating: 4.0 },
    { id: 'CAND-105', name: 'Dr. Amitav Ghosh', role: 'General Physician', department: 'Clinical', stage: 'Hired', appliedDate: '2026-09-01', rating: 5.0 },
  ]);

  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'ALL' || c.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const getStageBadge = (stage: Candidate['stage']) => {
    switch (stage) {
      case 'Hired': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'Offer': return 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300';
      case 'Interview': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
      case 'Screening': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      case 'Rejected': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Applicant Tracking System (ATS)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage open clinical and corporate job postings, applicant pipelines, and interview stages.
          </p>
        </div>
        <button
          onClick={() => alert('New Job Requisition dialog opened')}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-teal-900/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Post New Job Opening</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">Active Openings</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">12</div>
          <div className="text-[11px] text-teal-600 dark:text-teal-400 mt-1 font-medium">4 Urgent Clinical Roles</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Applicants</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">148</div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">+24 this week</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">Interviews Scheduled</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">18</div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">Next 48 hours</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">Offers Accepted</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">7</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Onboarding in progress</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search candidate or role..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs text-slate-500 font-medium">Stage:</span>
            {['ALL', ...stages].map(st => (
              <button
                key={st}
                onClick={() => setStageFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  stageFilter === st
                    ? 'bg-teal-700 dark:bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Role Applied</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Applied Date</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4">Pipeline Stage</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredCandidates.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{c.name}</td>
                  <td className="py-3 px-4">{c.role}</td>
                  <td className="py-3 px-4">{c.department}</td>
                  <td className="py-3 px-4 text-slate-500">{c.appliedDate}</td>
                  <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">★ {c.rating}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStageBadge(c.stage)}`}>
                      {c.stage}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => alert(`Reviewing candidate: ${c.name}`)}
                      className="px-2.5 py-1 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 text-[11px] font-medium"
                    >
                      View Profile
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
