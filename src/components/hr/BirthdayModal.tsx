import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/dateUtils';
import { Cake, Calendar, Sparkles, X, Gift } from 'lucide-react';

interface BirthdayPerson {
  employeeId: number;
  fullName: string;
  empCode: string;
  designation: string;
  departmentName: string;
  dob: string;
  daysUntil: number; // 0 for today
}

export const BirthdayModal: React.FC = () => {
  const { isHr } = useAuth();
  const [open, setOpen] = useState(false);
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);

  useEffect(() => {
    if (!isHr) return;

    const today = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(today);
    const storageKey = `sm_bday_dismissed_${todayStr}`;

    if (localStorage.getItem(storageKey)) {
      return;
    }

    const fetchBirthdays = async () => {
      try {
        const { data, error } = await supabase
          .from('employee_profiles')
          .select('employee_id, date_of_birth, employee:employees!employee_profiles_employee_id_fkey(id, full_name, emp_code, designation, status, department:departments(name))')
          .not('date_of_birth', 'is', null);

        if (error || !data) return;

        const currentMonth = today.getMonth(); // 0-indexed
        const currentDay = today.getDate();

        const upcoming: BirthdayPerson[] = [];

        data.forEach((row: any) => {
          if (!row.date_of_birth || row.employee?.status !== 'ACTIVE') return;

          const dob = new Date(row.date_of_birth);
          const bMonth = dob.getMonth();
          const bDay = dob.getDate();

          // Calculate day difference within 7 days
          const bDateThisYear = new Date(today.getFullYear(), bMonth, bDay);
          if (bDateThisYear < new Date(today.getFullYear(), currentMonth, currentDay)) {
            bDateThisYear.setFullYear(today.getFullYear() + 1);
          }

          const diffTime = bDateThisYear.getTime() - new Date(today.getFullYear(), currentMonth, currentDay).getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= 0 && diffDays <= 7) {
            upcoming.push({
              employeeId: row.employee.id,
              fullName: row.employee.full_name,
              empCode: row.employee.emp_code,
              designation: row.employee.designation,
              departmentName: row.employee.department?.name || '',
              dob: row.date_of_birth,
              daysUntil: diffDays
            });
          }
        });

        upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

        if (upcoming.length > 0) {
          setBirthdays(upcoming);
          setOpen(true);
        }
      } catch {
        // Ignored
      }
    };

    fetchBirthdays();
  }, [isHr]);

  const handleDismiss = () => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    localStorage.setItem(`sm_bday_dismissed_${todayStr}`, 'true');
    setOpen(false);
  };

  if (!open || birthdays.length === 0) return null;

  const todayBirthdays = birthdays.filter(b => b.daysUntil === 0);
  const next7Days = birthdays.filter(b => b.daysUntil > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-teal-200 dark:border-teal-800 p-6 max-w-lg w-full space-y-5 shadow-2xl relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-500 via-pink-500 to-amber-500" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
              <Cake className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Staff Birthdays Alert
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h3>
              <p className="text-xs text-slate-500">
                Today and next 7 days upcoming celebrations
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Today's Celebrations */}
        {todayBirthdays.length > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-pink-50 to-amber-50 dark:from-pink-950/30 dark:to-amber-950/30 border border-pink-200 dark:border-pink-900/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider">
              <Gift className="w-4 h-4" />
              Celebrating Today!
            </div>
            <div className="space-y-2">
              {todayBirthdays.map(b => (
                <div key={b.employeeId} className="flex items-center justify-between bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-pink-100 dark:border-pink-900/30">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {b.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {b.designation} • {b.departmentName}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200">
                    Today 🎂
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next 7 Days */}
        {next7Days.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Upcoming in Next 7 Days
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {next7Days.map(b => (
                <div key={b.employeeId} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{b.fullName}</span>
                    <span className="text-slate-400 text-[11px] ml-2">({b.departmentName})</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    in {b.daysUntil} day{b.daysUntil > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition"
          >
            Dismiss for Today
          </button>
        </div>
      </div>
    </div>
  );
};
