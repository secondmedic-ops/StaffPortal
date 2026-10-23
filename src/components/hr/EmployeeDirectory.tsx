import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../api';
import { Employee, Department, EmploymentType } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { Users, Search, Plus, Edit2, Filter, Mail, Phone, Building2, ChevronRight, RotateCw, ExternalLink } from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { EmployeeProfileView } from './EmployeeProfileView';

export const EmployeeDirectory: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Full profile view state
  const [viewingProfileId, setViewingProfileId] = useState<number | null>(null);
  const [sendingLogins, setSendingLogins] = useState(false);

  // Add / Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // Form State
  const [empCode, setEmpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState<number>(1);
  const [designation, setDesignation] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('FULL_TIME');
  const [joiningDate, setJoiningDate] = useState('2026-09-15');
  const [managerId, setManagerId] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const [empList, deptList] = await Promise.all([
        hrApi.getEmployees(),
        hrApi.getDepartments()
      ]);
      setEmployees(empList);
      setDepartments(deptList);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [currentUser?.id]);

  const openAddModal = () => {
    setEditingEmp(null);
    setEmpCode(`SM00${employees.length + 1}`);
    setFullName('');
    setOfficialEmail('');
    setPhone('');
    setDepartmentId(departments[0]?.id || 1);
    setDesignation('');
    setEmploymentType('FULL_TIME');
    setJoiningDate('2026-09-15');
    setManagerId(departments[0]?.headId || 1);
    setShowAddModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpCode(emp.empCode);
    setFullName(emp.fullName);
    setOfficialEmail(emp.officialEmail);
    setPhone(emp.phone);
    setDepartmentId(emp.departmentId);
    setDesignation(emp.designation);
    setEmploymentType(emp.employmentType);
    setJoiningDate(emp.joiningDate);
    setManagerId(emp.managerId);
    setShowAddModal(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingEmp) {
        await hrApi.updateEmployee(editingEmp.id, {
          fullName,
          phone,
          departmentId,
          designation,
          employmentType,
          managerId
        });
        showToast('Updated', `Employee profile updated for ${fullName}.`, 'success');
      } else {
        await hrApi.createEmployee({
          empCode,
          fullName,
          officialEmail,
          phone,
          joiningDate,
          departmentId,
          designation,
          employmentType,
          status: 'ACTIVE',
          managerId
        });
        showToast('Enrolled', `New employee ${fullName} (${empCode}) added with initialized leave balances.`, 'success');
      }
      setShowAddModal(false);
      fetchEmployees();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to save employee profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSendLoginsToUnassigned = async () => {
    if (!confirm('This will dispatch portal login invites to all active employees who do not currently have a portal login. Continue?')) {
      return;
    }

    setSendingLogins(true);
    try {
      const results = await hrApi.sendLoginInviteToUnassignedStaff();
      const successCount = results.filter(r => r.status === 'INVITED').length;
      showToast(
        'Login Invites Sent',
        `Dispatched login invites to ${successCount} staff member(s).`,
        'success'
      );
      fetchEmployees();
    } catch (err: any) {
      showToast('Invite Error', err.message || 'Could not send invites', 'error');
    } finally {
      setSendingLogins(false);
    }
  };

  const filtered = employees.filter(e => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      e.fullName.toLowerCase().includes(q) ||
      e.empCode.toLowerCase().includes(q) ||
      (e.officialEmail && e.officialEmail.toLowerCase().includes(q)) ||
      (e.personalEmail && e.personalEmail.toLowerCase().includes(q)) ||
      (e.phone && e.phone.includes(q)) ||
      (e.designation && e.designation.toLowerCase().includes(q));
    const matchesDept = deptFilter === 'ALL' || e.departmentName === deptFilter;
    const matchesType = typeFilter === 'ALL' || e.employmentType === typeFilter;
    return matchesSearch && matchesDept && matchesType;
  });

  if (viewingProfileId !== null) {
    return (
      <EmployeeProfileView
        employeeId={viewingProfileId}
        onBack={() => {
          setViewingProfileId(null);
          fetchEmployees();
        }}
      />
    );
  }

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">Employee Master Directory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Central workforce registry (HR scope: Profiles, reporting authority, shifts & leave masters. No salary access)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSendLoginsToUnassigned}
            disabled={sendingLogins}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-50"
            title="Send portal login credentials to staff without active logins"
          >
            <Mail className="w-3.5 h-3.5 text-teal-600" />
            {sendingLogins ? 'Sending...' : 'Send Login Invites'}
          </button>
          <button
            onClick={fetchEmployees}
            disabled={loading}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh directory list from database"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-700' : ''}`} /> Refresh
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Enroll New Employee
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by staff name, code, email, designation..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Types</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="FIELD">Field (GPS)</option>
            <option value="CONSULTANT">Consultant</option>
            <option value="INTERN">Intern</option>
          </select>
        </div>
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
                  <th className="px-5 py-3">Code & Name</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Designation</th>
                  <th className="px-5 py-3">Reporting Manager</th>
                  <th className="px-5 py-3">Employment Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setViewingProfileId(emp.id)}
                        className="font-bold text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 text-left transition"
                      >
                        {emp.fullName}
                      </button>
                      <div className="text-[12.5px] text-slate-500 dark:text-slate-400 font-mono">{emp.empCode} • {emp.officialEmail}</div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                      {emp.departmentName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                      {emp.designation}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                      {emp.managerName || 'None (Direct to Board)'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11.5px] font-bold px-1.5 py-0.5 rounded ${
                        emp.employmentType === 'FIELD' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {emp.employmentType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={emp.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingProfileId(emp.id)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 transition"
                          title="View 360 Profile"
                        >
                          View 360°
                        </button>
                        <button
                          onClick={() => openEditModal(emp)}
                          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                          title="Quick Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title={editingEmp ? `Edit Profile: ${editingEmp.fullName}` : 'Enroll New SecondMedic Employee'}
          subtitle="HR Employee Master Record (Does not contain salary configuration)"
        >
          <form onSubmit={handleSaveEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Employee Code</label>
                <input
                  type="text"
                  value={empCode}
                  onChange={e => setEmpCode(e.target.value)}
                  disabled={!!editingEmp}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 font-mono disabled:bg-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Ananya Sen"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Email</label>
                <input
                  type="email"
                  value={officialEmail}
                  onChange={e => setOfficialEmail(e.target.value)}
                  disabled={!!editingEmp}
                  placeholder="ananya.sen@secondmedic.com"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:bg-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={e => setDepartmentId(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={e => setDesignation(e.target.value)}
                  placeholder="e.g. Lead Pathologist"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={e => setEmploymentType(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                >
                  <option value="FULL_TIME">Full Time (HQ Office)</option>
                  <option value="FIELD">Field (Mobile Geotagged)</option>
                  <option value="CONSULTANT">Consultant Doctor</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Reporting Manager</label>
                <select
                  value={managerId || ''}
                  onChange={e => setManagerId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                >
                  <option value="">None (Top-Level Executive)</option>
                  {employees
                    .filter(e => !editingEmp || e.id !== editingEmp.id)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.designation})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingEmp ? 'Save Changes' : 'Enroll Employee'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
