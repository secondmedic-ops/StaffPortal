import React, { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { ThemeToggle } from '../common/ThemeToggle';
import { SHIFT_POLICY, LEAVE_APPROVAL_POLICY } from '../../config/policy';

interface LoginScreenProps {
  email: string;
  password: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  submitting: boolean;
  error: string | null;
  resetSent: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
}

const FACTS = [
  {
    title: `Shift ${SHIFT_POLICY.startTime} to ${SHIFT_POLICY.endTime}`,
    body: `Punch in within ${SHIFT_POLICY.graceMinutes} minutes of the start. A missed punch can be fixed with a time update.`
  },
  {
    title: 'Leave goes to your manager',
    body: 'Leave is approved by your reporting authority. You can follow each step in your leave register.'
  },
  {
    title: 'Pay follows attendance',
    body: 'Your payslip shows every day of the month and how it was counted.'
  }
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  submitting,
  error,
  resetSent,
  onSubmit,
  onForgotPassword
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-white dark:bg-slate-950">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink px-12 py-10 text-slate-200">
        <BrandMark tone="onDark" />

        <div className="relative max-w-md">
          <h1 className="font-display text-[34px] leading-[1.15] font-semibold text-white">
            Your shift, leave and pay in one place.
          </h1>
          <ul className="mt-10 space-y-6">
            {FACTS.map(f => (
              <li key={f.title} className="border-l-2 border-teal-400/70 pl-4">
                <div className="font-display text-[15px] font-medium text-white">{f.title}</div>
                <p className="mt-1 text-[14.5px] leading-relaxed text-slate-300">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12.5px] text-slate-400">For SecondMedic staff. Access is logged.</p>

        {/* A quiet workday arc: the shift as a line from start to end */}
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-40 -bottom-40 h-[560px] w-[560px] text-teal-400/15"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="130" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 8" />
          <path d="M20 200a180 180 0 0 1 300-134" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className="text-teal-400/40" />
        </svg>
      </aside>

      {/* Sign-in form */}
      <main className="relative flex flex-col px-5 sm:px-10 py-8">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[380px]">
            <h2 className="font-display text-[26px] font-semibold text-slate-900 dark:text-slate-50">Sign in</h2>
            <p className="mt-1.5 text-[15px] text-slate-500 dark:text-slate-400">Use your SecondMedic work email.</p>

            {error && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-3 text-sm text-rose-800 dark:text-rose-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}
            {resetSent && (
              <div
                role="status"
                className="mt-6 rounded-lg border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/50 px-3.5 py-3 text-sm text-teal-900 dark:text-teal-200"
              >
                If {resetSent} is registered, we've emailed a link to set your password.
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
              <div>
                <label htmlFor="login-email" className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-300">
                  Work email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={e => onEmailChange(e.target.value)}
                  placeholder="name@secondmedic.com"
                  className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="login-password" className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-[13.5px] font-medium text-teal-700 dark:text-teal-300 hover:underline underline-offset-2"
                  >
                    Forgot or new password?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => onPasswordChange(e.target.value)}
                    className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3.5 pr-11 text-[15px] text-slate-900 dark:text-slate-100 hover:border-slate-400 focus:outline-none focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full h-11 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-60 text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-colors"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {submitting ? 'Signing in' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
