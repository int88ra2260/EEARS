import React, { useEffect, useRef } from 'react';
import { Modal, Button } from 'react-bootstrap';

export default function AlertDialog({
  open,
  title = '提示',
  description = '',
  confirmText = '我知道了',
  variant = 'primary',
  onConfirm,
}) {
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => btnRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <Modal show={!!open} onHide={onConfirm} centered backdrop="static" keyboard={false}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {description ? (
          <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>
            {description}
          </p>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button ref={btnRef} variant={variant} onClick={onConfirm}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

