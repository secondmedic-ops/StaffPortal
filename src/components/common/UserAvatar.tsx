import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface UserAvatarProps {
  fullName: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-[11.5px]',
  md: 'h-10 w-10 text-[13px]',
  lg: 'h-14 w-14 text-[16px]',
  xl: 'h-20 w-20 text-[22px]',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  fullName,
  avatarUrl,
  size = 'md',
  className = '',
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const initials = (fullName || 'U')
    .replace(/^Dr\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  useEffect(() => {
    let active = true;
    if (!avatarUrl) {
      setSignedUrl(null);
      return;
    }

    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      setSignedUrl(avatarUrl);
      return;
    }

    // Storage path in avatars bucket
    supabase.storage
      .from('avatars')
      .createSignedUrl(avatarUrl, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        }
      })
      .catch(() => {
        if (active) setImgError(true);
      });

    return () => {
      active = false;
    };
  }, [avatarUrl]);

  const sizeClass = sizeClasses[size];

  if (signedUrl && !imgError) {
    return (
      <img
        src={signedUrl}
        alt={fullName}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-white dark:ring-slate-900 shadow-xs shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-white font-display font-semibold ring-2 ring-white dark:ring-slate-900 shadow-xs shrink-0 ${className}`}
    >
      {initials}
    </span>
  );
};
