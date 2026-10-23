import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { galleryApi } from '../../api/gallery';
import { branchesApi } from '../../api/branches';
import { PageHeader } from '../common/PageHeader';
import { StatusPill } from '../common/StatusPill';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { formatDate } from '../../utils/dateUtils';
import type { GalleryAlbum, GalleryPhoto, Branch } from '../../types';
import {
  Images,
  Image as ImageIcon,
  Plus,
  Upload,
  Trash2,
  Calendar,
  Building,
  Filter,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2
} from 'lucide-react';

export const GalleryView: React.FC = () => {
  const { currentUser, isHr, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  // Active Album View
  const [activeAlbum, setActiveAlbum] = useState<GalleryAlbum | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<GalleryPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Create Album Modal
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBranchId, setNewBranchId] = useState<string>('');
  const [newEventType, setNewEventType] = useState<'FESTIVAL' | 'BIRTHDAY' | 'OTHER'>('FESTIVAL');
  const [newEventDate, setNewEventDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()));
  const [newDescription, setNewDescription] = useState('');
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  // Photo Upload State
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      const [fetchedAlbums, fetchedBranches] = await Promise.all([
        galleryApi.getAlbums({
          branchId: selectedBranch !== 'ALL' ? parseInt(selectedBranch, 10) : undefined,
          eventType: selectedEventType !== 'ALL' ? selectedEventType : undefined,
          year: selectedYear !== 'ALL' ? parseInt(selectedYear, 10) : undefined
        }),
        branchesApi.getBranches()
      ]);
      setAlbums(fetchedAlbums);
      setBranches(fetchedBranches);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load photo gallery', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlbums();
  }, [selectedBranch, selectedEventType, selectedYear]);

  const loadPhotosForAlbum = async (album: GalleryAlbum) => {
    try {
      setActiveAlbum(album);
      setLoadingPhotos(true);
      const photos = await galleryApi.getAlbumPhotos(album.id);
      setAlbumPhotos(photos);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load album photos', 'error');
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('Validation Error', 'Please enter an album title.', 'error');
      return;
    }

    setCreatingAlbum(true);
    try {
      const album = await galleryApi.createAlbum({
        title: newTitle,
        branchId: newBranchId ? parseInt(newBranchId, 10) : undefined,
        eventType: newEventType,
        eventDate: newEventDate,
        description: newDescription
      });

      showToast('Album Created', `"${album.title}" album created successfully.`, 'success');
      setShowCreateAlbum(false);
      setNewTitle('');
      setNewDescription('');
      loadAlbums();
      loadPhotosForAlbum(album);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to create album', 'error');
    } finally {
      setCreatingAlbum(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeAlbum) return;

    setUploadingPhotos(true);
    setUploadProgress({ current: 0, total: files.length });

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length });
        await galleryApi.uploadPhoto(activeAlbum.id, files[i]);
      }
      showToast('Photos Uploaded', `${files.length} photo(s) added to the album.`, 'success');
      loadPhotosForAlbum(activeAlbum);
    } catch (err: any) {
      showToast('Upload Failed', err.message || 'Could not upload some photos', 'error');
    } finally {
      setUploadingPhotos(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photo: GalleryPhoto) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await galleryApi.deletePhoto(photo.id, photo.filePath);
      showToast('Photo Deleted', 'The photo has been removed.', 'success');
      if (activeAlbum) {
        loadPhotosForAlbum(activeAlbum);
      }
    } catch (err: any) {
      showToast('Delete Failed', err.message || 'Could not delete photo', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Photo Gallery"
        subtitle="Celebrations, festivals, team offsites, and milestone events across SecondMedic branches."
        actions={
          activeAlbum ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveAlbum(null);
                  loadAlbums();
                }}
                className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Albums
              </button>
              {(isHr || currentUser) && (
                <label className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingPhotos ? `Uploading (${uploadProgress?.current}/${uploadProgress?.total})...` : 'Upload Photos'}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhotos}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          ) : (
            isHr && (
              <button
                onClick={() => setShowCreateAlbum(true)}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Album
              </button>
            )
          )
        }
      />

      {/* Main Albums View */}
      {!activeAlbum ? (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
              <Filter className="w-4 h-4" />
              Filter:
            </div>
            <div>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-1.5"
              >
                <option value="ALL">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedEventType}
                onChange={e => setSelectedEventType(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-1.5"
              >
                <option value="ALL">All Event Types</option>
                <option value="FESTIVAL">Festival & Celebrations</option>
                <option value="BIRTHDAY">Birthdays & Anniversaries</option>
                <option value="OTHER">Offsites & Other</option>
              </select>
            </div>
            <div>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-1.5"
              >
                <option value="ALL">All Years</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
          </div>

          {/* Album Grid */}
          {loading ? (
            <SkeletonLoader rows={4} />
          ) : albums.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
              <Images className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                No Gallery Albums
              </h3>
              <p className="text-sm mt-1">
                No albums match your filter criteria. HR and branch administrators can create albums and upload photos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {albums.map(album => (
                <div
                  key={album.id}
                  onClick={() => loadPhotosForAlbum(album)}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col"
                >
                  <div className="h-44 bg-slate-100 dark:bg-slate-700 relative overflow-hidden flex items-center justify-center">
                    <Images className="w-10 h-10 text-slate-400 group-hover:scale-110 transition duration-300" />
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[11px] font-bold bg-black/60 text-white backdrop-blur-sm">
                      {album.eventType}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-teal-600 transition">
                        {album.title}
                      </h4>
                      {album.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {album.description}
                        </p>
                      )}
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(album.eventDate)}
                      </span>
                      <span>
                        {(album as any).branch?.name || 'All Branches'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Active Album Photo Grid */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {activeAlbum.title}
                </h3>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                  {activeAlbum.eventType}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span>Date: <strong>{formatDate(activeAlbum.eventDate)}</strong></span>
                <span>Branch: <strong>{(activeAlbum as any).branch?.name || 'Company Wide'}</strong></span>
                <span>Photos: <strong>{albumPhotos.length}</strong></span>
              </p>
              {activeAlbum.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  {activeAlbum.description}
                </p>
              )}
            </div>
          </div>

          {loadingPhotos ? (
            <SkeletonLoader rows={4} />
          ) : albumPhotos.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
              <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                No Photos in this Album Yet
              </h3>
              <p className="text-sm mt-1">
                Click "Upload Photos" above to add event memories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {albumPhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="relative group rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 aspect-square shadow-sm"
                >
                  <img
                    src={photo.signedUrl || `/placeholder-image.png`}
                    alt={photo.caption || 'Event photo'}
                    className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition duration-300"
                    onClick={() => setLightboxIndex(idx)}
                  />
                  {/* Delete button for uploader or HR */}
                  {(isHr || photo.uploadedBy === currentUser?.id) && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeletePhoto(photo);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                      title="Delete Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {photo.caption && (
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-[11px] text-white truncate">
                      {photo.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && albumPhotos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={e => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
              className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {lightboxIndex < albumPhotos.length - 1 && (
            <button
              onClick={e => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
              className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <div
            className="max-w-4xl max-h-[85vh] flex flex-col items-center"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={albumPhotos[lightboxIndex].signedUrl}
              alt={albumPhotos[lightboxIndex].caption || 'Event photo'}
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
            />
            <div className="mt-3 text-center text-white text-xs">
              <p className="font-semibold">{albumPhotos[lightboxIndex].caption || activeAlbum?.title}</p>
              <p className="text-white/60 text-[11px] mt-0.5">
                Photo {lightboxIndex + 1} of {albumPhotos.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Album Modal */}
      {showCreateAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Create New Photo Album
            </h3>

            <form onSubmit={handleCreateAlbum} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Album Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Mumbai HQ - Diwali 2026"
                  required
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Event Type *
                  </label>
                  <select
                    value={newEventType}
                    onChange={e => setNewEventType(e.target.value as any)}
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                  >
                    <option value="FESTIVAL">Festival / Celebration</option>
                    <option value="BIRTHDAY">Birthday / Milestone</option>
                    <option value="OTHER">Offsite / Team Outing</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={e => setNewEventDate(e.target.value)}
                    required
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Branch (Optional)
                </label>
                <select
                  value={newBranchId}
                  onChange={e => setNewBranchId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                >
                  <option value="">All Branches / Corporate</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Brief notes about the occasion..."
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateAlbum(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAlbum}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
                >
                  {creatingAlbum ? 'Creating...' : 'Create Album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
