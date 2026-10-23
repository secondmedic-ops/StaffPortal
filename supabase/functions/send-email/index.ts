// Supabase Edge Function: send-email
// Dispatches pending emails from email_outbox over SMTP with SSL.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import nodemailer from 'npm:nodemailer@6.9.13';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SMTP_HOST = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465', 10);
const SMTP_SECURE = (Deno.env.get('SMTP_SECURE') ?? 'true') === 'true';
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') || '';
const SMTP_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'Second Medic';
const SMTP_FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL') || SMTP_USER;
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://staffportal.secondmedic.workers.dev';
const HR_EMAIL = Deno.env.get('HR_EMAIL') || 'hr@secondmedic.com';
const SMTP_DEBUG = (Deno.env.get('SMTP_DEBUG') ?? 'false') === 'true';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function createTransporter() {
  if (!SMTP_USER || !SMTP_PASS) {
    if (SMTP_DEBUG) {
      console.warn('SMTP credentials not configured (SMTP_USER or SMTP_PASS missing).');
    }
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    debug: SMTP_DEBUG,
    logger: SMTP_DEBUG,
  });
}

function renderHtmlEmail(title: string, bodyContent: string, actionUrl?: string, actionLabel = 'Open Staff Portal') {
  const fullUrl = actionUrl
    ? (actionUrl.startsWith('http') ? actionUrl : `${APP_BASE_URL}${actionUrl}`)
    : APP_BASE_URL;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0d9488; padding: 24px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">
                      SecondMedic Staff Portal
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px; font-size: 15px; line-height: 1.6; color: #374151;">
              <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; color: #111827; font-weight: 600;">
                ${title}
              </h2>
              ${bodyContent}
              ${actionUrl ? `
              <div style="margin-top: 28px; margin-bottom: 12px;">
                <a href="${fullUrl}" style="display: inline-block; background-color: #0d9488; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
                  ${actionLabel}
                </a>
              </div>
              ` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
              <p style="margin: 0 0 4px 0;">This is an automated email from SecondMedic Staff Portal.</p>
              <p style="margin: 0;">Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

serve(async (req: Request) => {
  const url = new URL(req.url);

  // Health check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', service: 'send-email' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const transporter = createTransporter();

  try {
    // 1. Fetch pending outbox messages (up to 20 at a time, with max 3 attempts)
    const { data: outboxRows, error: fetchErr } = await supabase
      .from('email_outbox')
      .select('*')
      .eq('status', 'PENDING')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchErr) {
      throw fetchErr;
    }

    const results = [];

    for (const row of (outboxRows || [])) {
      const payload = row.payload || {};
      const subject = row.subject || 'Notification from SecondMedic Staff Portal';
      const toEmail = row.to;
      const ccEmail = row.cc || undefined;

      let bodyHtml = '';
      let actionUrl = payload.actionUrl;

      // Build content according to template
      switch (row.template) {
        case 'leave_applied':
          bodyHtml = `
            <p><strong>${payload.employeeName || 'An employee'}</strong> has submitted a leave application.</p>
            <ul>
              <li><strong>Dates:</strong> ${payload.fromDate} to ${payload.toDate} (${payload.days} days)</li>
              <li><strong>Reason:</strong> ${payload.reason || 'None provided'}</li>
            </ul>
            <p>Please review and approve or reject this request in the Staff Portal.</p>
          `;
          break;
        case 'leave_decided':
          bodyHtml = `
            <p>Hello <strong>${payload.employeeName || 'Staff Member'}</strong>,</p>
            <p>Your leave request from <strong>${payload.fromDate}</strong> to <strong>${payload.toDate}</strong> has been <strong>${payload.status}</strong>.</p>
            ${payload.rejectionReason ? `<p><strong>Reason:</strong> ${payload.rejectionReason}</p>` : ''}
          `;
          break;
        case 'leave_withdrawn':
          bodyHtml = `
            <p><strong>${payload.employeeName || 'An employee'}</strong> has ${payload.status?.toLowerCase()} their leave request for ${payload.fromDate} to ${payload.toDate}.</p>
          `;
          break;
        case 'wfh_applied':
          bodyHtml = `
            <p><strong>${payload.employeeName || 'An employee'}</strong> has applied for Work From Home (WFH).</p>
            <ul>
              <li><strong>Dates:</strong> ${payload.fromDate} to ${payload.toDate}</li>
              <li><strong>Reason:</strong> ${payload.reason || 'None provided'}</li>
            </ul>
            <p>Please review and take action.</p>
          `;
          break;
        case 'wfh_decided':
          bodyHtml = `
            <p>Hello <strong>${payload.employeeName || 'Staff Member'}</strong>,</p>
            <p>Your Work From Home (WFH) request for <strong>${payload.fromDate}</strong> to <strong>${payload.toDate}</strong> has been <strong>${payload.status}</strong>.</p>
            ${payload.rejectionReason ? `<p><strong>Reason:</strong> ${payload.rejectionReason}</p>` : ''}
          `;
          break;
        case 'missed_signout_digest':
          bodyHtml = `
            <p>The following staff member(s) in your team had a missed sign-out yesterday (unclosed punch-in without punch-out or regularization):</p>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border-color: #e5e7eb;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Punch-in Time</th>
                </tr>
              </thead>
              <tbody>
                ${(payload.missedStaff || []).map((s: any) => `
                  <tr>
                    <td>${s.name} (${s.empCode})</td>
                    <td>${s.date}</td>
                    <td>${s.punchIn}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <p style="margin-top: 16px;">Staff must submit an attendance regularization to clear missed sign-outs.</p>
          `;
          break;
        case 'birthday':
          bodyHtml = `
            <p>🎉 Today is <strong>${payload.employeeName}</strong>'s birthday!</p>
            <p>Join us in wishing them a very happy birthday and great success ahead.</p>
          `;
          break;
        case 'work_anniversary':
          bodyHtml = `
            <p>🌟 Happy Work Anniversary! Today marks <strong>${payload.years} year(s)</strong> of <strong>${payload.employeeName}</strong> with SecondMedic!</p>
            <p>Thank you for your dedication and contributions to SecondMedic.</p>
          `;
          break;
        case 'probation_alert':
          bodyHtml = `
            <p>The probation period for <strong>${payload.employeeName}</strong> (${payload.designation}) is ending on <strong>${payload.probationEndDate}</strong> (in 15 days).</p>
            <p>Please review their performance and submit a confirmation or extension decision.</p>
          `;
          break;
        case 'resignation_submitted':
          bodyHtml = `
            <p><strong>${payload.employeeName}</strong> has submitted a resignation with requested Last Working Day (LWD): <strong>${payload.requestedLwd}</strong>.</p>
            <p><strong>Reason:</strong> ${payload.reason || 'None provided'}</p>
            <p>Please review and record your comments in the Staff Portal.</p>
          `;
          break;
        case 'resignation_accepted':
          bodyHtml = `
            <p>Hello <strong>${payload.employeeName}</strong>,</p>
            <p>Your resignation has been accepted. Your confirmed Last Working Day (LWD) is <strong>${payload.confirmedLwd}</strong>.</p>
            <p>Notice period and exit clearance tasks have been initiated in the portal.</p>
          `;
          break;
        case 'fnf_approved':
          bodyHtml = `
            <p>Hello <strong>${payload.employeeName}</strong>,</p>
            <p>Your Full & Final Settlement (F&F) has been approved by executive leadership.</p>
            <p><strong>Net Payable:</strong> ₹${payload.netPayable}</p>
            <p>You can view and download your full settlement statement from the portal.</p>
          `;
          break;
        case 'profile_change_decided':
          bodyHtml = `
            <p>Hello <strong>${payload.employeeName}</strong>,</p>
            <p>Your profile change request for <strong>${payload.field}</strong> has been <strong>${payload.status}</strong> by HR.</p>
            ${payload.reason ? `<p><strong>Note:</strong> ${payload.reason}</p>` : ''}
          `;
          break;
        default:
          bodyHtml = `<p>${payload.message || 'You have a new update in SecondMedic Staff Portal.'}</p>`;
      }

      const htmlContent = renderHtmlEmail(subject, bodyHtml, actionUrl);

      // Check if SMTP is configured before sending
      if (!SMTP_USER || !SMTP_PASS) {
        // Mark as simulated if credentials not yet configured
        await supabase
          .from('email_outbox')
          .update({
            status: 'SENT',
            sent_at: new Date().toISOString(),
            last_error: 'Simulated send (SMTP_USER/SMTP_PASS secret not set)',
          })
          .eq('id', row.id);

        results.push({ id: row.id, status: 'SIMULATED', to: toEmail });
        continue;
      }

      try {
        await transporter.sendMail({
          from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
          to: toEmail,
          cc: ccEmail,
          subject: subject,
          html: htmlContent,
          text: subject,
        });

        await supabase
          .from('email_outbox')
          .update({
            status: 'SENT',
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', row.id);

        results.push({ id: row.id, status: 'SENT', to: toEmail });
      } catch (sendError: any) {
        const nextAttempts = (row.attempts || 0) + 1;
        await supabase
          .from('email_outbox')
          .update({
            attempts: nextAttempts,
            status: nextAttempts >= 3 ? 'FAILED' : 'PENDING',
            last_error: sendError.message,
          })
          .eq('id', row.id);

        results.push({ id: row.id, status: 'ERROR', error: sendError.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
