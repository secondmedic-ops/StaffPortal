import { supabase } from '../lib/supabase';
import { getSessionEmployee } from './session';
import { mapEmployeeDocument } from './mappers';
import type { EmployeeDocument } from '../types';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const documentsApi = {
  async getDocumentsForEmployee(employeeId: number): Promise<EmployeeDocument[]> {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*, uploader:employees!employee_documents_uploaded_by_fkey(full_name)')
      .eq('employee_id', employeeId)
      .order('uploaded_at', { ascending: false });

    if (error) throw new Error(`Failed to load employee documents: ${error.message}`);
    return (data || []).map(mapEmployeeDocument);
  },

  async getAllDocuments(category?: string): Promise<EmployeeDocument[]> {
    let query = supabase
      .from('employee_documents')
      .select('*, uploader:employees!employee_documents_uploaded_by_fkey(full_name), employee:employees!employee_documents_employee_id_fkey(full_name, emp_code)')
      .order('uploaded_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load documents: ${error.message}`);
    return (data || []).map((row: any) => {
      const doc = mapEmployeeDocument(row);
      if (row.employee?.full_name) {
        doc.name = `${row.name} (${row.employee.full_name})`;
      }
      return doc;
    });
  },

  async uploadEmployeeDocument(
    employeeId: number,
    category: EmployeeDocument['category'],
    file: File
  ): Promise<EmployeeDocument> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 10 MB.`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Unsupported file type (${file.type}). Allowed types are PDF, JPG, PNG, WEBP, and DOC/DOCX.`);
    }

    const uploader = await getSessionEmployee();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${employeeId}/${Date.now()}_${cleanFileName}`;

    // 1. Upload to Supabase Storage private bucket
    const { error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    // 2. Insert record in employee_documents table
    const { data, error: dbError } = await supabase
      .from('employee_documents')
      .insert({
        employee_id: employeeId,
        category,
        file_path: storagePath,
        name: file.name,
        size: file.size,
        uploaded_by: uploader.id,
      })
      .select('*, uploader:employees!employee_documents_uploaded_by_fkey(full_name)')
      .single();

    if (dbError) {
      // Cleanup storage file if DB insert fails
      await supabase.storage.from('employee-documents').remove([storagePath]);
      throw new Error(`Failed to save document metadata: ${dbError.message}`);
    }

    return mapEmployeeDocument(data);
  },

  async getSignedUrl(bucket: string, filePath: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
    }

    return data.signedUrl;
  },

  async deleteEmployeeDocument(id: number, filePath: string): Promise<void> {
    // 1. Remove from database
    const { error: dbError } = await supabase
      .from('employee_documents')
      .delete()
      .eq('id', id);

    if (dbError) throw new Error(`Failed to delete document record: ${dbError.message}`);

    // 2. Remove from storage
    try {
      await supabase.storage.from('employee-documents').remove([filePath]);
    } catch {
      // Ignored if already gone
    }
  },

  async uploadLeaveAttachment(file: File): Promise<string> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 10 MB.`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Unsupported file type (${file.type}). Allowed types are PDF, JPG, PNG, WEBP, and DOC/DOCX.`);
    }

    const emp = await getSessionEmployee();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${emp.id}/${Date.now()}_${cleanFileName}`;

    const { error } = await supabase.storage
      .from('leave-attachments')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw new Error(`Failed to upload leave attachment: ${error.message}`);
    return storagePath;
  }
};
