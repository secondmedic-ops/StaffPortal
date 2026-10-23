import { supabase } from '../lib/supabase';
import { getSessionEmployee } from './session';
import { mapGalleryAlbum, mapGalleryPhoto } from './mappers';
import type { GalleryAlbum, GalleryPhoto } from '../types';

/**
 * Resizes and compresses an image in the browser before upload:
 * max 1600px on long edge, ~80% quality JPEG/WebP.
 */
export async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => {
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Image compression failed'));
        },
        'image/webp',
        quality
      );
    };

    reader.readAsDataURL(file);
  });
}

export const galleryApi = {
  async getAlbums(filters?: { branchId?: number; eventType?: string; year?: number }): Promise<GalleryAlbum[]> {
    let query = supabase
      .from('gallery_albums')
      .select('*, branch:branches(name), creator:employees!gallery_albums_created_by_fkey(full_name), photos:gallery_photos(id, file_path)')
      .order('event_date', { ascending: false });

    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }
    if (filters?.eventType) {
      query = query.eq('event_type', filters.eventType as any);
    }
    if (filters?.year) {
      query = query.gte('event_date', `${filters.year}-01-01`).lte('event_date', `${filters.year}-12-31`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load gallery albums: ${error.message}`);
    return (data || []).map((row: any) => {
      const album = mapGalleryAlbum(row);
      if (row.photos && row.photos.length > 0) {
        album.coverPhotoUrl = row.photos[0].file_path;
      }
      return album;
    });
  },

  async createAlbum(payload: {
    branchId?: number;
    title: string;
    eventType: 'FESTIVAL' | 'BIRTHDAY' | 'OTHER';
    eventDate: string;
    description?: string;
  }): Promise<GalleryAlbum> {
    const emp = await getSessionEmployee();
    const { data, error } = await supabase
      .from('gallery_albums')
      .insert({
        branch_id: payload.branchId || null,
        title: payload.title.trim(),
        event_type: payload.eventType,
        event_date: payload.eventDate,
        description: payload.description?.trim() || null,
        created_by: emp.id,
      })
      .select('*, branch:branches(name), creator:employees!gallery_albums_created_by_fkey(full_name)')
      .single();

    if (error) throw new Error(`Failed to create album: ${error.message}`);
    return mapGalleryAlbum(data);
  },

  async getAlbumPhotos(albumId: number): Promise<GalleryPhoto[]> {
    const { data, error } = await supabase
      .from('gallery_photos')
      .select('*, uploader:employees!gallery_photos_uploaded_by_fkey(full_name)')
      .eq('album_id', albumId)
      .order('uploaded_at', { ascending: false });

    if (error) throw new Error(`Failed to load photos: ${error.message}`);

    const photos = (data || []).map(mapGalleryPhoto);
    // Fetch signed URLs for photos
    for (const p of photos) {
      try {
        const { data: signData } = await supabase.storage
          .from('gallery')
          .createSignedUrl(p.filePath, 3600);
        if (signData?.signedUrl) {
          p.signedUrl = signData.signedUrl;
        }
      } catch {
        // Fallback without signed url
      }
    }
    return photos;
  },

  async uploadPhoto(albumId: number, file: File, caption?: string): Promise<GalleryPhoto> {
    const emp = await getSessionEmployee();
    const compressedBlob = await compressImage(file);
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;
    const storagePath = `${albumId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('gallery')
      .upload(storagePath, compressedBlob, {
        contentType: 'image/webp',
        cacheControl: '86400',
        upsert: false
      });

    if (uploadError) throw new Error(`Failed to upload photo: ${uploadError.message}`);

    const { data, error: dbError } = await supabase
      .from('gallery_photos')
      .insert({
        album_id: albumId,
        file_path: storagePath,
        caption: caption?.trim() || null,
        uploaded_by: emp.id,
      })
      .select('*, uploader:employees!gallery_photos_uploaded_by_fkey(full_name)')
      .single();

    if (dbError) {
      await supabase.storage.from('gallery').remove([storagePath]);
      throw new Error(`Failed to record photo metadata: ${dbError.message}`);
    }

    const photo = mapGalleryPhoto(data);
    try {
      const { data: signData } = await supabase.storage.from('gallery').createSignedUrl(storagePath, 3600);
      if (signData?.signedUrl) photo.signedUrl = signData.signedUrl;
    } catch {
      // Ignored
    }
    return photo;
  },

  async deletePhoto(photoId: number, filePath: string): Promise<void> {
    const { error: dbError } = await supabase.from('gallery_photos').delete().eq('id', photoId);
    if (dbError) throw new Error(`Failed to delete photo: ${dbError.message}`);

    try {
      await supabase.storage.from('gallery').remove([filePath]);
    } catch {
      // Ignored
    }
  }
};
