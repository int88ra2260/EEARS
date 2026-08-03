import React from 'react';
import { Alert, Button, Modal, Stack } from 'react-bootstrap';

export default function AccountResetPasswordModal({
  resetInfo,
  pwdCopied,
  setPwdCopied,
  onClose,
}) {
  const handleCopyPassword = () => {
    if (!resetInfo?.password || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(resetInfo.password).then(() => {
      setPwdCopied(true);
      setTimeout(() => setPwdCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <Modal
      show={!!resetInfo}
      onHide={onClose}
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>臨時密碼</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-1">帳號：<strong>{resetInfo?.username}</strong></p>
        <Stack direction="horizontal" gap={2} className="align-items-center flex-wrap mb-3">
          <span className="text-nowrap">臨時密碼：</span>
          <code className="px-2 py-1 bg-light border rounded">{resetInfo?.password}</code>
          <Button
            size="sm"
            variant="outline-primary"
            onClick={handleCopyPassword}
          >
            {pwdCopied ? '已複製' : '複製密碼'}
          </Button>
        </Stack>
        <Alert variant="warning" className="mb-0 small">
          {resetInfo?.message}
          <div className="mt-2 mb-0">
            提醒：系統無法查詢或顯示使用者先前設定的密碼；請妥善保存此臨時密碼並透過安全管道轉交。
          </div>
        </Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>我已記錄</Button>
      </Modal.Footer>
    </Modal>
  );
}
