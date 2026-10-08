import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

/**
 * Normalizes any user-provided Supabase URL, supporting:
 * - Project reference ID (e.g. "hurtwqqgxnmgkuguvkbw" -> "https://hurtwqqgxnmgkuguvkbw.supabase.co")
 * - Hostname without protocol (e.g. "hurtwqqgxnmgkuguvkbw.supabase.co" -> "https://...")
 * - URLs with trailing slashes or whitespace
 */
export function normalizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // If user provided only the project reference ID
  if (!trimmed.includes('.') && !trimmed.includes('/')) {
    return `https://${trimmed}.supabase.co`;
  }

  // Prepend https:// if protocol is missing
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  // Remove trailing slashes
  return trimmed.replace(/\/+$/, '');
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const normalizedUrl = normalizeSupabaseUrl(rawUrl);
export const isSupabaseConfigured = Boolean(normalizedUrl && rawKey && rawKey !== 'placeholder');

// Fallback to valid placeholder URL if not configured, preventing module load exceptions
const effectiveUrl = normalizedUrl || 'https://placeholder.supabase.co';
const effectiveKey = rawKey || 'placeholder';

export const supabase = createClient<Database>(effectiveUrl, effectiveKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

