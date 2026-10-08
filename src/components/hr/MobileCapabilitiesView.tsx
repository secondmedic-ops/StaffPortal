import React from 'react';
import { Smartphone, CheckCircle, MessageSquare, Bell, Fingerprint, Globe } from 'lucide-react';

export const MobileCapabilitiesView: React.FC = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          Mobile Capabilities & PWA
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Access the SecondMedic Staff Portal on mobile devices with PWA offline support, WhatsApp alerts, and biometric attendance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
            <Globe className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Progressive Web App (PWA)</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Install directly to your iPhone or Android home screen from browser settings for native app performance without app store friction.
          </p>
          <div className="pt-2 text-[11px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> ServiceWorker cached
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">WhatsApp Notification Bot</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Instant WhatsApp alerts for leave requests, payslip dispatches, shift reminders, and urgent patient escalations.
          </p>
          <div className="pt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> API Connected (Twilio / WATI)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
            <Fingerprint className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Biometric & Geo-Punch</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Secure attendance check-ins using FaceID / TouchID browser webauthn and GPS fence verification at clinic locations.
          </p>
          <div className="pt-2 text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> GPS Geofence Active (100m)
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Mobile App Installation Guide</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 dark:text-slate-300">
          <div className="space-y-2">
            <div className="w-6 h-6 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center font-bold text-[11px]">1</div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Open in Mobile Browser</h4>
            <p>Open Safari on iOS or Google Chrome on Android and navigate to the portal URL.</p>
          </div>
          <div className="space-y-2">
            <div className="w-6 h-6 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center font-bold text-[11px]">2</div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Tap Share or Menu</h4>
            <p>On iOS, tap the Share icon at the bottom. On Android, tap the 3-dot menu in top right.</p>
          </div>
          <div className="space-y-2">
            <div className="w-6 h-6 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center font-bold text-[11px]">3</div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Select "Add to Home Screen"</h4>
            <p>Confirm name as "SecondMedic Staff" and launch directly like a native mobile app.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
