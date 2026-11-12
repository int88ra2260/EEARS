import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import EmptyState from '../../components/ui/EmptyState';
import { P } from '../../constants/permissions';
import {
  fetchAdminStudentFeedback,
  fetchAdminStudentFeedbackDetail,
  fetchAdminStudentFeedbackEvents,
  fetchAdminStudentFeedbackSummary,
  fetchFeedbackAssignees,
  patchAdminStudentFeedback,
  postAdminStudentFeedbackNote,
  postAdminStudentFeedbackReply,
} from '../../services/studentFeedbackApi';
import { hasPermission } from '../../utils/accessControl';

const EVENT_PAGE_SIZE = 50;
const EVENT_PAGE_CAP = 20;
const EVENT_TYPE_LABELS = {
  STATUS_CHANGED: '狀態變更',
  ASSIGNEE_CHANGED: '承辦變更',
  PRIORITY_CHANGED: '優先級變更',
};
const PRIORITY_TEXT = {
  P0: 'P0（最優先）',
  P1: 'P1（高）',
  P2: 'P2（中）',
  P3: 'P3（低）',
};
const STATUS_TEXT = {
  open: '待處理',
  in_progress: '處理中',
  closed: '已結案',
};

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
  { id: 'learning_journey', label: '學習歷程' },
  { id: 'display', label: '介面顯示' },
  { id: 'other', label: '其他' },
];

const PRIORITIES = [
  { id: '', label: '未設定' },
  { id: 'P0', label: 'P0（最優先）' },
  { id: 'P1', label: 'P1（高）' },
  { id: 'P2', label: 'P2（中）' },
  { id: 'P3', label: 'P3（低）' },
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

function mergeEvents(current, incoming) {
  const map = new Map();
  [...current, ...(Array.isArray(incoming) ? incoming : [])].forEach((item) => {
    if (item && item.id != null) map.set(item.id, item);
  });
  return [...map.values()].sort((a, b) => {
    const left = new Date(a.createdAt).getTime();
    const right = new Date(b.createdAt).getTime();
    const leftTime = Number.isNaN(left) ? 0 : left;
    const rightTime = Number.isNaN(right) ? 0 : right;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return Number(a.id) - Number(b.id);
  });
}

function statusText(status) {
  if (status == null || status === '') return '未記錄';
  return STATUS_TEXT[status] || String(status);
}

function assigneeText(id, catalog) {
  if (id == null || id === '') return '尚未指派';
  const person = (catalog || []).find((item) => String(item.id) === String(id));
  if (person && person.name) return person.name;
  return `教師 #${id}`;
}

function actorText(event, catalog) {
  if (!event || event.actorType === 'student') return '學生';
  if (event.actorTeacherId) return assigneeText(event.actorTeacherId, catalog);
  return '工作人員';
}

function priorityText(priority) {
  if (priority == null || priority === '') return '未設定';
  return PRIORITY_TEXT[priority] || String(priority);
}

function eventValueText(event, side, catalog) {
  const source = event && event[side] && typeof event[side] === 'object' ? event[side] : {};
  if (event && event.eventType === 'STATUS_CHANGED') return statusText(source.status);
  if (event && event.eventType === 'ASSIGNEE_CHANGED') return assigneeText(source.assignedTeacherId, catalog);
  if (event && event.eventType === 'PRIORITY_CHANGED') return priorityText(source.priority);
  return '沒有可顯示的內容';
}

function FeedbackTimeline({
  events,
  total,
  loading,
  loadingMore,
  error,
  assignees,
  onLoadMore,
}) {
  const visible = events.filter((event) => event.visibility !== 'internal');
  return (
    <section className="mt-3" aria-labelledby="student-feedback-timeline-title" style={{ minWidth: 0 }}>
      <h3 className="h6 mb-2" id="student-feedback-timeline-title">處理歷程</h3>
      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted mb-2" role="status">
          <Spinner size="sm" animation="border" />
          歷程載入中
        </div>
      ) : null}
      {error ? <Alert variant="warning" className="py-2">{error}</Alert> : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState
          density="compact"
          variant="no-activity"
          icon="info"
          title="尚無處理歷程"
          description="狀態與承辦變更會列在這裡。"
        />
      ) : null}
      {visible.length > 0 ? (
        <ol className="list-unstyled mb-2 d-grid gap-2" style={{ minWidth: 0 }}>
          {visible.map((event) => (
            <li
              key={event.id}
              className="ps-3 py-1"
              style={{
                borderLeft: '3px solid var(--color-primary)',
                overflowWrap: 'anywhere',
                minWidth: 0,
              }}
            >
              <div className="fw-semibold" style={{ color: 'var(--color-primary-dark)' }}>
                {EVENT_TYPE_LABELS[event.eventType] || event.eventType || '未標示事件'}
              </div>
              <div className="small">操作者：{actorText(event, assignees)}</div>
              {event.eventType === 'PRIORITY_CHANGED' ? (
                <div className="small">
                  優先級由 {eventValueText(event, 'beforeValue', assignees)} 調整為 {eventValueText(event, 'afterValue', assignees)}。
                </div>
              ) : (
                <>
                  <div className="small">原始值：{eventValueText(event, 'beforeValue', assignees)}</div>
                  <div className="small">新值：{eventValueText(event, 'afterValue', assignees)}</div>
                </>
              )}
              <div className="small text-muted">操作時間：{formatWhen(event.createdAt) || '時間未記錄'}</div>
            </li>
          ))}
        </ol>
      ) : null}
      {events.length < total ? (
        <Button
          type="button"
          size="sm"
          variant="outline-primary"
          onClick={onLoadMore}
          disabled={loading || loadingMore}
        >
          {loadingMore ? '載入中' : '載入更多'}
        </Button>
      ) : null}
    </section>
  );
}

export default function AdminStudentFeedbackPage() {
  const { token, accessProfile } = useOutletContext() || {};
  const canManage = Boolean(accessProfile && hasPermission(accessProfile, P.CAN_MANAGE_STUDENT_FEEDBACK));
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const summaryRequest = useRef(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const eventsRequest = useRef(0);
  const eventsLoadedPage = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await fetchAdminStudentFeedback(token, {
        kind, status, category, priority: priorityFilter, q, assignedTeacherId: assigneeFilter, from, to, page, sortBy, sortOrder,
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
  }, [token, kind, status, category, priorityFilter, q, assigneeFilter, from, to, page, sortBy, sortOrder]);

  const loadSummary = useCallback(async () => {
    const requestId = summaryRequest.current + 1;
    summaryRequest.current = requestId;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const { ok, data } = await fetchAdminStudentFeedbackSummary(token);
      if (requestId !== summaryRequest.current) return;
      if (!ok) {
        setSummaryError(data?.message || '無法載入統計');
        return;
      }
      setSummary({
        total: Number(data?.total) || 0,
        open: Number(data?.open) || 0,
        inProgress: Number(data?.inProgress) || 0,
        closed: Number(data?.closed) || 0,
        unresolved: Number(data?.unresolved) || 0,
      });
    } catch {
      if (requestId !== summaryRequest.current) return;
      setSummaryError('與伺服器連線發生錯誤');
    } finally {
      if (requestId === summaryRequest.current) setSummaryLoading(false);
    }
  }, [token]);

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
      setPriorityId(data?.item?.priority || '');
    } catch {
      setActionError('與伺服器連線發生錯誤');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSummary();
    return () => {
      summaryRequest.current += 1;
    };
  }, [loadSummary]);

  useEffect(() => {
    let cancelled = false;
    fetchFeedbackAssignees(token).then(({ ok, data }) => {
      if (!cancelled && ok) setAssignees(Array.isArray(data?.items) ? data.items : []);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => () => {
    eventsRequest.current += 1;
  }, []);

  const loadTimeline = useCallback(async (id, { reset = false, followAll = false } = {}) => {
    if (!id) return;
    const requestId = eventsRequest.current + 1;
    eventsRequest.current = requestId;
    if (reset) {
      eventsLoadedPage.current = 0;
      setTimeline([]);
      setTimelineTotal(0);
    }
    setTimelineLoading(true);
    setTimelineError('');
    try {
      const first = await fetchAdminStudentFeedbackEvents(token, id, { page: 1, pageSize: EVENT_PAGE_SIZE });
      if (requestId !== eventsRequest.current) return;
      if (!first.ok) {
        setTimelineError(first.data?.message || '無法載入處理歷程');
        if (reset) {
          setTimeline([]);
          setTimelineTotal(0);
          eventsLoadedPage.current = 0;
        }
        return;
      }
      let merged = mergeEvents([], first.data?.items);
      let total = Number(first.data?.total) || 0;
      let loaded = 1;
      if (followAll) {
        while (merged.length < total && loaded < EVENT_PAGE_CAP) {
          const next = await fetchAdminStudentFeedbackEvents(token, id, {
            page: loaded + 1,
            pageSize: EVENT_PAGE_SIZE,
          });
          if (requestId !== eventsRequest.current) return;
          if (!next.ok) {
            setTimelineError(next.data?.message || '無法載入處理歷程');
            break;
          }
          const combined = mergeEvents(merged, next.data?.items);
          loaded += 1;
          total = Number(next.data?.total) || total;
          if (combined.length === merged.length) break;
          merged = combined;
        }
      }
      if (requestId !== eventsRequest.current) return;
      setTimeline(merged);
      setTimelineTotal(total);
      eventsLoadedPage.current = loaded;
    } catch {
      if (requestId !== eventsRequest.current) return;
      setTimelineError('與伺服器連線發生錯誤');
      if (reset) {
        setTimeline([]);
        setTimelineTotal(0);
      }
    } finally {
      if (requestId === eventsRequest.current) setTimelineLoading(false);
    }
  }, [token]);

  const loadMoreTimeline = useCallback(async () => {
    if (!selectedId || timelineLoading || timelineLoadingMore) return;
    const requestId = eventsRequest.current + 1;
    eventsRequest.current = requestId;
    const nextPage = eventsLoadedPage.current + 1;
    setTimelineLoadingMore(true);
    setTimelineError('');
    try {
      const next = await fetchAdminStudentFeedbackEvents(token, selectedId, {
        page: nextPage,
        pageSize: EVENT_PAGE_SIZE,
      });
      if (requestId !== eventsRequest.current) return;
      if (!next.ok) {
        setTimelineError(next.data?.message || '無法載入處理歷程');
        return;
      }
      const combined = mergeEvents(timeline, next.data?.items);
      setTimeline(combined);
      setTimelineTotal(Number(next.data?.total) || 0);
      eventsLoadedPage.current = nextPage;
      if (combined.length === timeline.length) setTimelineTotal(combined.length);
    } catch {
      if (requestId !== eventsRequest.current) return;
      setTimelineError('與伺服器連線發生錯誤');
    } finally {
      if (requestId === eventsRequest.current) setTimelineLoadingMore(false);
    }
  }, [selectedId, timeline, timelineLoading, timelineLoadingMore, token]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const selectRow = (id) => {
    setSelectedId(id);
    setReply('');
    setNote('');
    setNotice('');
    setPriorityId('');
    setTimeline([]);
    setTimelineTotal(0);
    setTimelineError('');
    loadDetail(id);
    loadTimeline(id, { reset: true });
  };

  const runAction = async (work) => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const { ok, data } = await work();
      if (!ok) {
        setActionError(data?.message || '沒有完成');
        setPriorityId(detail?.priority || '');
        return;
      }
      if (data?.item) {
        setDetail(data.item);
        setAssigneeId(data.item.assignedTeacherId ? String(data.item.assignedTeacherId) : '');
        setPriorityId(data.item.priority || '');
      }
      setNotice(data?.notice || '已更新');
      load();
      loadSummary();
      loadTimeline(data?.item?.id || selectedId, { followAll: true });
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
            學生從「我的帳號」送來的問題與建議。回覆學生看得到；內部備註只給可處理的人員看。附件先不開放。
          </p>
        </div>
        <Button variant="outline-primary" size="sm" onClick={() => { load(); loadSummary(); }} disabled={loading}>重新整理</Button>
      </div>
      <section className="mb-3" aria-label="案件統計">
        {summaryLoading && !summary ? (
          <div className="d-flex align-items-center gap-2 text-muted" role="status">
            <Spinner size="sm" animation="border" />
            統計載入中
          </div>
        ) : null}
        {summaryError ? <Alert variant="warning" className="py-2 mb-2">{summaryError}</Alert> : null}
        {summary ? (
          <>
            <div className="row g-2">
              {[
                ['全部問題', summary.total],
                ['待處理', summary.open],
                ['處理中', summary.inProgress],
                ['已結案', summary.closed],
              ].map(([label, value]) => (
                <div className="col-6 col-md-3" key={label}>
                  <div className="border rounded p-2 h-100" style={{ borderColor: 'var(--color-primary)' }}>
                    <div className="small text-muted">{label}</div>
                    <div className="h5 mb-0" style={{ color: 'var(--color-primary-dark)' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="small text-muted mb-0 mt-2">未結案 {summary.unresolved}（待處理與處理中）</p>
          </>
        ) : null}
      </section>
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
        <Form.Select style={{ maxWidth: '12rem' }} aria-label="優先級" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
          <option value="">全部優先級</option>
          <option value="unset">未設定</option>
          {PRIORITIES.filter((item) => item.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
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
        <Form.Select style={{ maxWidth: '10rem' }} aria-label="排序欄位" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
          <option value="createdAt">提交時間</option>
          <option value="updatedAt">更新時間</option>
          <option value="id">案件編號</option>
          <option value="priority">優先級</option>
        </Form.Select>
        <Form.Select style={{ maxWidth: '8rem' }} aria-label="排序方向" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}>
          <option value="desc">新到舊</option>
          <option value="asc">舊到新</option>
        </Form.Select>
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
              <th>編號</th>
              <th>時間</th>
              <th>更新</th>
              <th>狀態</th>
              <th>類型</th>
              <th>項目</th>
              <th>優先級</th>
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
                <td className="text-nowrap">{item.id == null ? '' : `#${item.id}`}</td>
                <td className="text-nowrap">{formatWhen(item.createdAt)}</td>
                <td className="text-nowrap">{formatWhen(item.updatedAt)}</td>
                <td className="text-nowrap">{item.statusLabel}</td>
                <td className="text-nowrap">{item.kindLabel}</td>
                <td className="text-nowrap">{item.categoryLabel}</td>
                <td className="text-nowrap">{item.priorityLabel || '未設定'}</td>
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
          <p className="small mb-2">分類：{detail.categoryLabel} · 優先級：{detail.priorityLabel || '未設定'}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{detail.message}</p>
          {(detail.messages || []).filter((entry) => canManage || entry.visibility === 'public').map((entry) => (
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
          <FeedbackTimeline
            events={timeline}
            total={timelineTotal}
            loading={timelineLoading}
            loadingMore={timelineLoadingMore}
            error={timelineError}
            assignees={assignees}
            onLoadMore={loadMoreTimeline}
          />
          {notice ? <Alert variant="success" className="mt-3 mb-0">{notice}</Alert> : null}
          {actionError ? <Alert variant="danger" className="mt-3 mb-0">{actionError}</Alert> : null}
          {canManage ? (
            <div className="mt-3 d-grid gap-3">
              <Form
                className="d-flex flex-wrap gap-2 align-items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(() => patchAdminStudentFeedback(token, detail.id, {
                    priority: priorityId || null,
                  }));
                }}
              >
                <Form.Group>
                  <Form.Label htmlFor="student-feedback-priority">優先級</Form.Label>
                  <Form.Select
                    id="student-feedback-priority"
                    aria-label="調整優先級"
                    value={priorityId}
                    onChange={(e) => setPriorityId(e.target.value)}
                  >
                    {PRIORITIES.map((item) => <option key={item.id || 'unset'} value={item.id}>{item.label}</option>)}
                  </Form.Select>
                </Form.Group>
                <Button type="submit" size="sm" disabled={busy}>更新優先級</Button>
              </Form>
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
