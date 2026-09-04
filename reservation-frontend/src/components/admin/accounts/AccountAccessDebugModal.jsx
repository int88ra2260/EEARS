import React from 'react';
import { Alert, Badge, Button, Modal, Spinner } from 'react-bootstrap';
import { pickPermissionLabel } from '../../../constants/permissionGroups';

export default function AccountAccessDebugModal({
  show,
  account,
  data,
  loading,
  error,
  onClose,
}) {
  return (
    <Modal
      show={show}
      onHide={onClose}
      size="lg"
      scrollable
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>權限來源除錯</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {account ? (
          <p className="small text-muted mb-2">
            帳號：<strong>{account.username}</strong>（id={account.id}）
          </p>
        ) : null}
        {loading ? (
          <div className="d-flex align-items-center gap-2 text-muted py-3">
            <Spinner animation="border" size="sm" role="status" />
            <span>載入權限資料中…</span>
          </div>
        ) : null}
        {error ? <Alert variant="warning">{error}</Alert> : null}
        {data && !loading ? (
          <>
            <div className="mb-3">
              <div className="fw-semibold mb-1">帳號</div>
              <div className="small">
                <div>姓名：{data.teacher?.name || '—'}</div>
                <div>
                  角色：{data.teacher?.role}
                  ／{data.teacher?.teacherLevel || '—'}
                  {data.teacher?.staffLevel
                    ? `／職務：${data.teacher.staffLevel}`
                    : ''}
                  {data.teacher?.workerLevel
                    ? `／工讀職務：${data.teacher.workerLevel}`
                    : ''}
                </div>
                <div>啟用：{data.teacher?.isActive ? '是' : '否'}；accessVersion：{data.teacher?.accessVersion}</div>
                <div>最後登入：{data.teacher?.lastLoginAt ? new Date(data.teacher.lastLoginAt).toLocaleString('zh-TW') : '—'}</div>
              </div>
            </div>
            <div className="mb-3">
              <div className="fw-semibold mb-1">有效權限（{data.effectiveAccess?.readMode || '—'}）</div>
              <div className="d-flex flex-wrap gap-1">
                {(data.effectiveAccess?.permissions || []).map((k) => (
                  <Badge key={k} bg="light" text="dark" className="fw-normal">
                    {pickPermissionLabel(k)} <span className="text-muted">({k})</span>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <div className="fw-semibold mb-1">Deny 覆寫</div>
              {(data.sources?.userPermissionOverridesDeny || []).length ? (
                <div className="d-flex flex-wrap gap-1">
                  {data.sources.userPermissionOverridesDeny.map((k) => (
                    <Badge key={k} bg="danger" className="fw-normal">{pickPermissionLabel(k)}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted small">無</span>
              )}
            </div>
            <div className="mb-3">
              <div className="fw-semibold mb-1">Scopes</div>
              <div className="small">{(data.effectiveAccess?.scopes || []).join(', ') || '—'}</div>
            </div>
            <div className="mb-3">
              <div className="fw-semibold mb-1">診斷</div>
              {(data.diagnostics || []).length ? (
                <ul className="small mb-0 ps-3">
                  {data.diagnostics.map((d, i) => (
                    <li key={i}><Badge bg={d.level === 'warning' ? 'warning' : 'secondary'} text={d.level === 'warning' ? 'dark' : undefined}>{d.code}</Badge> {d.message}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted small">無</span>
              )}
            </div>
            <details className="small">
              <summary>原始 JSON（進階）</summary>
              <pre className="mt-2 mb-0 p-2 bg-light border rounded" style={{ fontSize: '0.7rem', maxHeight: 240, overflow: 'auto' }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          關閉
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
