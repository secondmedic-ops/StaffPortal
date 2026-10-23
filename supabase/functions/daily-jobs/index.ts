// Supabase Edge Function: daily-jobs
// Runs daily at 08:00 IST to process birthdays, work anniversaries,
// probation alerts, missed sign-out digests, and auto-exit of EXITED staff.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const HR_EMAIL = Deno.env.get('HR_EMAIL') || 'hr@secondmedic.com';

serve(async (_req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Use Indian Standard Time (IST) current date
  const nowUtc = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(nowUtc.getTime() + istOffsetMs);
  const todayStr = nowIst.toISOString().split('T')[0]; // YYYY-MM-DD
  const [currentYear, currentMonth, currentDay] = todayStr.split('-').map(Number);

  // Yesterday in IST
  const yesterdayIst = new Date(nowIst.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayIst.toISOString().split('T')[0];

  const log: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // 1. Birthdays
    // -------------------------------------------------------------------------
    const { data: bdayProfiles } = await supabase
      .from('employee_profiles')
      .select('employee_id, date_of_birth, employees!inner(id, full_name, official_email, manager_id, status)')
      .not('date_of_birth', 'is', null);

    let bdaysCount = 0;
    for (const p of (bdayProfiles || [])) {
      const emp = (p as any).employees;
      if (!emp || emp.status === 'EXITED') continue;

      const dob = new Date(p.date_of_birth);
      if (dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay) {
        // Queue email for HR and Manager
        let mgrEmail: string | null = null;
        if (emp.manager_id) {
          const { data: mgr } = await supabase
            .from('employees')
            .select('official_email')
            .eq('id', emp.manager_id)
            .single();
          mgrEmail = mgr?.official_email || null;
        }

        const recipients = [HR_EMAIL];
        if (mgrEmail && !recipients.includes(mgrEmail)) recipients.push(mgrEmail);

        for (const recipient of recipients) {
          await supabase.rpc('queue_email', {
            p_template: 'birthday',
            p_to: recipient,
            p_cc: null,
            p_subject: `🎉 Birthday Today: ${emp.full_name}`,
            p_payload: { employeeName: emp.full_name, employeeId: emp.id },
            p_dedupe_key: `birthday:${emp.id}:${recipient}:${todayStr}`,
          });
        }
        bdaysCount++;
      }
    }
    log.push(`Birthdays processed: ${bdaysCount}`);

    // -------------------------------------------------------------------------
    // 2. Work Anniversaries (1, 3, 5, 10 years)
    // -------------------------------------------------------------------------
    const { data: activeEmployees } = await supabase
      .from('employees')
      .select('id, full_name, official_email, date_of_joining, manager_id, status')
      .neq('status', 'EXITED')
      .not('date_of_joining', 'is', null);

    const anniversaryMilestones = [1, 3, 5, 10];
    let anniversariesCount = 0;

    for (const emp of (activeEmployees || [])) {
      const doj = new Date(emp.date_of_joining);
      if (doj.getMonth() + 1 === currentMonth && doj.getDate() === currentDay) {
        const years = currentYear - doj.getFullYear();
        if (anniversaryMilestones.includes(years)) {
          let mgrEmail: string | null = null;
          if (emp.manager_id) {
            const { data: mgr } = await supabase
              .from('employees')
              .select('official_email')
              .eq('id', emp.manager_id)
              .single();
            mgrEmail = mgr?.official_email || null;
          }

          const recipients = [HR_EMAIL];
          if (mgrEmail && !recipients.includes(mgrEmail)) recipients.push(mgrEmail);

          for (const recipient of recipients) {
            await supabase.rpc('queue_email', {
              p_template: 'work_anniversary',
              p_to: recipient,
              p_cc: null,
              p_subject: `🌟 Work Anniversary (${years} yr${years > 1 ? 's' : ''}): ${emp.full_name}`,
              p_payload: { employeeName: emp.full_name, years, employeeId: emp.id },
              p_dedupe_key: `anniversary:${emp.id}:${recipient}:${todayStr}`,
            });
          }
          anniversariesCount++;
        }
      }
    }
    log.push(`Work anniversaries processed: ${anniversariesCount}`);

    // -------------------------------------------------------------------------
    // 3. Probation ending in 15 days
    // -------------------------------------------------------------------------
    const targetDateIst = new Date(nowIst.getTime() + 15 * 24 * 60 * 60 * 1000);
    const targetDateStr = targetDateIst.toISOString().split('T')[0];

    const { data: probationStaff } = await supabase
      .from('employees')
      .select('id, full_name, official_email, designation, probation_end_date, manager_id')
      .eq('status', 'PROBATION')
      .eq('probation_end_date', targetDateStr);

    let probationCount = 0;
    for (const emp of (probationStaff || [])) {
      let mgrEmail: string | null = null;
      if (emp.manager_id) {
        const { data: mgr } = await supabase
          .from('employees')
          .select('official_email')
          .eq('id', emp.manager_id)
          .single();
        mgrEmail = mgr?.official_email || null;
      }

      const recipients = [HR_EMAIL];
      if (mgrEmail && !recipients.includes(mgrEmail)) recipients.push(mgrEmail);

      for (const recipient of recipients) {
        await supabase.rpc('queue_email', {
          p_template: 'probation_alert',
          p_to: recipient,
          p_cc: null,
          p_subject: `Probation Ending in 15 Days: ${emp.full_name}`,
          p_payload: {
            employeeName: emp.full_name,
            designation: emp.designation,
            probationEndDate: emp.probation_end_date,
            actionUrl: '/lifecycle',
          },
          p_dedupe_key: `probation_alert:${emp.id}:${recipient}:${emp.probation_end_date}`,
        });
      }
      probationCount++;
    }
    log.push(`Probation alerts processed: ${probationCount}`);

    // -------------------------------------------------------------------------
    // 4. Missed Sign-Outs from yesterday
    // -------------------------------------------------------------------------
    const { data: missedRecords } = await supabase
      .from('attendance_records')
      .select('employee_id, date, punch_in, employees!inner(id, emp_code, full_name, manager_id)')
      .eq('date', yesterdayStr)
      .not('punch_in', 'is', null)
      .is('punch_out', null);

    let missedCount = 0;
    if (missedRecords && missedRecords.length > 0) {
      // Filter out any that have pending or approved regularization
      const { data: regs } = await supabase
        .from('attendance_regularizations')
        .select('employee_id, attendance_date')
        .eq('attendance_date', yesterdayStr)
        .in('status', ['PENDING', 'APPROVED']);

      const regularizedEmpIds = new Set((regs || []).map((r: any) => r.employee_id));
      const unregularized = missedRecords.filter((rec: any) => !regularizedEmpIds.has(rec.employee_id));

      // Group by manager_id
      const byManager: Record<string, any[]> = {};
      for (const item of unregularized) {
        const emp = (item as any).employees;
        const mgrId = emp.manager_id ? String(emp.manager_id) : 'none';
        if (!byManager[mgrId]) byManager[mgrId] = [];
        byManager[mgrId].push({
          name: emp.full_name,
          empCode: emp.emp_code,
          date: item.date,
          punchIn: item.punch_in ? new Date(item.punch_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Unknown',
        });
      }

      for (const [mgrIdStr, staffList] of Object.entries(byManager)) {
        let mgrEmail = HR_EMAIL;
        if (mgrIdStr !== 'none') {
          const { data: mgr } = await supabase
            .from('employees')
            .select('official_email')
            .eq('id', parseInt(mgrIdStr, 10))
            .single();
          if (mgr?.official_email) mgrEmail = mgr.official_email;
        }

        await supabase.rpc('queue_email', {
          p_template: 'missed_signout_digest',
          p_to: mgrEmail,
          p_cc: HR_EMAIL,
          p_subject: `Missed Sign-Out Digest (${yesterdayStr})`,
          p_payload: { missedStaff: staffList, actionUrl: '/team-attendance' },
          p_dedupe_key: `missed_digest:${mgrIdStr}:${yesterdayStr}`,
        });
        missedCount += staffList.length;
      }
    }
    log.push(`Missed sign-outs flagged: ${missedCount}`);

    // -------------------------------------------------------------------------
    // 5. Auto-exit on Last Working Day (LWD)
    // -------------------------------------------------------------------------
    const { data: exitStaff } = await supabase
      .from('employees')
      .select('id, auth_user_id, status, resignations(confirmed_lwd, status)')
      .eq('status', 'NOTICE_PERIOD');

    let exitedCount = 0;
    for (const emp of (exitStaff || [])) {
      const activeResignation = (emp as any).resignations?.find((r: any) => r.status === 'ACCEPTED');
      const lwd = activeResignation?.confirmed_lwd;
      if (lwd && lwd <= todayStr) {
        // Mark as EXITED in employees
        await supabase
          .from('employees')
          .update({ status: 'EXITED', date_of_exit: lwd })
          .eq('id', emp.id);

        // Lock system_users
        await supabase
          .from('system_users')
          .update({ is_locked: true })
          .eq('employee_id', emp.id);

        // Ban auth user in Supabase Auth
        if (emp.auth_user_id) {
          try {
            await (supabase.auth.admin as any).updateUserById(emp.auth_user_id, {
              ban_duration: '876000h', // 100 years
            });
          } catch (banErr: any) {
            console.error(`Failed to ban auth user ${emp.auth_user_id}:`, banErr);
          }
        }
        exitedCount++;
      }
    }
    log.push(`Auto-exits processed: ${exitedCount}`);

    return new Response(JSON.stringify({ success: true, date: todayStr, log }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message, log }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
