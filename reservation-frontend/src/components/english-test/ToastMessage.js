// 簡單 Toast 回饋（Bootstrap 5 樣式）
import React, { useEffect } from 'react';

/**
 * @param {{
 *   show: boolean,
 *   message: string,
 *   variant?: string,
 *   onClose?: () => void,
 *   duration?: number,
 *   inline?: boolean,
 * }} props
 * inline=true：由 ToastProvider 堆疊容器定位（可搭配進出場動畫）
 */
export default function ToastMessage({
  show,
  message,
  variant = 'success',
  onClose,
  duration = 3000,
  inline = false,
}) {
  useEffect(() => {
    if (!show || !onClose || !duration) return undefined;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [show, onClose, duration]);

  if (!show || !message) return null;

  const bgClass = {
    success: 'bg-success text-white',
    danger: 'bg-danger text-white',
    warning: 'bg-warning text-dark',
    info: 'bg-info text-white',
  }[variant] || 'bg-success text-white';

  const closeClass =
    variant === 'warning' ? 'btn-close btn-sm ms-2' : 'btn-close btn-close-white btn-sm ms-2';

  return (
    <div
      className={inline ? `${bgClass} p-3` : `position-fixed bottom-0 end-0 p-3 ${bgClass}`}
      style={
        inline
          ? {
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              width: '100%',
            }
          : {
              zIndex: 9999,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: '200px',
              maxWidth: '360px',
            }
      }
      role="alert"
      aria-live="polite"
    >
      <div className="d-flex align-items-center">
        <span className="flex-grow-1">{message}</span>
        <button
          type="button"
          className={closeClass}
          onClick={onClose}
          aria-label="關閉"
        />
      </div>
    </div>
  );
}
