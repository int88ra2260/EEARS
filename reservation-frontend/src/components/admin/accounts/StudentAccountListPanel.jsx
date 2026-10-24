import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Table } from 'react-bootstrap';
import { fetchClient } from '../../../utils/fetchClient';

const PAGE_SIZE = 50;

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

function formatWhen(value) {
  if (!value) return '尚無';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚無';
  return date.toLocaleString('zh-TW');
}

function statusLabel(status) {
  if (status === 'active') return '可登入';
  return status || '未知';
}

export default function StudentAccountListPanel({ token }) {
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (appliedQ) params.set('q', appliedQ);
      const res = await fetchClient(`/api/admin/student-accounts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setError(data.message || '無法載入學生帳號');
        setAccounts([]);
        setTotal(0);
        return;
      }
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      setTotal(Number(data.total) || 0);
    } catch {
      setError('無法載入學生帳號');
      setAccounts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [appliedQ, page, token]);

  useEffect(() => {
    load();
  }, [load]);

  const search = (event) => {
    event.preventDefault();
    const next = q.trim();
    if (next === appliedQ && page === 1) {
      load();
      return;
    }
    setAppliedQ(next);
    setPage(1);
  };

  const clearSearch = () => {
    setQ('');
    setAppliedQ('');
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mb-4">
      <h5 className="mb-1">已建立的學生帳號</h5>
      <p className="text-muted small">
        名冊核對成功，或待確認申請已核准的帳號會出現在這裡。尚未核准的申請不會列入。
      </p>
      <Form className="d-flex flex-wrap gap-2 align-items-end mb-3" onSubmit={search}>
        <Form.Group controlId="student-account-list-q">
          <Form.Label className="small mb-1">學號、姓名或信箱</Form.Label>
          <Form.Control value={q} onChange={(event) => setQ(event.target.value)} />
        </Form.Group>
        <Button type="submit" disabled={loading}>{loading ? '載入中…' : '查詢'}</Button>
        {appliedQ ? (
          <Button type="button" variant="outline-secondary" onClick={clearSearch} disabled={loading}>
            清除
          </Button>
        ) : null}
      </Form>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? <p className="text-muted small">載入中…</p> : null}
      {!loading && accounts.length === 0 ? (
        <p className="text-muted small">
          {appliedQ ? '沒有符合的帳號。' : '目前沒有已建立的學生帳號。'}
        </p>
      ) : null}
      {accounts.length > 0 ? (
        <Table responsive size="sm" bordered>
          <thead>
            <tr>
              <th>學號</th>
              <th>姓名</th>
              <th>信箱</th>
              <th>狀態</th>
              <th>本地密碼</th>
              <th>建立時間</th>
              <th>最後登入</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.studentId}</td>
                <td>{account.name}</td>
                <td>{account.email}</td>
                <td>{statusLabel(account.status)}</td>
                <td>{account.hasLocalPassword ? '有' : '沒有'}</td>
                <td>{formatWhen(account.createdAt)}</td>
                <td>{formatWhen(account.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      {total > 0 ? (
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <span className="small text-muted">共 {total} 筆，第 {page} / {pageCount} 頁</span>
          <Button size="sm" variant="outline-secondary" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>
            上一頁
          </Button>
          <Button size="sm" variant="outline-secondary" disabled={loading || page >= pageCount} onClick={() => setPage((current) => current + 1)}>
            下一頁
          </Button>
        </div>
      ) : null}
    </div>
  );
}
