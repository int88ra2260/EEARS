import React from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';
import { studentTrajectoryPath } from '../../utils/learningAnalyticsRecentStudents';

function formatNum(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('zh-TW');
}

function formatEvidence(evidence) {
  if (!evidence) return '—';
  const parts = [
    evidence.skillLabel,
    evidence.cefrLevel,
    evidence.instrument,
    evidence.examDate,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

export default function OverviewStudentListModal({
  show,
  title,
  loading,
  error,
  data,
  onHide,
  onPage,
}) {
  const total = Number(data?.total || 0);
  const limit = Math.max(1, Number(data?.limit || 40));
  const offset = Math.max(0, Number(data?.offset || 0));
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const items = data?.items || [];

  return (
    <Modal show={show} onHide={onHide} size="lg" scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5 mb-0">{title || '學生名單'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" />
            <div className="small text-muted mt-2">正在讀取名單…</div>
          </div>
        ) : null}
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {!loading && data ? (
          <>
            <p className="small text-muted mb-2">{formatNum(total)} 人。條件與總覽目前的資料版本、入學年度相同。</p>
            {items.length ? (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-2">
                  <thead>
                    <tr>
                      <th>學號</th>
                      <th>姓名</th>
                      <th>系所</th>
                      <th>入學年度</th>
                      <th>列入依據</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.studentId}>
                        <td>
                          <Link to={studentTrajectoryPath(row.studentId, '/admin/learning-analytics/overview')}>
                            {row.studentId}
                          </Link>
                        </td>
                        <td>{row.studentName || '—'}</td>
                        <td>{row.department || '—'}</td>
                        <td>{row.cohort || '—'}</td>
                        <td>{formatEvidence(row.evidence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Alert variant="secondary" className="mb-2">這個條件下沒有學生。</Alert>
            )}
            <div className="d-flex justify-content-between align-items-center">
              <Button variant="outline-secondary" size="sm" disabled={page <= 1} onClick={() => onPage(Math.max(0, offset - limit))}>
                上一頁
              </Button>
              <span className="small text-muted">{page} / {pages}</span>
              <Button variant="outline-secondary" size="sm" disabled={page >= pages} onClick={() => onPage(offset + limit)}>
                下一頁
              </Button>
            </div>
          </>
        ) : null}
      </Modal.Body>
    </Modal>
  );
}
