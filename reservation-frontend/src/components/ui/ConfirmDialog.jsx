import React, { useEffect, useRef } from 'react';
import { Modal, Button } from 'react-bootstrap';

export default function ConfirmDialog({
  open,
  title = '確認',
  description = '',
  confirmText = '確定',
  cancelText = '取消',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // 將焦點移到「確認」按鈕，改善鍵盤體驗
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <Modal show={!!open} onHide={onCancel} centered backdrop="static" keyboard={false}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {description ? <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>{description}</p> : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button ref={confirmBtnRef} variant={variant} onClick={onConfirm}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

