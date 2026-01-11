/* eslint-disable react-refresh/only-export-components */
// This file exports both the ToastProvider component and useToast hook.
// This is a valid React pattern for context providers.

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { STORAGE_ERROR_EVENT } from '../store';

// ============================================
// TOAST TYPES
// ============================================
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    detail?: string;
    duration?: number;
    action?: ToastAction;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (toast: Omit<Toast, 'id'>) => void;
    showSuccess: (message: string, detail?: string) => void;
    showError: (message: string, detail?: string) => void;
    showWarning: (message: string, detail?: string) => void;
    showInfo: (message: string, detail?: string) => void;
    dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ============================================
// TOAST PROVIDER
// ============================================
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    // Track timeout IDs to allow cancellation on manual dismiss
    const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const dismissToast = useCallback((id: string) => {
        // Clear the auto-dismiss timeout if it exists
        const timeoutId = timeoutRefs.current.get(id);
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutRefs.current.delete(id);
        }
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = crypto.randomUUID();
        const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 4000);

        setToasts(prev => [...prev, { ...toast, id }]);

        // Auto-dismiss after duration
        if (duration > 0) {
            const timeoutId = setTimeout(() => {
                timeoutRefs.current.delete(id);
                dismissToast(id);
            }, duration);
            timeoutRefs.current.set(id, timeoutId);
        }
    }, [dismissToast]);

    const showSuccess = useCallback((message: string, detail?: string) => {
        showToast({ type: 'success', message, detail });
    }, [showToast]);

    const showError = useCallback((message: string, detail?: string) => {
        showToast({ type: 'error', message, detail, duration: 6000 });
    }, [showToast]);

    const showWarning = useCallback((message: string, detail?: string) => {
        showToast({ type: 'warning', message, detail });
    }, [showToast]);

    const showInfo = useCallback((message: string, detail?: string) => {
        showToast({ type: 'info', message, detail });
    }, [showToast]);

    // Cleanup all pending timeouts on unmount
    useEffect(() => {
        const refs = timeoutRefs.current;
        return () => {
            refs.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            refs.clear();
        };
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, showSuccess, showError, showWarning, showInfo, dismissToast }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </ToastContext.Provider>
    );
};

// ============================================
// TOAST HOOK
// ============================================
export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// ============================================
// TOAST CONTAINER
// ============================================
interface ToastContainerProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    return (
        <div
            className="fixed bottom-20 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none md:left-auto md:right-6 md:bottom-6 md:w-96"
            role="region"
            aria-label="Notifications"
            aria-live="polite"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
                ))}
            </AnimatePresence>
        </div>
    );
};

// ============================================
// TOAST ITEM
// ============================================
interface ToastItemProps {
    toast: Toast;
    onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
    const { t } = useTranslation();
    const icons = {
        success: <CheckCircle size={20} className="text-green-400" />,
        error: <XCircle size={20} className="text-red-400" />,
        warning: <AlertCircle size={20} className="text-yellow-400" />,
        info: <Info size={20} className="text-blue-400" />,
    };

    const backgrounds = {
        success: 'bg-green-500/10 border-green-500/30',
        error: 'bg-red-500/10 border-red-500/30',
        warning: 'bg-yellow-500/10 border-yellow-500/30',
        info: 'bg-blue-500/10 border-blue-500/30',
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-lg ${backgrounds[toast.type]}`}
            role="alert"
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
            <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
                {icons[toast.type]}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">
                    {toast.message}
                </p>
                {toast.detail && (
                    <p className="text-slate-400 text-xs mt-1 break-words">
                        {toast.detail}
                    </p>
                )}
                {toast.action && (
                    <button
                        onClick={() => {
                            toast.action?.onClick();
                            onDismiss(toast.id);
                        }}
                        className="mt-2 px-3 py-1 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>
            <button
                onClick={() => onDismiss(toast.id)}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                aria-label={t('common.closeNotification', 'Close notification')}
            >
                <X size={16} />
            </button>
        </motion.div>
    );
};

// ============================================
// STORAGE ERROR LISTENER
// ============================================
export const StorageErrorListener: React.FC = () => {
    const { showError } = useToast();
    const { t } = useTranslation();

    useEffect(() => {
        const handleStorageError = (event: Event) => {
            // Type guard for CustomEvent with expected detail structure
            if (!(event instanceof CustomEvent) || !event.detail) {
                return;
            }
            const detail = event.detail as { key?: string; error?: string };
            const error = detail.error;

            if (error === 'quota_exceeded') {
                showError(
                    t('common.storageError', 'Storage full'),
                    t('common.storageQuotaExceeded', 'Device storage is full. Some data may not be saved.')
                );
            } else {
                showError(
                    t('common.storageError', 'Storage error'),
                    t('common.storageSaveError', 'Failed to save data. Please try again.')
                );
            }
        };

        window.addEventListener(STORAGE_ERROR_EVENT, handleStorageError);
        return () => {
            window.removeEventListener(STORAGE_ERROR_EVENT, handleStorageError);
        };
    }, [showError, t]);

    return null;
};

export default ToastProvider;
