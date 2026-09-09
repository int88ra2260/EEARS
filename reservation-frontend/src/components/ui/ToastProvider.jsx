import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import ToastMessage from './ToastMessage';
import ConfirmDialog from './ConfirmDialog';
import AlertDialog from './AlertDialog';
import { toastMotion } from '../../utils/motionPresets';

const ToastContext = createContext(null);
const ConfirmContext = createContext(null);
const AlertContext = createContext(null);

function nextId() {
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * 全站統一互動層 Provider：
 * - toast：非阻斷提示（success/error/info/warning）
 * - confirm：破壞性/需要確認的操作
 * - alert：阻斷式提示（取代 window.alert）
 *
 * 亦支援全域事件（讓 legacy util 可漸進式改造）：
 * - window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message, variant, duration } }))
 * - window.dispatchEvent(new CustomEvent('eears:alert', { detail: { title, description, variant } }))
 */
export default function ToastProvider({ children }) {
  const reduceMotion = useReducedMotion();
  const toastPresence = toastMotion(reduceMotion);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((message, variant = 'success', options = {}) => {
    const id = nextId();
    const duration = options.duration ?? 3000;
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
    return id;
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Confirm dialog (promise-based)
  const confirmResolverRef = useRef(null);
  const [confirmState, setConfirmState] = useState({ open: false, config: null });

  const confirm = useCallback((config) => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({
        open: true,
        config: {
          title: config?.title || '確認',
          description: config?.description || '',
          confirmText: config?.confirmText || '確定',
          cancelText: config?.cancelText || '取消',
          variant: config?.variant || 'danger',
        },
      });
    });
  }, []);

  const handleConfirmClose = useCallback(() => {
    setConfirmState({ open: false, config: null });
  }, []);

  const handleConfirmCancel = useCallback(() => {
    const resolve = confirmResolverRef.current;
    confirmResolverRef.current = null;
    handleConfirmClose();
    if (typeof resolve === 'function') resolve(false);
  }, [handleConfirmClose]);

  const handleConfirmAccept = useCallback(() => {
    const resolve = confirmResolverRef.current;
    confirmResolverRef.current = null;
    handleConfirmClose();
    if (typeof resolve === 'function') resolve(true);
  }, [handleConfirmClose]);

  // Alert dialog (promise-based)
  const alertResolverRef = useRef(null);
  const [alertState, setAlertState] = useState({ open: false, config: null });

  const alert = useCallback((config) => {
    return new Promise((resolve) => {
      alertResolverRef.current = resolve;
      setAlertState({
        open: true,
        config: {
          title: config?.title || '提示',
          description: config?.description || '',
          confirmText: config?.confirmText || '我知道了',
          variant: config?.variant || 'info',
        },
      });
    });
  }, []);

  const handleAlertClose = useCallback(() => {
    setAlertState({ open: false, config: null });
  }, []);

  const handleAlertAccept = useCallback(() => {
    const resolve = alertResolverRef.current;
    alertResolverRef.current = null;
    handleAlertClose();
    if (typeof resolve === 'function') resolve(true);
  }, [handleAlertClose]);

  // Progressive enhancement bridge for legacy utils
  useEffect(() => {
    const onToast = (evt) => {
      const d = evt?.detail || {};
      if (!d.message) return;
      pushToast(d.message, d.variant || 'info', { duration: d.duration });
    };
    const onAlert = (evt) => {
      const d = evt?.detail || {};
      alert({
        title: d.title || '提示',
        description: d.description || d.message || '',
        variant: d.variant || 'info',
        confirmText: d.confirmText || '我知道了',
      });
    };
    window.addEventListener('eears:toast', onToast);
    window.addEventListener('eears:alert', onAlert);
    return () => {
      window.removeEventListener('eears:toast', onToast);
      window.removeEventListener('eears:alert', onAlert);
    };
  }, [pushToast, alert]);

  const toastApi = useMemo(
    () => ({
      show: (message, variant = 'success', options = {}) => pushToast(message, variant, options),
      success: (message, options = {}) => pushToast(message, 'success', options),
      error: (message, options = {}) => pushToast(message, 'danger', options),
      warning: (message, options = {}) => pushToast(message, 'warning', options),
      info: (message, options = {}) => pushToast(message, 'info', options),
    }),
    [pushToast],
  );

  const confirmApi = useMemo(() => ({ confirm }), [confirm]);
  const alertApi = useMemo(() => ({ alert }), [alert]);

  return (
    <ToastContext.Provider value={toastApi}>
      <ConfirmContext.Provider value={confirmApi}>
        <AlertContext.Provider value={alertApi}>
          {children}

          {/* Global dialogs */}
          <ConfirmDialog
            open={confirmState.open}
            title={confirmState.config?.title}
            description={confirmState.config?.description}
            confirmText={confirmState.config?.confirmText}
            cancelText={confirmState.config?.cancelText}
            variant={confirmState.config?.variant}
            onCancel={handleConfirmCancel}
            onConfirm={handleConfirmAccept}
          />
          <AlertDialog
            open={alertState.open}
            title={alertState.config?.title}
            description={alertState.config?.description}
            confirmText={alertState.config?.confirmText}
            variant={alertState.config?.variant}
            onConfirm={handleAlertAccept}
          />

          {/* Toast stack */}
          <div
            className="position-fixed bottom-0 end-0 p-3"
            style={{ zIndex: 9999, width: 'min(420px, 100vw)' }}
            aria-live="polite"
            aria-relevant="additions"
          >
            <AnimatePresence initial={false}>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  className="mb-2"
                  layout={!reduceMotion}
                  {...toastPresence}
                >
                  <ToastMessage
                    show={true}
                    inline
                    message={t.message}
                    variant={t.variant}
                    duration={t.duration}
                    onClose={() => closeToast(t.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </AlertContext.Provider>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  return useContext(ToastContext);
}

export function useConfirmContext() {
  return useContext(ConfirmContext);
}

export function useAlertContext() {
  return useContext(AlertContext);
}

