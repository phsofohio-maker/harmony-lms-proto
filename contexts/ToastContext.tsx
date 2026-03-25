import React, { createContext, useState, useCallback, useRef } from 'react';
import { Toast, ToastData } from '../components/ui/Toast';
import { useAppSound } from '../hooks/useAppSound';

interface ToastContextValue {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => string;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastData['type'], number> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
};

const MAX_TOASTS = 3;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const { playSuccess, playCaution, playError, playNotification } = useAppSound();

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>): string => {
    // Dedup: if toast with identical title + message exists, reset its timer
    const existingIndex = toasts.findIndex(
      t => t.title === toast.title && t.message === toast.message
    );

    if (existingIndex !== -1) {
      const existing = toasts[existingIndex];
      const oldTimer = timersRef.current.get(existing.id);
      if (oldTimer) clearTimeout(oldTimer);

      const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type] + (toast.action ? 4000 : 0);
      const timer = setTimeout(() => removeToast(existing.id), duration);
      timersRef.current.set(existing.id, timer);

      return existing.id;
    }

    const id = Math.random().toString(36).substring(2, 11);
    const newToast: ToastData = { ...toast, id };

    setToasts(prev => {
      const next = [...prev, newToast];
      // Max 3 visible, remove oldest if overflow
      if (next.length > MAX_TOASTS) {
        const removed = next.shift()!;
        const oldTimer = timersRef.current.get(removed.id);
        if (oldTimer) {
          clearTimeout(oldTimer);
          timersRef.current.delete(removed.id);
        }
      }
      return next;
    });

    const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type] + (toast.action ? 4000 : 0);
    const timer = setTimeout(() => removeToast(id), duration);
    timersRef.current.set(id, timer);

    // Play sound based on toast type
    switch (toast.type) {
      case 'success': playSuccess(); break;
      case 'error': playError(); break;
      case 'warning': playCaution(); break;
      case 'info': playNotification(); break;
    }

    return id;
  }, [toasts, removeToast, playSuccess, playError, playCaution, playNotification]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-2">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
