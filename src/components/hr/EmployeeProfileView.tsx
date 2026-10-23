import React, { useState, useEffect } from 'react';
import { hrApi } from '../../api';
import { documentsApi } from '../../api/documents';
import { historyApi } from '../../api/history';
import { branchesApi } from '../../api/branches';
import { useAuth } from '../../context/AuthContext';
import { UserAvatar } from '../common/UserAvatar';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { Modal } from '../common/Modal';
import { formatServiceDuration, formatDate, formatDateTime } from '../../utils/dateUtils';
import type { Branch, EmployeeDocument, EmployeeHistoryItem, Department, Employee } from '../../types';
import {
  ArrowLeft,
  User,
  Briefcase,
  ShieldCheck,
  HeartHandshake,
  FolderOpen,
  History,
  Save,
  Upload,
  Download,
  Trash2,
  Eye,
  Building2,
  Calendar,
  Phone,
  Mail,
  Loader2,
  Plus
} from 'lucide-react';

interface EmployeeProfileViewProps {
  employeeId: number;
  onBack: () => void;
}

type TabType = 'personal' | 'job' | 'statutory' | 'emergency' | 'documents' | 'history';

export const EmployeeProfileView: React.FC<EmployeeProfileViewProps> = ({ employeeId, onBack }) => {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('personal');

  const [employee, setEmployee] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [history, setHistory] = useState<EmployeeHistoryItem[]>([]);

  // Metadata dropdowns
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffList, setStaffList] = useState<Employee[]>([]);

  // Editable fields state
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Document upload modal
  const [showDocModal, setShowDocModal] = useState(false);
  const [docCategory, setDocCategory] = useState<EmployeeDocument['category']>('Other');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [fullProf, depts, brs, staff] = await Promise.all([
        hrApi.getFullEmployeeProfile(employeeId),
        hrApi.getDepartments(),
        branchesApi.getBranches(true),
        hrApi.getEmployees()
      ]);

      setEmployee(fullProf.employee);
      setProfile(fullProf.profile || {});
      setFinancials(fullProf.financials || {});
      setDocuments(fullProf.documents || []);
      setHistory(fullProf.history || []);

      setDepartments(depts);
      setBranches(brs);
      setStaffList(staff);

      // Initialize form data
      setFormData({
        // Personal
        full_name: fullProf.employee.full_name,
        date_of_birth: fullProf.profile?.date_of_birth || '',
        gender: fullProf.profile?.gender || '',
        blood_group: fullProf.profile?.blood_group || '',
        marital_status: fullProf.profile?.marital_status || '',
        father_name: fullProf.profile?.father_name || '',
        current_address: fullProf.profile?.current_address || '',
        permanent_address: fullProf.profile?.permanent_address || '',
        personal_email: fullProf.employee.personal_email || '',
        mobile: fullProf.employee.mobile || '',
        // Job
        designation: fullProf.employee.designation,
        department_id: fullProf.employee.department_id,
        branch_id: fullProf.employee.branch_id || '',
        employment_type: fullProf.employee.employment_type,
        manager_id: fullProf.employee.manager_id || '',
        date_of_joining: fullProf.employee.date_of_joining || '',
        status: fullProf.employee.status,
        probation_end_date: fullProf.employee.probation_end_date || '',
        // Statutory
        pan_number: fullProf.financials?.pan_number || '',
        aadhaar_number: fullProf.financials?.aadhaar_number || '',
        uan_number: fullProf.financials?.uan_number || '',
        esic_number: fullProf.financials?.esic_number || '',
        bank_name: fullProf.financials?.bank_name || '',
        bank_account_number: fullProf.financials?.bank_account_number || '',
        bank_ifsc: fullProf.financials?.bank_ifsc || '',
        payment_mode: fullProf.financials?.payment_mode || 'BANK_TRANSFER',
        // Emergency
        emergency_contact_name: fullProf.profile?.emergency_contact_name || '',
        emergency_contact_relation: fullProf.profile?.emergency_contact_relation || '',
        emergency_contact_phone: fullProf.profile?.emergency_contact_phone || ''
      });
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load employee profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [employeeId]);

  const handleChange = (field: string, val: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Split into employee, profile, and financials updates
      const empPayload: Record<string, any> = {
        full_name: formData.full_name?.trim(),
        personal_email: formData.personal_email?.trim() || null,
        mobile: formData.mobile?.trim() || null,
        designation: formData.designation?.trim(),
        department_id: Number(formData.department_id),
        branch_id: formData.branch_id ? Number(formData.branch_id) : null,
        employment_type: formData.employment_type,
        manager_id: formData.manager_id ? Number(formData.manager_id) : null,
        date_of_joining: formData.date_of_joining || null,
        status: formData.status,
        probation_end_date: formData.probation_end_date || null
      };

      const profPayload: Record<string, any> = {
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        blood_group: formData.blood_group || null,
        marital_status: formData.marital_status || null,
        father_name: formData.father_name?.trim() || null,
        current_address: formData.current_address?.trim() || null,
        permanent_address: formData.permanent_address?.trim() || null,
        emergency_contact_name: formData.emergency_contact_name?.trim() || null,
        emergency_contact_relation: formData.emergency_contact_relation?.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone?.trim() || null
      };

      const finPayload: Record<string, any> = {
        pan_number: formData.pan_number?.trim() || null,
        aadhaar_number: formData.aadhaar_number?.trim() || null,
        uan_number: formData.uan_number?.trim() || null,
        esic_number: formData.esic_number?.trim() || null,
        bank_name: formData.bank_name?.trim() || null,
        bank_account_number: formData.bank_account_number?.trim() || null,
        bank_ifsc: formData.bank_ifsc?.trim() || null,
        payment_mode: formData.payment_mode || 'BANK_TRANSFER'
      };

      await hrApi.updateFullEmployeeProfile(employeeId, {
        employee: empPayload,
        profile: profPayload,
        financials: finPayload
      });

      showToast('Saved', `Profile of ${formData.full_name} has been updated.`, 'success');
      loadAll();
    } catch (err: any) {
      showToast('Save Failed', err.message || 'Could not update employee profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;

    setUploadingDoc(true);
    try {
      await documentsApi.uploadEmployeeDocument(employeeId, docCategory, docFile);
      showToast('Document Uploaded', `${docFile.name} added under ${docCategory}.`, 'success');
      setShowDocModal(false);
      setDocFile(null);
      const docs = await documentsApi.getDocumentsForEmployee(employeeId);
      setDocuments(docs);
    } catch (err: any) {
      showToast('Upload Failed', err.message || 'Could not upload document', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleViewDoc = async (doc: EmployeeDocument) => {
    try {
      const url = await documentsApi.getSignedUrl('employee-documents', doc.filePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to open document', 'error');
    }
  };

  const handleDeleteDoc = async (doc: EmployeeDocument) => {
    if (!confirm(`Delete ${doc.name}?`)) return;
    try {
      await documentsApi.deleteEmployeeDocument(doc.id, doc.filePath);
      showToast('Deleted', 'Document removed.', 'info');
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to delete document', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <SkeletonLoader rows={8} />
      </div>
    );
  }

  const tabs: Array<{ id: TabType; label: string; icon: React.ElementType }> = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'job', label: 'Job', icon: Briefcase },
    { id: 'statutory', label: 'Statutory', icon: ShieldCheck },
    { id: 'emergency', label: 'Emergency', icon: HeartHandshake },
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'history', label: 'History', icon: History }
  ];

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Staff Directory
        </button>
      </div>

      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row items-center gap-6">
        <UserAvatar fullName={employee?.full_name || ''} avatarUrl={employee?.avatar_url} size="xl" className="h-20 w-20 text-2xl" />
        <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{employee?.full_name}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {employee?.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {employee?.designation} • {employee?.emp_code} • {employee?.department?.name}
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 pt-1">
            <span>Branch: {employee?.branch?.name || employee?.work_location || 'Corporate HQ'}</span>
            <span>Service: {formatServiceDuration(employee?.date_of_joining)}</span>
            <span>Reporting to: {employee?.manager?.full_name || 'None'}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 flex items-center gap-2 transition-colors ${
                active
                  ? 'border-teal-600 text-teal-700 dark:text-teal-400 bg-teal-50/30 dark:bg-teal-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.id === 'documents' && <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 font-bold">{documents.length}</span>}
              {t.id === 'history' && <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 font-bold">{history.length}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab Contents Form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
        {activeTab === 'personal' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 pb-2 border-b border-slate-100 dark:border-slate-800">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.full_name || ''}
                  onChange={e => handleChange('full_name', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.date_of_birth || ''}
                  onChange={e => handleChange('date_of_birth', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                <select
                  value={formData.gender || ''}
                  onChange={e => handleChange('gender', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
                <input
                  type="text"
                  value={formData.blood_group || ''}
                  onChange={e => handleChange('blood_group', e.target.value)}
                  placeholder="e.g. O+, B+"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Marital Status</label>
                <select
                  value={formData.marital_status || ''}
                  onChange={e => handleChange('marital_status', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Father's / Guardian's Name</label>
                <input
                  type="text"
                  value={formData.father_name || ''}
                  onChange={e => handleChange('father_name', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Personal Email</label>
                <input
                  type="email"
                  value={formData.personal_email || ''}
                  onChange={e => handleChange('personal_email', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={formData.mobile || ''}
                  onChange={e => handleChange('mobile', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Residential Address</label>
                <textarea
                  rows={2}
                  value={formData.current_address || ''}
                  onChange={e => handleChange('current_address', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Permanent Address</label>
                <textarea
                  rows={2}
                  value={formData.permanent_address || ''}
                  onChange={e => handleChange('permanent_address', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'job' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 pb-2 border-b border-slate-100 dark:border-slate-800">
              Job & Organizational Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={formData.designation || ''}
                  onChange={e => handleChange('designation', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <select
                  required
                  value={formData.department_id || ''}
                  onChange={e => handleChange('department_id', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Branch Location</label>
                <select
                  value={formData.branch_id || ''}
                  onChange={e => handleChange('branch_id', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select branch</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Employment Type</label>
                <select
                  value={formData.employment_type || ''}
                  onChange={e => handleChange('employment_type', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="FULL_TIME">Full Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                  <option value="FIELD">Field</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONSULTANT">Consultant</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Reporting Authority</label>
                <select
                  value={formData.manager_id || ''}
                  onChange={e => handleChange('manager_id', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">None (Reports to HR)</option>
                  {staffList.filter(s => s.id !== employeeId).map(s => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.designation})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Date of Joining</label>
                <input
                  type="date"
                  value={formData.date_of_joining || ''}
                  onChange={e => handleChange('date_of_joining', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Employment Status</label>
                <select
                  value={formData.status || ''}
                  onChange={e => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PROBATION">PROBATION</option>
                  <option value="NOTICE_PERIOD">NOTICE PERIOD</option>
                  <option value="EXITED">EXITED</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Probation End Date</label>
                <input
                  type="date"
                  value={formData.probation_end_date || ''}
                  onChange={e => handleChange('probation_end_date', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'statutory' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 pb-2 border-b border-slate-100 dark:border-slate-800">
              Statutory & Banking Identifiers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">PAN Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={formData.pan_number || ''}
                  onChange={e => handleChange('pan_number', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Aadhaar Number</label>
                <input
                  type="text"
                  maxLength={12}
                  value={formData.aadhaar_number || ''}
                  onChange={e => handleChange('aadhaar_number', e.target.value.replace(/\D/g, ''))}
                  placeholder="12 digits"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">UAN Number</label>
                <input
                  type="text"
                  value={formData.uan_number || ''}
                  onChange={e => handleChange('uan_number', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ESIC Number</label>
                <input
                  type="text"
                  value={formData.esic_number || ''}
                  onChange={e => handleChange('esic_number', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name || ''}
                  onChange={e => handleChange('bank_name', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank Account Number</label>
                <input
                  type="text"
                  value={formData.bank_account_number || ''}
                  onChange={e => handleChange('bank_account_number', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank IFSC Code</label>
                <input
                  type="text"
                  maxLength={11}
                  value={formData.bank_ifsc || ''}
                  onChange={e => handleChange('bank_ifsc', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'emergency' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 pb-2 border-b border-slate-100 dark:border-slate-800">
              Emergency Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={formData.emergency_contact_name || ''}
                  onChange={e => handleChange('emergency_contact_name', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Relationship</label>
                <input
                  type="text"
                  value={formData.emergency_contact_relation || ''}
                  onChange={e => handleChange('emergency_contact_relation', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Emergency Phone</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={formData.emergency_contact_phone || ''}
                  onChange={e => handleChange('emergency_contact_phone', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Employee Document Vault (HR Private)
              </h3>
              <button
                type="button"
                onClick={() => setShowDocModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Upload Document
              </button>
            </div>

            {documents.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No documents uploaded for this employee yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Document Name</th>
                      <th className="px-4 py-2.5">Size</th>
                      <th className="px-4 py-2.5">Uploaded By</th>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {documents.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-semibold text-teal-700 dark:text-teal-400">{d.category}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{d.name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{(d.size / 1024).toFixed(0)} KB</td>
                        <td className="px-4 py-2.5 text-slate-500">{d.uploadedByName || 'HR'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{formatDate(d.uploadedAt)}</td>
                        <td className="px-4 py-2.5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleViewDoc(d)}
                            className="p-1 text-slate-600 hover:text-teal-600 dark:hover:text-teal-400"
                            title="View document"
                          >
                            <Eye className="w-4 h-4 inline" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(d)}
                            className="p-1 text-slate-600 hover:text-rose-600"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 pb-2 border-b border-slate-100 dark:border-slate-800">
              Employment History Log
            </h3>
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No field changes recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map(item => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                        {item.field} Changed
                      </div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        <span className="text-slate-400 line-through mr-2">{item.oldValue || 'None'}</span>
                        <span className="text-teal-600 dark:text-teal-300 font-semibold">{item.newValue || 'None'}</span>
                      </div>
                      <div className="text-[11.5px] text-slate-400 mt-1">
                        Changed by {item.changedByName || 'System'}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{formatDateTime(item.changedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab !== 'documents' && activeTab !== 'history' && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center gap-2 shadow-xs transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>

      {/* Upload Document Modal */}
      {showDocModal && (
        <Modal
          isOpen={showDocModal}
          onClose={() => setShowDocModal(false)}
          title="Upload Staff Document"
          subtitle={`Securely stored in HR private vault for ${employee?.full_name}.`}
        >
          <form onSubmit={handleUploadDoc} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Document Category</label>
              <select
                value={docCategory}
                onChange={e => setDocCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="Offer letter">Offer letter</option>
                <option value="Appointment letter">Appointment letter</option>
                <option value="ID proof">ID proof</option>
                <option value="Address proof">Address proof</option>
                <option value="Education">Education</option>
                <option value="Experience/Relieving">Experience / Relieving</option>
                <option value="Medical registration">Medical registration</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select File (Max 10 MB)</label>
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                onChange={e => setDocFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadingDoc || !docFile}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60"
              >
                {uploadingDoc ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
