import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchMyStudentFeedback,
  fetchMyStudentFeedbackDetail,
  postMyStudentFeedbackMessage,
} from '../../services/studentFeedbackApi';

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

export default function StudentFeedbackHistory() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [followUp, setFollowUp] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await fetchMyStudentFeedback(page);
      if (!ok) {
        setError(data?.message || '無法載入你的回報');
        setItems([]);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total) || 0);
    } catch {
      setError('與伺服器連線發生錯誤');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const openCase = async (id) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    setFollowUp('');
    setError('');
    try {
      const { ok, data } = await fetchMyStudentFeedbackDetail(id);
      if (!ok) {
        setError(data?.message || '無法載入這筆回報');
        return;
      }
      setDetail(data?.item || null);
    } catch {
      setError('與伺服器連線發生錯誤');
    }
  };

  const sendFollowUp = async (event) => {
    event.preventDefault();
    if (!openId) return;
    setSending(true);
    setError('');
    try {
      const { ok, data } = await postMyStudentFeedbackMessage(openId, followUp);
      if (!ok) {
        setError(data?.message || '送出失敗，請稍後再試');
        return;
      }
      setDetail(data?.item || null);
      setFollowUp('');
      load();
    } catch {
      setError('與伺服器連線發生錯誤');
    } finally {
      setSending(false);
    }
  };

  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="student-feedback__history mt-4">
      <h3 className="h6">我送出的</h3>
      {loading ? <p className="text-muted small mb-0">載入中</p> : null}
      {error ? <p className="text-danger small" role="alert">{error}</p> : null}
      {!loading && items.length === 0 ? <p className="text-muted small mb-0">你還沒有送出過問題或建議。</p> : null}
      <div className="student-feedback__thread">
        {items.map((item) => (
          <article key={item.id} className="student-feedback__case">
            <button type="button" className="student-feedback__case-toggle" onClick={() => openCase(item.id)}>
              <span>{formatWhen(item.createdAt)}</span>
              <span>{item.kindLabel}</span>
              <span>{item.statusLabel}</span>
            </button>
            <p className="small mb-0">{item.categoryLabel}{item.replyRequested ? '' : ' · 不要求個別回覆'}</p>
            {openId === item.id && detail ? (
              <div className="mt-2">
                <p className="mb-2" style={{ whiteSpace: 'pre-wrap' }}>{detail.message}</p>
                {(detail.messages || []).map((entry) => (
                  <div key={entry.id} className="student-feedback__entry">
                    <p className="small text-muted mb-1">{entry.authorLabel} · {formatWhen(entry.createdAt)}</p>
                    <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{entry.body}</p>
                  </div>
                ))}
                <form className="mt-3" onSubmit={sendFollowUp}>
                  <label className="form-label" htmlFor={`student-feedback-follow-${item.id}`}>補充說明</label>
                  <textarea
                    id={`student-feedback-follow-${item.id}`}
                    className="form-control mb-2"
                    rows={3}
                    value={followUp}
                    maxLength={2000}
                    onChange={(e) => setFollowUp(e.target.value)}
                    required
                  />
                  <button className="btn btn-outline-primary btn-sm" type="submit" disabled={sending}>
                    {sending ? '送出中…' : '補充'}
                  </button>
                </form>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {pages > 1 ? (
        <div className="d-flex gap-2 mt-3">
          <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一頁</button>
          <span className="small align-self-center">{page} / {pages}</span>
          <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>下一頁</button>
        </div>
      ) : null}
    </div>
  );
}
