import React, { memo } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';

function AdminEventDetailModals({
  cancelTarget,
  cancelVerificationCode,
  cancelCodeError,
  cancelSubmitting,
  onCancelCodeChange,
  onCloseCancel,
  onSubmitCancel,
  violationModalProps,
}) {
  const v = violationModalProps;

  return (
    <>
      <Modal show={!!cancelTarget} onHide={onCloseCancel} centered backdrop="static">
        <Modal.Header closeButton={!cancelSubmitting}>
          <Modal.Title>確認取消預約</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="small mb-3">
            此操作不受活動開始前 2 小時限制，但必須輸入該筆預約確認信中的取消驗證碼。送出後會刪除此預約紀錄，且無法復原。
          </Alert>
          <div className="mb-3">
            <div className="small text-muted">學生</div>
            <div className="fw-semibold">
              {cancelTarget?.studentId} {cancelTarget?.studentName || cancelTarget?.name}
            </div>
          </div>
          <Form.Group>
            <Form.Label>取消驗證碼</Form.Label>
            <Form.Control
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={cancelVerificationCode}
              onChange={(e) => onCancelCodeChange(e.target.value)}
              placeholder="請輸入 6 位數驗證碼"
              maxLength={6}
              disabled={cancelSubmitting}
              autoFocus
            />
            <Form.Text className="text-muted">
              驗證碼來源為學生預約成功通知信；系統會與該筆預約儲存的驗證碼比對。
            </Form.Text>
          </Form.Group>
          {cancelCodeError ? (
            <Alert variant="danger" className="py-2 mt-3 mb-0">
              {cancelCodeError}
            </Alert>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCloseCancel} disabled={cancelSubmitting}>
            取消
          </Button>
          <Button variant="danger" onClick={onSubmitCancel} disabled={cancelSubmitting}>
            {cancelSubmitting ? '處理中…' : '確認取消預約'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={v.showViolationModal} onHide={() => v.setShowViolationModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>登記違規</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="light" className="small border mb-3">
            送出後將同步至違規中心；請確認學號與事由無誤。
          </Alert>
          <Form.Group className="mb-2">
            <Form.Label>學號</Form.Label>
            <Form.Control
              value={v.violationData.studentId}
              onChange={(e) => v.setViolationData({ ...v.violationData, studentId: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>違規類型</Form.Label>
            <Form.Select
              value={v.violationData.violationType}
              onChange={(e) => v.setViolationData({ ...v.violationData, violationType: e.target.value })}
            >
              <option value="擾亂秩序">擾亂秩序</option>
              <option value="無故缺席">無故缺席</option>
              <option value="其他">其他</option>
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>說明</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={v.violationData.description}
              onChange={(e) => v.setViolationData({ ...v.violationData, description: e.target.value })}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => v.setShowViolationModal(false)}>
            取消
          </Button>
          <Button variant="danger" onClick={v.handleRecordEventViolation} disabled={!v.canManageViolations}>
            送出登記
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default memo(AdminEventDetailModals);
