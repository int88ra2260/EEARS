import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { useToastContext } from '../ui/ToastProvider';
import {
  adminApproveSubmission,
  adminRejectSubmission,
  adminFetchSubmission,
} from '../../services/englishLearningPassportApi';
import { formatSubmissionMetadata } from '../../utils/elpSubmissionDisplay';

function RejectReasonModal({ show, onHide, onConfirm, title, loading }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!show) setReason('');
  }, [show]);

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton><Modal.Title>{title}</Modal.Title></Modal.Header>
      <Modal.Body>
        <Form.Group>
          <Form.Label>退件原因 <span className="text-danger">*</span></Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>取消</Button>
        <Button
          variant="danger"
          disabled={!reason.trim() || loading}
          onClick={() => onConfirm(reason.trim())}
        >
          確認退回
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function EnglishLearningSubmissionReviewModal({
  show,
  onHide,
  submission,
  token,
  onDone,
  studentFallback,
}) {
  const [detail, setDetail] = useState(null);
  const [points, setPoints] = useState('');
  const [loading, setLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const toast = useToastContext();

  const submissionId = submission?.id;

  useEffect(() => {
    if (!show || !submissionId || !token) {
      setDetail(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    adminFetchSubmission(token, submissionId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e.message || '載入提交詳情失敗');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [show, submissionId, token, toast]);

  const active = useMemo(() => detail || submission, [detail, submission]);
  const studentName = active?.studentName || studentFallback?.studentName;
  const studentId = active?.studentId || studentFallback?.studentId;

  useEffect(() => {
    if (active) {
      setPoints(String(active.suggestedPoints ?? active.pointsRequested ?? ''));
    }
  }, [active]);

  const handleApprove = async () => {
    if (!active?.id) return;
    setLoading(true);
    try {
      await adminApproveSubmission(token, active.id, Number(points));
      toast.success('已核准');
      onDone?.();
      onHide();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (reason) => {
    if (!active?.id) return;
    setLoading(true);
    try {
      await adminRejectSubmission(token, active.id, reason);
      toast.success('已退回');
      setRejectOpen(false);
      onDone?.();
      onHide();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const metaRows = active ? formatSubmissionMetadata(active.ruleCode, active.metadataJson) : [];

  return (
    <>
      <Modal show={show} onHide={onHide} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>審核點數項目</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading && !active ? (
            <p className="text-muted mb-0">載入中…</p>
          ) : !active ? (
            <p className="text-danger mb-0">無法載入提交紀錄</p>
          ) : (
            <>
              <div className="elp-review-meta mb-3">
                <div><strong>{studentName || '—'}</strong>{studentId ? `（${studentId}）` : ''}</div>
                <div>類型：<code>{active.ruleCode}</code> · {active.title || '—'}</div>
                <div>活動日期：{active.activityDate || '—'}</div>
                <div>申請點數：{active.pointsRequested} 點 · 系統建議：{active.suggestedPoints ?? '—'} 點</div>
                {active.description && <div>備註：{active.description}</div>}
                {active.meetsDirectEnglishStandard && (
                  <div className="text-success small mt-1">符合英檢直接認證門檻</div>
                )}
              </div>

              {metaRows.length > 0 && (
                <Table size="sm" bordered className="mb-3" style={{ maxWidth: 520 }}>
                  <tbody>
                    {metaRows.map((row) => (
                      <tr key={row.label}>
                        <th className="bg-light" style={{ width: '35%' }}>{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}

              {active.attachments?.length > 0 && (
                <div className="mb-3">
                  <strong>附件</strong>
                  <ul className="mb-0 mt-1">
                    {active.attachments.map((a) => (
                      <li key={a.id}>
                        <a href={`/uploads/${a.filePath}`} target="_blank" rel="noreferrer">
                          {a.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {active.status === 'submitted' && (
                <Form.Group>
                  <Form.Label>核定點數</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                  />
                  <Form.Text className="text-muted">
                    建議 {active.suggestedPoints ?? active.pointsRequested} 點；可依審核結果調整
                  </Form.Text>
                </Form.Group>
              )}

              {active.status !== 'submitted' && (
                <p className="text-muted small mb-0">
                  此紀錄狀態為「{active.status}」，僅供查閱。
                </p>
              )}
            </>
          )}
        </Modal.Body>
        {active?.status === 'submitted' && (
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={onHide} disabled={loading}>關閉</Button>
            <Button variant="outline-danger" onClick={() => setRejectOpen(true)} disabled={loading}>
              退回
            </Button>
            <Button variant="success" onClick={handleApprove} disabled={loading || points === ''}>
              {loading ? '處理中…' : '核准'}
            </Button>
          </Modal.Footer>
        )}
      </Modal>

      <RejectReasonModal
        show={rejectOpen}
        onHide={() => setRejectOpen(false)}
        title="退回點數項目"
        loading={loading}
        onConfirm={handleReject}
      />
    </>
  );
}
