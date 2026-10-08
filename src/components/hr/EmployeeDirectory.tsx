import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../api';
import { Employee, Department, EmploymentType } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { Users, Search, Plus, Edit2, Filter, Mail, Phone, Building2, ChevronRight } from 'lucide-react';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';

export const EmployeeDirectory: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

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
  }, [currentUser]);

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
          personalEmail: `${fullName.toLowerCase().replace(' ', '.')}@gmail.com`,
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

  const filtered = employees.filter(e => {
    const matchesSearch =
      e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.designation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = deptFilter === 'ALL' || e.departmentName === deptFilter;
    const matchesType = typeFilter === 'ALL' || e.employmentType === typeFilter;
    return matchesSearch && matchesDept && matchesType;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Employee Master Directory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Central workforce registry (HR scope: Profiles, reporting authority, shifts & leave masters. No salary access)
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Enroll New Employee
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by staff name, code, designation..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="text-xs p-2 rounded-lg border border-slate-300 font-medium bg-white text-slate-700"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs p-2 rounded-lg border border-slate-300 font-medium bg-white text-slate-700"
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
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
              <tbody className="divide-y divide-slate-100">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{emp.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{emp.empCode} • {emp.officialEmail}</div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {emp.departmentName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {emp.designation}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {emp.managerName || 'None (Direct to Board)'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        emp.employmentType === 'FIELD' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {emp.employmentType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={emp.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openEditModal(emp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                        title="Edit Details & Manager"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Code</label>
                <input
                  type="text"
                  value={empCode}
                  onChange={e => setEmpCode(e.target.value)}
                  disabled={!!editingEmp}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono disabled:bg-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Ananya Sen"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={officialEmail}
                  onChange={e => setOfficialEmail(e.target.value)}
                  disabled={!!editingEmp}
                  placeholder="ananya.sen@secondmedic.com"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={e => setDepartmentId(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={e => setDesignation(e.target.value)}
                  placeholder="e.g. Lead Pathologist"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={e => setEmploymentType(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium"
                >
                  <option value="FULL_TIME">Full Time (HQ Office)</option>
                  <option value="FIELD">Field (Mobile Geotagged)</option>
                  <option value="CONSULTANT">Consultant Doctor</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reporting Manager</label>
                <select
                  value={managerId || ''}
                  onChange={e => setManagerId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium"
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

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
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
