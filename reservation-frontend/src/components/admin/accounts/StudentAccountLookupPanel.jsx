import React, { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { fetchClient } from '../../../utils/fetchClient';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

function formatWhen(value) {
  if (!value) return '尚無';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚無';
  return date.toLocaleString('zh-TW');
}

export default function StudentAccountLookupPanel({ token }) {
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const lookup = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setResult(null);
    try {
      const params = new URLSearchParams({ studentId: studentId.trim() });
      const res = await fetchClient(`/api/admin/student-accounts/lookup?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setError(data.message || '無法查詢學生帳號');
        return;
      }
      setResult(data);
    } catch {
      setError('無法查詢學生帳號');
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async () => {
    const account = result?.account;
    if (!account?.id) return;
    setSending(true);
    setError('');
    setMessage('');
    try {
      const res = await fetchClient(`/api/admin/student-accounts/${account.id}/password-reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setError(data.message || '寄送失敗');
        return;
      }
      setMessage(data.message || '已寄出密碼重設信');
    } catch {
      setError('寄送失敗');
    } finally {
      setSending(false);
    }
  };

  const account = result?.kind === 'account' ? result.account : null;
  const canSend = Boolean(account && account.status === 'active' && account.hasLocalPassword);

  return (
    <div className="mb-4">
      <h5 className="mb-1">學生帳號</h5>
      <p className="text-muted small">
        用學號查已建立的帳號。重設密碼只會把驗證碼寄到註冊信箱，畫面上不會出現密碼。
      </p>
      <Form className="d-flex flex-wrap gap-2 align-items-end mb-3" onSubmit={lookup}>
        <Form.Group controlId="student-account-lookup-id">
          <Form.Label className="small mb-1">學號</Form.Label>
          <Form.Control
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            required
          />
        </Form.Group>
        <Button type="submit" disabled={loading}>{loading ? '查詢中…' : '查詢'}</Button>
      </Form>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      {result?.kind === 'none' ? <p className="text-muted small">找不到這個學號的帳號。</p> : null}
      {result?.kind === 'pending' ? (
        <p className="text-muted small mb-0">
          {result.pending?.studentId} {result.pending?.name} 尚在確認，還沒有帳號，無法重設密碼。信箱：{result.pending?.email}
        </p>
      ) : null}
      {account ? (
        <div>
          <dl className="row small mb-3">
            <dt className="col-sm-3">學號</dt>
            <dd className="col-sm-9">{account.studentId}</dd>
            <dt className="col-sm-3">姓名</dt>
            <dd className="col-sm-9">{account.name}</dd>
            <dt className="col-sm-3">信箱</dt>
            <dd className="col-sm-9">{account.email}</dd>
            <dt className="col-sm-3">狀態</dt>
            <dd className="col-sm-9">{account.status}</dd>
            <dt className="col-sm-3">本地密碼</dt>
            <dd className="col-sm-9">{account.hasLocalPassword ? '有' : '沒有'}</dd>
            <dt className="col-sm-3">最後登入</dt>
            <dd className="col-sm-9">{formatWhen(account.lastLoginAt)}</dd>
            <dt className="col-sm-3">最後改密碼</dt>
            <dd className="col-sm-9">{formatWhen(account.passwordChangedAt)}</dd>
          </dl>
          {canSend ? (
            <Button size="sm" onClick={sendReset} disabled={sending}>
              {sending ? '寄送中…' : '寄送密碼重設信'}
            </Button>
          ) : (
            <p className="text-muted small mb-0">這個帳號目前無法寄送重設信。</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
