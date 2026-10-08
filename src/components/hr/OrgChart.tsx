import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../api';
import { Employee } from '../../types';
import { Users, GitFork, ChevronDown, ChevronRight, Mail, Phone } from 'lucide-react';
import { SkeletonLoader } from '../common/SkeletonLoader';

interface TreeNodeProps {
  employee: Employee;
  allEmployees: Employee[];
  depth?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ employee, allEmployees, depth = 0 }) => {
  const [expanded, setExpanded] = useState(true);
  const directReports = allEmployees.filter(e => e.managerId === employee.id);

  return (
    <div className="flex flex-col items-center">
      {/* Employee Node Card */}
      <div
        className={`w-64 p-3.5 rounded-xl border bg-white shadow-xs transition-all hover:shadow-md ${
          depth === 0
            ? 'border-teal-400 ring-2 ring-teal-100 bg-teal-50/20'
            : depth === 1
            ? 'border-blue-300'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400">{employee.empCode}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
            depth === 0 ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {employee.employmentType}
          </span>
        </div>

        <div className="font-bold text-xs text-slate-900 mt-1">{employee.fullName}</div>
        <div className="text-[11px] text-teal-800 font-medium">{employee.designation}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{employee.departmentName}</div>

        {directReports.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 pt-2 border-t border-slate-100 w-full flex items-center justify-between text-[11px] font-semibold text-slate-600 hover:text-teal-700"
          >
            <span>{directReports.length} Direct {directReports.length === 1 ? 'Report' : 'Reports'}</span>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Children connector lines */}
      {expanded && directReports.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-6 bg-slate-300" />
          <div className="flex items-start justify-center gap-6 pt-2 relative">
            {directReports.map((report, idx) => (
              <div key={report.id} className="relative flex flex-col items-center">
                <TreeNode employee={report} allEmployees={allEmployees} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const OrgChart: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const list = await hrApi.getEmployees();
        setEmployees(list);
      } catch (err: any) {
        showToast('Error', err.message || 'Failed to load organizational structure', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [currentUser]);

  // Root is CEO (managerId is null/undefined)
  const rootEmployees = employees.filter(e => !e.managerId);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">Organization Reporting Hierarchy</h1>
        <p className="text-xs text-slate-500 mt-1">
          Visual authority map controlling leave approvals, KPI evaluation and shift assignments
        </p>
      </div>

      {loading ? (
        <SkeletonLoader rows={6} />
      ) : (
        <div className="bg-slate-50/50 p-8 rounded-xl border border-slate-200 overflow-x-auto min-h-[500px]">
          <div className="min-w-max flex justify-center">
            {rootEmployees.map(root => (
              <TreeNode key={root.id} employee={root} allEmployees={employees} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
