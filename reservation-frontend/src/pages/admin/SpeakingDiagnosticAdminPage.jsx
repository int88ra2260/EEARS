import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import {
  fetchSpeakingDiagnosticAttempts,
  saveSpeakingDiagnosticRating,
} from '../../services/speakingDiagnosticApi';
import '../SpeakingDiagnosticPage.css';
import './SpeakingDiagnosticAdminPage.css';

const RUBRIC_FIELDS = [
  ['fluency', 'Fluency'],
  ['pronunciationIntelligibility', 'Pronunciation / intelligibility'],
  ['grammar', 'Grammar'],
  ['vocabulary', 'Vocabulary'],
  ['taskAchievement', 'Task achievement'],
];

function formatDate(value) {
  if (!value) return '--';
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return `${Math.round(n)}%`;
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function mediaUrl(url) {
  if (!url) return '';
  if (!url.startsWith('/')) return url;
  if (window.location.port === '3001' && url.startsWith('/uploads')) {
    return `http://localhost:3000${url}`;
  }
  return url;
}

function ScorePill({ label, value }) {
  return (
    <div className="sd-admin-score-pill">
      <strong>{formatPercent(value)}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function SpeakingDiagnosticAdminPage() {
  const token = localStorage.getItem('token') || '';
  const [attempts, setAttempts] = useState([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState({
    fluency: '',
    pronunciationIntelligibility: '',
    grammar: '',
    vocabulary: '',
    taskAchievement: '',
    comments: '',
  });

  const selected = useMemo(
    () => attempts.find((item) => item.attemptUid === selectedUid) || attempts[0] || null,
    [attempts, selectedUid],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSpeakingDiagnosticAttempts(token, { limit: 50, studentId });
      setAttempts(Array.isArray(data) ? data : []);
      setSelectedUid((prev) => (data || []).some((row) => row.attemptUid === prev) ? prev : data?.[0]?.attemptUid || '');
    } catch (err) {
      setAttempts([]);
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const existing = selected?.humanRatings?.[0];
    setRating({
      fluency: existing?.fluency || '',
      pronunciationIntelligibility: existing?.pronunciationIntelligibility || '',
      grammar: existing?.grammar || '',
      vocabulary: existing?.vocabulary || '',
      taskAchievement: existing?.taskAchievement || '',
      comments: existing?.comments || '',
    });
  }, [selected?.attemptUid, selected?.humanRatings]);

  const saveRating = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveSpeakingDiagnosticRating(token, selected.attemptUid, rating);
      setMessage('已儲存老師評分');
      await load();
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const scores = selected?.presentationScores || selected?.automatedScores?.presentationScores || {};
  const wordResults = selected?.wordResults || selected?.features?.wordResults || [];

  return (
    <div className="sd-admin-page">
      <div className="sd-admin-header">
        <div>
          <h1>口說診斷紀錄</h1>
          <p>查看 read-aloud attempts、機器 evidence，並依 A2-B2 analytical rubric 進行人評校準。</p>
        </div>
        <div className="sd-admin-filter">
          <input
            className="form-control"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="依學號篩選"
          />
          <button className="btn btn-outline-primary" type="button" onClick={load} disabled={loading}>
            查詢
          </button>
        </div>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <div className="sd-admin-layout">
        <aside className="sd-admin-list">
          {loading ? (
            <div className="text-center py-4"><Spinner animation="border" size="sm" /> 載入中</div>
          ) : null}
          {!loading && attempts.length === 0 ? (
            <div className="text-muted small p-3">尚無口說診斷紀錄。學生送出錄音後會出現在這裡。</div>
          ) : null}
          {attempts.map((attempt) => {
            const active = attempt.attemptUid === selected?.attemptUid;
            const attemptScores = attempt.presentationScores || attempt.automatedScores?.presentationScores || {};
            return (
              <button
                type="button"
                key={attempt.attemptUid}
                className={`sd-admin-attempt${active ? ' sd-admin-attempt--active' : ''}`}
                onClick={() => setSelectedUid(attempt.attemptUid)}
              >
                <span className="sd-admin-attempt__score">{formatPercent(attemptScores.overallPercent)}</span>
                <span>
                  <strong>{attempt.task?.title || 'Untitled task'}</strong>
                  <small>{attempt.studentId || 'anonymous'} · {formatDate(attempt.submittedAt)}</small>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="sd-admin-detail">
          {!selected ? (
            <div className="text-muted p-4">請選擇一筆紀錄。</div>
          ) : (
            <>
              <div className="sd-admin-detail__top">
                <div>
                  <div className="sd-admin-kicker">{selected.task?.level} · {selected.task?.taskType}</div>
                  <h2>{selected.task?.title}</h2>
                  <p>{selected.task?.targetText}</p>
                </div>
                <div className="sd-admin-big-score">
                  <strong>{formatPercent(scores.overallPercent)}</strong>
                  <span>overall</span>
                </div>
              </div>

              <div className="sd-admin-scores">
                <ScorePill label="Completion" value={scores.completionPercent} />
                <ScorePill label="Fluency" value={scores.fluencyPercent} />
                <ScorePill label="Pace" value={scores.pacePercent} />
                <ScorePill label="Pause control" value={scores.pauseControlPercent} />
              </div>

              <audio className="sd-admin-audio" controls src={mediaUrl(selected.audioUrl)}>
                <track kind="captions" />
              </audio>

              <div className="sd-admin-evidence-table">
                <div><span>Speech WPM</span><strong>{formatNumber(selected.features?.speechRateWpm)}</strong></div>
                <div><span>Articulation WPM</span><strong>{formatNumber(selected.features?.articulationRateWpm)}</strong></div>
                <div><span>Pause count</span><strong>{selected.features?.pauseCount ?? '--'}</strong></div>
                <div><span>Avg pause</span><strong>{formatNumber((selected.features?.averagePauseDurationMs || 0) / 1000)}s</strong></div>
              </div>

              <div className="sd-admin-wordline">
                {wordResults.map((word) => (
                  <span
                    key={`${word.index}-${word.word}`}
                    className={`speaking-word speaking-word--${word.status}`}
                  >
                    {word.word}
                  </span>
                ))}
              </div>

              <div className="sd-admin-rating">
                <h3>老師 rubric 評分</h3>
                <div className="sd-admin-rating-grid">
                  {RUBRIC_FIELDS.map(([key, label]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <select
                        className="form-select"
                        value={rating[key]}
                        onChange={(event) => setRating((prev) => ({ ...prev, [key]: event.target.value }))}
                      >
                        <option value="">未評</option>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="sd-admin-comments">
                  <span>Comments</span>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={rating.comments}
                    onChange={(event) => setRating((prev) => ({ ...prev, comments: event.target.value }))}
                    placeholder="記錄發音、流利度、文法或後續教學建議"
                  />
                </label>
                <button className="btn btn-primary" type="button" onClick={saveRating} disabled={saving}>
                  {saving ? '儲存中...' : '儲存評分'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

