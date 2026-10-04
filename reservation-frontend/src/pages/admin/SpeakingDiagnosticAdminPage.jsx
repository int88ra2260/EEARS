import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import {
  downloadSpeakingDiagnosticResearchCsv,
  fetchSpeakingDiagnosticAttempts,
  fetchSpeakingDiagnosticResearchSummary,
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

function formatDecimal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return n.toFixed(2);
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
  const [ratingStatus, setRatingStatus] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
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
      const [data, summaryData] = await Promise.all([
        fetchSpeakingDiagnosticAttempts(token, { limit: 100, studentId, ratingStatus }),
        fetchSpeakingDiagnosticResearchSummary(token, { limit: 1000 }),
      ]);
      setAttempts(Array.isArray(data) ? data : []);
      setSummary(summaryData || null);
      setSelectedUid((prev) => (data || []).some((row) => row.attemptUid === prev) ? prev : data?.[0]?.attemptUid || '');
    } catch (err) {
      setAttempts([]);
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [studentId, ratingStatus, token]);

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

  const exportCsv = async () => {
    setExporting(true);
    setError('');
    setMessage('');
    try {
      const blob = await downloadSpeakingDiagnosticResearchCsv(token, { ratingStatus });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `speaking-diagnostic-research-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('已下載研究資料 CSV');
    } catch (err) {
      setError(err.message || '下載失敗');
    } finally {
      setExporting(false);
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
          <select
            className="form-select"
            value={ratingStatus}
            onChange={(event) => setRatingStatus(event.target.value)}
            aria-label="評分狀態"
          >
            <option value="">全部評分狀態</option>
            <option value="unrated">待評</option>
            <option value="single_rated">已單評</option>
            <option value="double_rated">已雙評</option>
          </select>
          <button className="btn btn-outline-primary" type="button" onClick={load} disabled={loading}>
            查詢
          </button>
          <button className="btn btn-outline-success" type="button" onClick={exportCsv} disabled={exporting}>
            {exporting ? '匯出中...' : '匯出 CSV'}
          </button>
        </div>
      </div>

      {summary ? (
        <section className="sd-admin-summary">
          <div><strong>{summary.sample?.attempts ?? 0}</strong><span>attempts</span></div>
          <div><strong>{summary.sample?.students ?? 0}</strong><span>students</span></div>
          <div><strong>{summary.sample?.ratingStatusCounts?.unrated ?? 0}</strong><span>待評</span></div>
          <div><strong>{summary.sample?.ratingStatusCounts?.double_rated ?? 0}</strong><span>已雙評</span></div>
          <div><strong>{formatDecimal(summary.reliability?.byField?.fluency?.adjacentAgreement)}</strong><span>fluency adjacent</span></div>
          <div><strong>{formatDecimal(summary.featureCorrelations?.fluencyPercent?.pearsonR)}</strong><span>feature-human r</span></div>
        </section>
      ) : null}

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
                  <small>{attempt.studentId || 'anonymous'} · {formatDate(attempt.submittedAt)} · {attempt.ratingCount || 0} rating(s)</small>
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
                  <div className="sd-admin-rating-status">
                    {selected.ratingStatus === 'double_rated' ? '已雙評' : selected.ratingStatus === 'single_rated' ? '已單評，建議補第二位老師' : '待老師評分'}
                  </div>
                </div>
                <div className="sd-admin-big-score">
                  <strong>{formatPercent(scores.overallPercent)}</strong>
                  <span>overall</span>
                </div>
              </div>

              <div className="sd-admin-scores">
                <ScorePill label="Completion" value={scores.completionPercent} />
                <ScorePill label="Pronunciation" value={scores.pronunciationPercent} />
                <ScorePill label="Fluency" value={scores.fluencyPercent} />
                <ScorePill label="Pace" value={scores.pacePercent} />
                <ScorePill label="Pause control" value={scores.pauseControlPercent} />
                <ScorePill label="Task achievement" value={scores.taskAchievementPercent} />
                <ScorePill label="Idea development" value={scores.ideaDevelopmentPercent} />
              </div>

              <audio className="sd-admin-audio" controls src={mediaUrl(selected.audioUrl)}>
                <track kind="captions" />
              </audio>

              <div className="sd-admin-evidence-table">
                <div><span>Speech WPM</span><strong>{formatNumber(selected.features?.speechRateWpm)}</strong></div>
                <div><span>Articulation WPM</span><strong>{formatNumber(selected.features?.articulationRateWpm)}</strong></div>
                <div><span>Pause count</span><strong>{selected.features?.pauseCount ?? '--'}</strong></div>
                <div><span>Avg pause</span><strong>{formatNumber((selected.features?.averagePauseDurationMs || 0) / 1000)}s</strong></div>
                <div><span>Word acoustic</span><strong>{formatDecimal(selected.features?.wordAcousticEvidence?.summary?.averageWordAcousticScore)}</strong></div>
                <div><span>Low-conf words</span><strong>{selected.features?.wordAcousticEvidence?.summary?.lowConfidenceCount ?? '--'}</strong></div>
                <div><span>Phones</span><strong>{selected.features?.phonemeEvidence?.summary?.phoneCount ?? '--'}</strong></div>
                <div><span>Phone confidence</span><strong>{formatDecimal(selected.features?.phonemeEvidence?.summary?.averagePhoneConfidence)}</strong></div>
                <div><span>Lexical diversity</span><strong>{formatNumber(selected.features?.transcriptEvidence?.lexicalDiversity)}</strong></div>
                <div><span>Sophistication</span><strong>{formatNumber(selected.features?.transcriptEvidence?.lexicalSophistication)}</strong></div>
                <div><span>Fillers</span><strong>{selected.features?.transcriptEvidence?.fillerCount ?? 0}</strong></div>
                <div><span>Repetitions</span><strong>{selected.features?.transcriptEvidence?.repetitionCount ?? 0}</strong></div>
                <div><span>Task relevance</span><strong>{formatDecimal(selected.features?.constructedResponseEvidence?.taskRelevanceProxy)}</strong></div>
                <div><span>Idea development</span><strong>{formatDecimal(selected.features?.constructedResponseEvidence?.ideaDevelopmentProxy)}</strong></div>
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

