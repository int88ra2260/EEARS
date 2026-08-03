import React from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';

export default function ClassOverviewDeleteModal({
  show,
  targetClass,
  deleteLoading,
  deleteError,
  onHide,
  onConfirm,
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>刪除班級資料</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          確定要刪除班級
          <strong className="ms-1">{targetClass?.className || ''}</strong>
          嗎？
        </p>
        <p className="text-danger small">
          此操作會移除班級名冊與統計資料，且無法復原。
        </p>
        {deleteError && (
          <Alert variant="danger" className="mb-0">{deleteError}</Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={deleteLoading}>
          取消
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={deleteLoading}>
          {deleteLoading ? '刪除中...' : '確認刪除'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
