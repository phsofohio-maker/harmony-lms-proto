import React from 'react';

interface AppLogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-16',
};

export function AppLogo({ variant = 'light', size = 'md', className }: AppLogoProps) {
  const src = variant === 'dark'
    ? '/images/HHCA_LMS_LogoPNG.png'
    : '/images/HHCA_LMS_LogoEPS_.svg';

  return (
    <img
      src={src}
      alt="Harmony Health Care Assistant — Clinical Education Mastery"
      className={`${sizeMap[size]} w-auto object-contain ${className ?? ''}`}
    />
  );
}
