import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'compact' | 'pill' | 'labeled';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'compact', className = '' }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'labeled') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors border ${
          isDark
            ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/80'
        } ${className}`}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        title={`Current mode: ${theme}. Click to switch.`}
      >
        <div className="flex items-center gap-2">
          {isDark ? (
            <Moon className="w-4 h-4 text-teal-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
          <span className="font-medium">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${
            isDark ? 'bg-slate-700 text-teal-300' : 'bg-white text-slate-600 shadow-2xs'
          }`}
        >
          {theme}
        </span>
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
          isDark ? 'bg-teal-700 ring-offset-slate-900' : 'bg-slate-200 ring-offset-white'
        } ${className}`}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        title={`Current theme: ${theme}. Click to switch.`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform flex items-center justify-center ${
            isDark ? 'translate-x-6 bg-slate-900 text-teal-300' : 'translate-x-1 text-amber-500'
          }`}
        >
          {isDark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
        </span>
      </button>
    );
  }

  // Compact variant (standard in Header)
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors border focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 relative ${
        isDark
          ? 'text-amber-400 hover:text-amber-300 bg-slate-800 hover:bg-slate-700 border-slate-700 ring-offset-slate-900'
          : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border-slate-200 ring-offset-white'
      } ${className}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 animate-in fade-in zoom-in duration-200 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 animate-in fade-in zoom-in duration-200 text-slate-600" />
      )}
    </button>
  );
};
