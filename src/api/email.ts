import { supabase } from '../lib/supabase';
import { mapEmailOutboxItem } from './mappers';
import type { EmailOutboxItem } from '../types';

export const emailApi = {
  async getOutbox(status?: 'PENDING' | 'SENT' | 'FAILED'): Promise<EmailOutboxItem[]> {
    let query = supabase.from('email_outbox').select('*').order('created_at', { ascending: false });
    if (status) {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load email outbox: ${error.message}`);
    return (data || []).map(mapEmailOutboxItem);
  },

  async resendEmail(id: number): Promise<void> {
    const { error } = await supabase
      .from('email_outbox')
      .update({
        status: 'PENDING',
        attempts: 0,
        last_error: null
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to queue email for resend: ${error.message}`);

    // Trigger edge function
    try {
      await supabase.functions.invoke('send-email', { method: 'POST' });
    } catch {
      // Background retry will handle it via cron
    }
  },

  async triggerSendBatch(): Promise<{ processed: number }> {
    const { data, error } = await supabase.functions.invoke('send-email', { method: 'POST' });
    if (error) throw new Error(`Failed to trigger email send batch: ${error.message}`);
    return data || { processed: 0 };
  }
};
