import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import { P } from '../../constants/permissions';
import {
  fetchAdminStudentFeedback,
  fetchAdminStudentFeedbackDetail,
  fetchFeedbackAssignees,
  patchAdminStudentFeedback,
  postAdminStudentFeedbackNote,
  postAdminStudentFeedbackReply,
} from '../../services/studentFeedbackApi';
import { hasPermission } from '../../utils/accessControl';

const FILTERS = [
  { id: '', label: '全部' },
  { id: 'problem', label: '問題回報' },
  { id: 'wish', label: '建議／許願' },
];

const STATUSES = [
  { id: '', label: '全部狀態' },
  { id: 'open', label: '待處理' },
  { id: 'in_progress', label: '處理中' },
  { id: 'closed', label: '已結案' },
];

const CATEGORIES = [
  { id: '', label: '全部項目' },
  { id: 'reservation', label: '預約或取消' },
  { id: 'survey', label: '問卷' },
  { id: 'account', label: '帳號或信箱' },
  { id: 'english_test', label: '培力報名' },
  { id: 'other', label: '其他' },
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
  const { token, accessProfile } = useOutletContext() || {};
  const canManage = Boolean(accessProfile && hasPermission(accessProfile, P.CAN_MANAGE_STUDENT_FEEDBACK));
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await fetchAdminStudentFeedback(token, {
        kind, status, category, q, assignedTeacherId: assigneeFilter, from, to, page,
      });
      if (!ok) {
        setError(data?.message || '無法載入學生回報');
        setItems([]);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total) || 0);
      setPageSize(Number(data?.pageSize) || 20);
    } catch {
      setError('與伺服器連線發生錯誤');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, kind, status, category, q, assigneeFilter, from, to, page]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setActionError('');
    try {
      const { ok, data } = await fetchAdminStudentFeedbackDetail(token, id);
      if (!ok) {
        setActionError(data?.message || '無法載入這筆回報');
        setDetail(null);
        return;
      }
      setDetail(data?.item || null);
      setAssigneeId(data?.item?.assignedTeacherId ? String(data.item.assignedTeacherId) : '');
    } catch {
      setActionError('與伺服器連線發生錯誤');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetchFeedbackAssignees(token).then(({ ok, data }) => {
      if (!cancelled && ok) setAssignees(Array.isArray(data?.items) ? data.items : []);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const selectRow = (id) => {
    setSelectedId(id);
    setReply('');
    setNote('');
    setNotice('');
    loadDetail(id);
  };

  const runAction = async (work) => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const { ok, data } = await work();
      if (!ok) {
        setActionError(data?.message || '沒有完成');
        return;
      }
      if (data?.item) {
        setDetail(data.item);
        setAssigneeId(data.item.assignedTeacherId ? String(data.item.assignedTeacherId) : '');
      }
      setNotice(data?.notice || '已更新');
      load();
    } catch {
      setActionError('與伺服器連線發生錯誤');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1">學生回報</h1>
          <p className="text-muted small mb-0">
            學生從「我的帳號」送來的問題與建議。回覆學生看得到；內部備註只給中心看。附件先不開放。
          </p>
        </div>
        <Button variant="outline-primary" size="sm" onClick={load} disabled={loading}>重新整理</Button>
      </div>
      <div className="d-flex gap-2 mb-3" role="group" aria-label="回報類型">
        {FILTERS.map((item) => (
          <Button
            key={item.id || 'all'}
            size="sm"
            variant={kind === item.id ? 'primary' : 'outline-secondary'}
            onClick={() => { setKind(item.id); setPage(1); }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <Form
        className="d-flex flex-wrap gap-2 mb-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQ(qInput.trim());
        }}
      >
        <Form.Control
          style={{ maxWidth: '16rem' }}
          value={qInput}
          placeholder="學號、姓名或內容"
          aria-label="搜尋回報"
          onChange={(e) => setQInput(e.target.value)}
        />
        <Form.Select style={{ maxWidth: '10rem' }} aria-label="狀態" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {STATUSES.map((item) => <option key={item.id || 'all-status'} value={item.id}>{item.label}</option>)}
        </Form.Select>
        <Form.Select style={{ maxWidth: '12rem' }} aria-label="項目" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          {CATEGORIES.map((item) => <option key={item.id || 'all-category'} value={item.id}>{item.label}</option>)}
        </Form.Select>
        <Form.Select style={{ maxWidth: '12rem' }} aria-label="承辦人" value={assigneeFilter} onChange={(e) => { setAssigneeFilter(e.target.value); setPage(1); }}>
          <option value="">全部承辦</option>
          <option value="none">尚未指派</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
        </Form.Select>
        <Form.Control type="date" aria-label="開始日期" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Form.Control type="date" aria-label="結束日期" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <Button type="submit" size="sm" variant="primary">搜尋</Button>
      </Form>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted">
          <Spinner size="sm" animation="border" />
          載入中
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? <p className="text-muted">目前沒有回報。</p> : null}
      {!loading && items.length > 0 ? (
        <Table responsive bordered hover size="sm">
          <thead>
            <tr>
              <th>時間</th>
              <th>狀態</th>
              <th>類型</th>
              <th>項目</th>
              <th>學生</th>
              <th>內容</th>
              <th>承辦</th>
              <th>信件</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => selectRow(item.id)}
                style={{ cursor: 'pointer' }}
                className={selectedId === item.id ? 'table-primary' : undefined}
              >
                <td className="text-nowrap">{formatWhen(item.createdAt)}</td>
                <td className="text-nowrap">{item.statusLabel}</td>
                <td className="text-nowrap">{item.kindLabel}</td>
                <td className="text-nowrap">{item.categoryLabel}</td>
                <td>
                  <div>{item.studentName}</div>
                  <div className="text-muted">{item.studentId}</div>
                  <div className="text-muted">{item.email}</div>
                </td>
                <td style={{ minWidth: '16rem', whiteSpace: 'pre-wrap' }}>{item.message}</td>
                <td className="text-nowrap">{item.assigneeName || '尚未指派'}</td>
                <td className="text-nowrap">{mailStatusLabel(item.emailStatus)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      {pages > 1 ? (
        <div className="d-flex align-items-center gap-2 mb-3">
          <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一頁</Button>
          <span className="small">{page} / {pages}（共 {total} 筆）</span>
          <Button size="sm" variant="outline-secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>下一頁</Button>
        </div>
      ) : null}
      {detail ? (
        <section className="border rounded p-3" aria-labelledby="student-feedback-detail-title">
          <h2 className="h5" id="student-feedback-detail-title">
            {detail.kindLabel} · {detail.statusLabel}
          </h2>
          <p className="small text-muted mb-2">
            {detail.studentName} {detail.studentId} · {detail.replyRequested ? '希望得到回覆' : '不要求個別回覆'}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{detail.message}</p>
          {(detail.messages || []).map((entry) => (
            <article key={entry.id} className="border-top pt-2 mt-2">
              <p className="small text-muted mb-1">
                {entry.visibility === 'internal' ? '內部備註' : (entry.authorType === 'staff' ? '回覆學生' : '學生補充')}
                {entry.teacherName ? ` · ${entry.teacherName}` : ''}
                {' · '}
                {formatWhen(entry.createdAt)}
                {entry.visibility === 'public' && entry.authorType === 'staff' && entry.emailStatus === 'failed' ? ' · 通知信沒有寄出' : ''}
              </p>
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{entry.body}</p>
            </article>
          ))}
          {notice ? <Alert variant="success" className="mt-3 mb-0">{notice}</Alert> : null}
          {actionError ? <Alert variant="danger" className="mt-3 mb-0">{actionError}</Alert> : null}
          {canManage ? (
            <div className="mt-3 d-grid gap-3">
              <Form
                className="d-flex flex-wrap gap-2 align-items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(() => patchAdminStudentFeedback(token, detail.id, {
                    assignedTeacherId: assigneeId ? Number(assigneeId) : null,
                  }));
                }}
              >
                <Form.Group>
                  <Form.Label>承辦人</Form.Label>
                  <Form.Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-label="承辦人">
                    <option value="">尚未指派</option>
                    {assignees.map((person) => (
                      <option key={person.id} value={person.id}>{person.name}（{person.roleLabel}）</option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Button type="submit" size="sm" disabled={busy}>指派</Button>
                {detail.status === 'closed' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    disabled={busy}
                    onClick={() => runAction(() => patchAdminStudentFeedback(token, detail.id, { status: 'in_progress' }))}
                  >
                    改回處理中
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    disabled={busy}
                    onClick={() => runAction(() => patchAdminStudentFeedback(token, detail.id, { status: 'closed' }))}
                  >
                    結案
                  </Button>
                )}
              </Form>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(async () => {
                    const result = await postAdminStudentFeedbackReply(token, detail.id, reply);
                    if (result.ok) setReply('');
                    return result;
                  });
                }}
              >
                <Form.Label htmlFor="student-feedback-reply">回覆學生</Form.Label>
                <Form.Control
                  id="student-feedback-reply"
                  as="textarea"
                  rows={3}
                  value={reply}
                  maxLength={2000}
                  onChange={(e) => setReply(e.target.value)}
                  required
                />
                <Button className="mt-2" type="submit" size="sm" disabled={busy}>送出回覆</Button>
              </Form>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(async () => {
                    const result = await postAdminStudentFeedbackNote(token, detail.id, note);
                    if (result.ok) setNote('');
                    return result;
                  });
                }}
              >
                <Form.Label htmlFor="student-feedback-note">內部備註</Form.Label>
                <Form.Control
                  id="student-feedback-note"
                  as="textarea"
                  rows={2}
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                  required
                />
                <Button className="mt-2" type="submit" size="sm" variant="outline-primary" disabled={busy}>記下備註</Button>
              </Form>
            </div>
          ) : (
            <p className="text-muted small mt-3 mb-0">你目前可以查看，不能回覆、指派或結案。</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
