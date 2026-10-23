import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Table } from 'react-bootstrap';
import { fetchClient } from '../../utils/fetchClient';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export default function StudentAccountReviewPanel({ token }) {
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchClient('/api/admin/student-account-reviews', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setError(data.message || '無法載入待確認申請');
        setReviews([]);
        return;
      }
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch {
      setError('無法載入待確認申請');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, action) => {
    setMessage('');
    setError('');
    const res = await fetchClient(`/api/admin/student-account-reviews/${id}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseJson(res);
    if (!res.ok) {
      setError(data.message || '處理失敗');
      return;
    }
    setMessage(data.message || '已更新');
    load();
  };

  return (
    <div className="mb-4">
      <h5 className="mb-1">待確認的學生帳號</h5>
      <p className="text-muted small">
        名冊裡對得到學號與姓名的申請會直接建立。這裡只列出名冊沒有這位學生的申請。核准後才會建立帳號；拒絕則不會佔用學號或信箱。
      </p>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      {loading ? <p className="text-muted small">載入中…</p> : null}
      {!loading && reviews.length === 0 ? <p className="text-muted small">目前沒有待確認申請。</p> : null}
      {reviews.length > 0 ? (
        <Table responsive size="sm" bordered>
          <thead>
            <tr>
              <th>學號</th>
              <th>姓名</th>
              <th>信箱</th>
              <th>申請時間</th>
              <th>處理</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id}>
                <td>{review.studentId}</td>
                <td>{review.name}</td>
                <td>{review.email}</td>
                <td>{review.createdAt ? new Date(review.createdAt).toLocaleString('zh-TW') : ''}</td>
                <td>
                  <Button size="sm" className="me-2" onClick={() => act(review.id, 'approve')}>核准</Button>
                  <Button size="sm" variant="outline-secondary" onClick={() => act(review.id, 'reject')}>拒絕</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </div>
  );
}
