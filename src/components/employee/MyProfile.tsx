import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { meApi } from '../../api';
import { profileChangeApi } from '../../api/profileChange';
import { UserAvatar } from '../common/UserAvatar';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { Modal } from '../common/Modal';
import { formatServiceDuration } from '../../utils/dateUtils';
import type { ProfileChangeRequest } from '../../types';
import {
  Camera,
  Upload,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  Briefcase,
  ShieldCheck,
  HeartHandshake,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Save,
  Loader2
} from 'lucide-react';

export const MyProfile: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ employee: any; profile: any; financials: any } | null>(null);
  const [myChangeRequests, setMyChangeRequests] = useState<ProfileChangeRequest[]>([]);

  // Self-service edit state
  const [mobile, setMobile] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [savingSelfService, setSavingSelfService] = useState(false);

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Name change modal state
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameReason, setNameReason] = useState('');
  const [submittingNameChange, setSubmittingNameChange] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileData, requests] = await Promise.all([
        meApi.getMyProfileDetails(),
        profileChangeApi.getMyRequests()
      ]);
      setData(profileData);
      setMyChangeRequests(requests);

      if (profileData.employee) {
        setMobile(profileData.employee.mobile || '');
        setPersonalEmail(profileData.employee.personal_email || '');
      }
      if (profileData.profile) {
        setCurrentAddress(profileData.profile.current_address || '');
        setEmergencyName(profileData.profile.emergency_contact_name || '');
        setEmergencyRelation(profileData.profile.emergency_contact_relation || '');
        setEmergencyPhone(profileData.profile.emergency_contact_phone || '');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load profile details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  const handleSelfServiceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSelfService(true);
    try {
      await meApi.updateSelfServiceProfile({
        mobile,
        personalEmail,
        currentAddress,
        emergencyContactName: emergencyName,
        emergencyContactRelation: emergencyRelation,
        emergencyContactPhone: emergencyPhone
      });
      showToast('Profile Updated', 'Your contact and emergency details have been saved.', 'success');
      loadData();
    } catch (err: any) {
      showToast('Save Failed', err.message || 'Could not update profile', 'error');
    } finally {
      setSavingSelfService(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Invalid File', 'Please select a valid image file (PNG, JPG, WEBP).', 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      // Client-side crop to square and compression to <= 300KB
      const compressedBlob = await cropAndCompressSquare(file, 400, 300 * 1024);
      const compressedFile = new File([compressedBlob], `avatar_${Date.now()}.webp`, { type: 'image/webp' });

      await meApi.uploadAvatar(compressedFile);
      showToast('Photo Updated', 'Your profile photo has been updated.', 'success');
      loadData();
      // Reload page to reflect updated avatar everywhere
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      showToast('Upload Failed', err.message || 'Could not update profile photo', 'error');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleNameChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !nameReason.trim()) {
      showToast('Required Fields', 'Please enter your requested name and reason.', 'error');
      return;
    }

    setSubmittingNameChange(true);
    try {
      await profileChangeApi.submitRequest(
        'full_name',
        currentUser?.fullName,
        newName.trim(),
        nameReason.trim()
      );
      showToast('Request Submitted', 'Your name change request has been sent to HR for approval.', 'success');
      setShowNameModal(false);
      setNewName('');
      setNameReason('');
      loadData();
    } catch (err: any) {
      showToast('Submission Failed', err.message || 'Could not submit request', 'error');
    } finally {
      setSubmittingNameChange(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  const emp = data?.employee || currentUser;
  const prof = data?.profile;
  const fin = data?.financials;

  const maskNumber = (val?: string, visibleLast = 4) => {
    if (!val) return '—';
    if (val.length <= visibleLast) return val;
    const masked = '•'.repeat(val.length - visibleLast);
    return `${masked} ${val.slice(-visibleLast)}`;
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Banner / Hero */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
        <div className="relative group shrink-0">
          <UserAvatar fullName={emp?.full_name || ''} avatarUrl={emp?.avatar_url} size="xl" className="h-24 w-24 text-3xl" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 cursor-pointer"
            aria-label="Upload photo"
          >
            {uploadingPhoto ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
            <span className="text-[10px] font-semibold mt-1">Change</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />
        </div>

        <div className="min-w-0 flex-1 text-center md:text-left space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 flex items-center justify-center md:justify-start gap-2">
                {emp?.full_name}
                <button
                  type="button"
                  onClick={() => setShowNameModal(true)}
                  className="text-xs font-normal text-teal-600 dark:text-teal-400 hover:underline"
                >
                  (Request Name Change)
                </button>
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {emp?.designation} • {emp?.emp_code}
              </p>
            </div>
            <span className="inline-flex self-center sm:self-start px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {emp?.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" /> {emp?.department?.name || 'Department'}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" /> {emp?.branch?.name || emp?.work_location || 'Corporate HQ'}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" /> Service: {formatServiceDuration(emp?.date_of_joining)}
            </span>
          </div>
        </div>
      </div>

      {/* Pending Name Change Banner */}
      {myChangeRequests.some(r => r.status === 'PENDING') && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">Name Change Request Pending Review</p>
            <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
              You requested to change your name to "{myChangeRequests.find(r => r.status === 'PENDING')?.newValue}". HR will review and verify your request.
            </p>
          </div>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Self-service editable fields */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSelfServiceSave} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Contact & Address Details</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Keep your personal communication and emergency information up to date.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Personal Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    placeholder="10-digit mobile"
                    maxLength={10}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Personal Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={personalEmail}
                    onChange={e => setPersonalEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Current Residential Address
                </label>
                <textarea
                  rows={2}
                  value={currentAddress}
                  onChange={e => setCurrentAddress(e.target.value)}
                  placeholder="Street, City, State, PIN"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2 mb-3">
                <HeartHandshake className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={e => setEmergencyName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={emergencyRelation}
                    onChange={e => setEmergencyRelation(e.target.value)}
                    placeholder="e.g. Spouse, Father"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Emergency Phone
                  </label>
                  <input
                    type="tel"
                    value={emergencyPhone}
                    onChange={e => setEmergencyPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSelfService}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm flex items-center gap-2 shadow-xs transition-colors disabled:opacity-60"
              >
                {savingSelfService ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingSelfService ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Right 1 Col: Read-Only Job & Statutory (Masked) Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Job Details
            </h2>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-slate-400">Official Email</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200 truncate">{emp?.official_email}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Reporting Authority</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">{emp?.manager?.full_name || 'None'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Date of Joining</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">{emp?.date_of_joining || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Employment Type</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">{emp?.employment_type}</dd>
              </div>
              {emp?.probation_end_date && emp?.status === 'PROBATION' && (
                <div>
                  <dt className="text-slate-400">Probation End Date</dt>
                  <dd className="font-medium text-amber-600 dark:text-amber-400">{emp.probation_end_date}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Statutory & Bank (Masked)
            </h2>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              Sensitive identifiers are masked for security. Contact Accounts for updates.
            </p>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-slate-400">PAN Number</dt>
                <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">{maskNumber(fin?.pan_number, 3)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Aadhaar (Last 4)</dt>
                <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">{fin?.aadhaar_last4 ? `•••• •••• ${fin.aadhaar_last4}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Bank Account</dt>
                <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">{maskNumber(fin?.bank_account_number, 4)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Bank IFSC</dt>
                <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">{fin?.bank_ifsc || '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Name Change Request Modal */}
      {showNameModal && (
        <Modal
          isOpen={showNameModal}
          onClose={() => setShowNameModal(false)}
          title="Request Name Change"
          subtitle="Official name changes must be verified and approved by the HR team."
        >
          <form onSubmit={handleNameChangeSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current Registered Name
              </label>
              <input
                type="text"
                disabled
                value={currentUser?.fullName || ''}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Full name as on Government ID"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason / Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={nameReason}
                onChange={e => setNameReason(e.target.value)}
                placeholder="e.g. Correction in spelling, name change after marriage with updated Aadhaar/PAN."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNameModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingNameChange}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60"
              >
                {submittingNameChange ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

/** Crop to a center square and compress to <= maxBytes */
async function cropAndCompressSquare(file: File, side = 400, maxBytes = 300 * 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => {
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;

    img.onload = () => {
      const minDim = Math.min(img.width, img.height);
      const startX = (img.width - minDim) / 2;
      const startY = (img.height - minDim) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }

      ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, side, side);

      // Try 85% WebP
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Image processing failed'));
          return;
        }
        if (blob.size <= maxBytes) {
          resolve(blob);
        } else {
          // Retry with lower quality
          canvas.toBlob(b2 => {
            if (b2) resolve(b2);
            else reject(new Error('Image compression failed'));
          }, 'image/webp', 0.65);
        }
      }, 'image/webp', 0.85);
    };

    reader.readAsDataURL(file);
  });
}
