import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import { getLearningAnalyticsStudentJourney } from '../../services/learningAnalyticsService';
import { studentTrajectoryPath } from '../../utils/learningAnalyticsRecentStudents';

const LANE_LABELS = {
  baseline: '基準',
  exam: '英檢',
  course: '修課',
  activity: '活動',
  other: '其他',
};

export function recordedScore(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function examEventsFromJourney(journey) {
  return (journey?.timeline || []).filter((event) => event?.lane === 'exam');
}

function ScoreCell({ value, missingLabel }) {
  const score = recordedScore(value);
  if (score == null) return missingLabel;
  return String(score);
}

export default function StudentExplorerDetailDrawer({
  studentId,
  token,
  snapshotVersion = '',
  onClose,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const [tab, setTab] = useState('exams');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [journey, setJourney] = useState(null);

  useEffect(() => {
    if (!studentId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setJourney(null);
    setTab('exams');
    getLearningAnalyticsStudentJourney(token, studentId, {
      snapshot_version: snapshotVersion || undefined,
    })
      .then((payload) => {
        if (!cancelled) setJourney(payload || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || '讀取學生軌跡失敗');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, snapshotVersion, token]);

  useEffect(() => {
    const previous = document.activeElement;
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((node) => !node.hasAttribute('disabled'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      try {
        window.scrollTo(0, scrollY);
      } catch {
        // jsdom 沒有實作 scrollTo；瀏覽器會還原關閉前的位置。
      }
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  const exams = useMemo(() => examEventsFromJourney(journey), [journey]);
  const timeline = journey?.timeline || [];
  const student = journey?.student;

  return (
    <>
      <button
        type="button"
        className="la-drawer-backdrop"
        aria-label="關閉學生明細"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className="la-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="學生明細"
      >
        <div className="la-drawer__header">
          <div>
            <p className="la-drawer__kicker">學生明細</p>
            <h2 id="la-drawer-title" className="h5 mb-1">{student?.name || studentId}</h2>
            <p className="small text-muted mb-0">
              <span className="font-monospace">{studentId}</span>
              {student?.department ? ` · ${student.department}` : ''}
              {student?.cohort ? ` · 入學 ${student.cohort}` : ''}
            </p>
          </div>
          <Button ref={closeRef} type="button" size="sm" variant="outline-secondary" onClick={onClose}>
            關閉
          </Button>
        </div>

        {loading ? (
          <div className="py-4 text-center text-muted">
            <Spinner size="sm" className="me-2" />
            讀取既有學生軌跡…
          </div>
        ) : null}
        {error ? <Alert variant="danger">{error}</Alert> : null}

        {!loading && !error && journey ? (
          <>
            <p className="small text-muted mb-2">
              目前測驗紀錄尚未提供 GSE 換算結果，未提供的資料會清楚標示，不會顯示成 0。
            </p>
            <details className="small text-muted mb-3">
              <summary>資料來源</summary>
              <p className="mb-0 mt-1">
                資料版本 {journey.meta?.snapshotVersion || '—'}。這份學生軌跡沒有 GSE，畫面不另做換算。
              </p>
            </details>
            <div className="btn-group btn-group-sm mb-3" role="tablist">
              <button
                type="button"
                className={`btn ${tab === 'exams' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setTab('exams')}
              >
                測驗紀錄
              </button>
              <button
                type="button"
                className={`btn ${tab === 'timeline' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setTab('timeline')}
              >
                學習時間軸
              </button>
            </div>

            {tab === 'exams' ? (
              <div>
                <p className="small">
                  這裡只列出測驗日期、技能、原始分與 CEFR。GSE 換算與前後測對照都尚未提供。
                </p>
                {!exams.length ? <p className="small text-muted">這份快照沒有英檢事件。</p> : null}
                {exams.length ? (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>技能</th>
                          <th>原始分</th>
                          <th>CEFR</th>
                          <th>GSE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exams.map((event) => (
                          <tr key={event.eventId}>
                            <td>{event.eventDate || '—'}</td>
                            <td>{event.skill || event.title || '—'}</td>
                            <td><ScoreCell value={event.rawScore} missingLabel="沒有原始分" /></td>
                            <td>{event.cefrLevel || '沒有 CEFR'}</td>
                            <td>待補</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === 'timeline' ? (
              <div>
                {!timeline.length ? <p className="small text-muted">尚無可顯示事件。</p> : null}
                {timeline.length ? (
                  <ul className="list-unstyled small mb-0">
                    {timeline.map((event) => (
                      <li key={event.eventId} className="border-bottom py-2">
                        <div>{event.eventDate || '日期未提供'} · {LANE_LABELS[event.lane] || event.lane}</div>
                        <div>{event.title || '—'}</div>
                        <div className="text-muted">
                          {event.lane === 'exam'
                            ? <ScoreCell value={event.rawScore} missingLabel="沒有原始分" />
                            : (event.hours != null ? `${event.hours} 小時` : '沒有時數')}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <p className="small mt-3 mb-0">
              <Link to={studentTrajectoryPath(studentId)}>打開完整個人軌跡</Link>
            </p>
          </>
        ) : null}
      </aside>
    </>
  );
}
