import React from 'react';
import { cn } from '../../utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  ...props
}) => {
  const variants = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-xs hover:shadow-sm',
    secondary: 'bg-navy-500 text-white hover:bg-navy-600 active:bg-navy-700 shadow-xs hover:shadow-sm',
    danger: 'bg-critical-500 text-white hover:bg-critical-600 shadow-xs hover:shadow-sm',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-600',
    outline: 'border-[1.5px] border-primary-500 bg-transparent text-primary-500 hover:bg-primary-50'
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-5 text-sm',
    lg: 'h-12 px-6 text-base'
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold tracking-[0.01em] transition-all duration-150 active:scale-[0.97] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
      {children}
    </button>
  );
};
