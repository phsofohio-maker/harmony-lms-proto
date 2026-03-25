import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../utils';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const borderColorMap = {
  success: 'border-l-primary-600',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
};

const iconColorMap = {
  success: 'text-primary-600',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const Icon = iconMap[toast.type];

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 border-l-4 rounded-lg shadow-md p-4 max-w-[420px] w-full',
        'transition-all duration-200 ease-out',
        'animate-in',
        borderColorMap[toast.type]
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn('h-5 w-5 shrink-0 mt-0.5', iconColorMap[toast.type])}
          strokeWidth={1.75}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
          {toast.message && (
            <p className="text-sm text-gray-600 mt-0.5">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 mt-1.5 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};
