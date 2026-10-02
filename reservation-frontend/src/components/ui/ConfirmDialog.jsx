import React, { useEffect, useRef } from 'react';
import { Modal, Button } from 'react-bootstrap';

export default function ConfirmDialog({
  open,
  title = '確認',
  description = '',
  confirmText = '確定',
  cancelText = '取消',
  variant = 'danger',
  detail = null,
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null);
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // 有信件預覽時先停在取消，避免一打開就用 Enter 寄出
    const target = detail ? cancelBtnRef : confirmBtnRef;
    const t = setTimeout(() => target.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, detail]);

  return (
    <Modal show={!!open} onHide={onCancel} centered backdrop="static" keyboard={false} size={detail ? 'lg' : undefined}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {description ? <p className={detail ? 'mb-3' : 'mb-0'} style={{ whiteSpace: 'pre-line' }}>{description}</p> : null}
        {detail}
      </Modal.Body>
      <Modal.Footer>
        <Button ref={cancelBtnRef} variant="secondary" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button ref={confirmBtnRef} variant={variant} onClick={onConfirm}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

