import React, { useState, useEffect } from 'react';
import { branchesApi } from '../../api/branches';
import { useAuth } from '../../context/AuthContext';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { Modal } from '../common/Modal';
import { StatusPill } from '../common/StatusPill';
import type { Branch } from '../../types';
import {
  Building2,
  Plus,
  MapPin,
  Pencil,
  Navigation,
  CheckCircle2,
  XCircle,
  Loader2,
  Compass
} from 'lucide-react';

export const BranchManagement: React.FC = () => {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Add/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [radius, setRadius] = useState<number>(100);
  const [active, setActive] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const data = await branchesApi.getBranches(true);
      setBranches(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load branches', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const openAdd = () => {
    setEditingBranch(null);
    setName('');
    setCode('');
    setAddress('');
    setCity('');
    setState('');
    setLatitude(0);
    setLongitude(0);
    setRadius(100);
    setActive(true);
    setShowModal(true);
  };

  const openEdit = (b: Branch) => {
    setEditingBranch(b);
    setName(b.name);
    setCode(b.code);
    setAddress(b.address || '');
    setCity(b.city || '');
    setState(b.state || '');
    setLatitude(b.latitude);
    setLongitude(b.longitude);
    setRadius(b.geofenceRadiusM || 100);
    setActive(b.active);
    setShowModal(true);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Unavailable', 'Geolocation is not supported by your browser.', 'error');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setLocating(false);
        showToast('Coordinates Captured', `Lat: ${pos.coords.latitude.toFixed(4)}, Lon: ${pos.coords.longitude.toFixed(4)}`, 'success');
      },
      err => {
        setLocating(false);
        showToast('Location Error', err.message || 'Could not retrieve your location.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      showToast('Missing Fields', 'Branch name and code are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingBranch) {
        await branchesApi.updateBranch(editingBranch.id, {
          name,
          code,
          address,
          city,
          state,
          latitude,
          longitude,
          geofenceRadiusM: radius,
          active
        });
        showToast('Branch Updated', `${name} details have been updated.`, 'success');
      } else {
        const created = await branchesApi.createBranch({
          name,
          code,
          address,
          city,
          state,
          latitude,
          longitude,
          geofenceRadiusM: radius
        });
        showToast('Branch Created', `${name} (${code}) added to branch master.`, 'success');
      }
      setShowModal(false);
      fetchBranches();
    } catch (err: any) {
      showToast('Save Failed', err.message || 'Could not save branch', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (b: Branch) => {
    try {
      await branchesApi.toggleBranchActive(b.id, !b.active);
      showToast('Status Updated', `${b.name} marked as ${!b.active ? 'Active' : 'Inactive'}.`, 'info');
      fetchBranches();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to toggle status', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Branch Master & Geofencing
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch]">
            Manage SecondMedic physical branches, GPS center coordinates, and 100m geofence boundaries for office attendance.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center gap-2 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add New Branch
        </button>
      </div>

      {/* Branch List */}
      {loading ? (
        <SkeletonLoader rows={5} />
      ) : branches.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
          No branches found. Click "Add New Branch" to register your first location.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Branch Name</th>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">City / State</th>
                  <th className="px-5 py-3.5">GPS Coordinates</th>
                  <th className="px-5 py-3.5">Geofence</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {branches.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{b.name}</div>
                      {b.address && <div className="text-[11.5px] text-slate-500 truncate max-w-xs">{b.address}</div>}
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-teal-700 dark:text-teal-400">{b.code}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {b.city || '—'}{b.state ? `, ${b.state}` : ''}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-500">
                      {b.latitude && b.longitude ? (
                        <span>{b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}</span>
                      ) : (
                        <span className="text-amber-500">No GPS set</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Compass className="w-3 h-3 text-teal-600" /> {b.geofenceRadiusM} m
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(b)}
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          b.active
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {b.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="px-3 py-1.5 text-xs font-semibold text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingBranch ? `Edit Branch: ${editingBranch.name}` : 'Add New Branch'}
          subtitle="Configure branch location and office geofence radius for automated attendance check."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Branch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Pune Branch"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Branch Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PUN"
                  className="w-full px-3 py-2 text-sm uppercase font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Office Street Address
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Building, street, landmark"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Pune"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  placeholder="e.g. Maharashtra"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Geofence & Location Section */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-teal-600" /> GPS Center & Geofence
                </span>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 flex items-center gap-1"
                >
                  {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                  Use My Current Location
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={e => setLatitude(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={e => setLongitude(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Radius (Meters)</label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={radius}
                    onChange={e => setRadius(parseInt(e.target.value, 10) || 100)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            {editingBranch && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="activeCheck" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Branch is active (staff can punch in at this location)
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
