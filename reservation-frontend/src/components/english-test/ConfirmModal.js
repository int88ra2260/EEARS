// 自訂確認框，取代 window.confirm，提升無障礙與一致性
import React, { useState } from 'react';

export default function ConfirmModal({
  show,
  title = '確認',
  message,
  confirmLabel = '確定',
  cancelLabel = '取消',
  variant = 'primary',
  onConfirm,
  onCancel
}) {
  const [busy, setBusy] = useState(false);

  if (!show) return null;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (onConfirm) await Promise.resolve(onConfirm());
      onCancel && onCancel();
    } catch (_) {
      // 錯誤由呼叫方 toast／處理；保持可再試
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmModalTitle"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="confirmModalTitle">{title}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onCancel}
              aria-label="關閉"
              disabled={busy}
            />
          </div>
          <div className="modal-body">{message}</div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn btn-${variant}`}
              onClick={handleConfirm}
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {busy ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                  處理中…
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
