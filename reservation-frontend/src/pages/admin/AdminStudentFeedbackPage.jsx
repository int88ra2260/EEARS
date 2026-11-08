import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spinner, Table } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import { fetchAdminStudentFeedback } from '../../services/studentFeedbackApi';

const FILTERS = [
  { id: '', label: '全部' },
  { id: 'problem', label: '問題回報' },
  { id: 'wish', label: '建議／許願' },
];

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function mailStatusLabel(status) {
  if (status === 'sent') return '已寄到中心信箱';
  if (status === 'failed') return '已留下，信箱沒送到';
  return '處理中';
}

export default function AdminStudentFeedbackPage() {
  const { token } = useOutletContext();
  const [kind, setKind] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await fetchAdminStudentFeedback(token, kind);
      if (!ok) {
        setError(data?.message || '無法載入學生回報');
        setItems([]);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setError('與伺服器連線發生錯誤');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, kind]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1">學生回報</h1>
          <p className="text-muted small mb-0">學生從「我的帳號」送來的問題與建議。不會公開給其他學生。</p>
        </div>
        <Button variant="outline-primary" size="sm" onClick={load} disabled={loading}>重新整理</Button>
      </div>
      <div className="d-flex gap-2 mb-3" role="group" aria-label="回報類型">
        {FILTERS.map((item) => (
          <Button
            key={item.id || 'all'}
            size="sm"
            variant={kind === item.id ? 'primary' : 'outline-secondary'}
            onClick={() => setKind(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted">
          <Spinner size="sm" animation="border" />
          載入中
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-muted">目前沒有回報。</p>
      ) : null}
      {!loading && items.length > 0 ? (
        <Table responsive bordered hover size="sm">
          <thead>
            <tr>
              <th>時間</th>
              <th>類型</th>
              <th>項目</th>
              <th>學生</th>
              <th>內容</th>
              <th>信件</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="text-nowrap">{formatWhen(item.createdAt)}</td>
                <td className="text-nowrap">{item.kindLabel}</td>
                <td className="text-nowrap">{item.categoryLabel}</td>
                <td>
                  <div>{item.studentName}</div>
                  <div className="text-muted">{item.studentId}</div>
                  <div className="text-muted">{item.email}</div>
                  {item.emailVerified ? null : <div className="text-muted">信箱尚未驗證</div>}
                </td>
                <td style={{ minWidth: '16rem', whiteSpace: 'pre-wrap' }}>{item.message}</td>
                <td className="text-nowrap">{mailStatusLabel(item.emailStatus)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </div>
  );
}
