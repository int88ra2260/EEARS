import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import { getLearningAnalyticsStudentJourney } from '../../services/learningAnalyticsService';
import { studentTrajectoryPath } from '../../utils/learningAnalyticsRecentStudents';
import { formatMeasure, formatSignedMeasure } from './ExamPhaseScore';

const LANE_LABELS = {
  baseline: '基準',
  exam: '英檢',
  course: '修課',
  activity: '活動',
  other: '其他',
};

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

function RawScoreText({ cell }) {
  if (!cell) return '—';
  if (cell.invalidScore) return '無效分';
  const score = recordedScore(cell.rawScore);
  if (score == null) return '沒有原始分';
  return formatMeasure(score);
}

function GseText({ cell }) {
  if (!cell || cell.gse == null) {
    if (cell && !cell.invalidScore && recordedScore(cell.rawScore) != null) return '無法換算';
    return '—';
  }
  return formatMeasure(cell.gse);
}

function CefrText({ cell }) {
  if (!cell) return '—';
  return cell.cefr || '沒有 CEFR';
}

function rawDeltaText(row) {
  if (row?.rawDelta != null) return formatSignedMeasure(row.rawDelta);
  const preScore = recordedScore(row?.pre?.rawScore);
  const postScore = recordedScore(row?.post?.rawScore);
  if (row?.pre && row?.post && preScore != null && postScore != null && !row.pre.invalidScore && !row.post.invalidScore && !row.sameInstrument) {
    return '不同測驗';
  }
  return '—';
}

export function recordedScore(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

  const timeline = journey?.timeline || [];
  const student = journey?.student;
  const prePost = journey?.prePost;
  const skillRows = prePost?.skills || [];

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
              沒有成績會顯示 —。0 與 1 分是無效分，不會換算成 GSE，也不會顯示成 0。
            </p>
            <details className="small text-muted mb-3">
              <summary>資料來源</summary>
              <p className="mb-0 mt-1">
                資料版本 {journey.meta?.snapshotVersion || '—'}。GSE 用既有英檢對照，從原始分換算。
              </p>
            </details>
            <div className="btn-group btn-group-sm mb-3" role="tablist">
              <button
                type="button"
                className={`btn ${tab === 'exams' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setTab('exams')}
              >
                GSE 與前後測
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
                  前測是第一梯有效英檢（含只有一次），後測是第二梯。CEFR 是測驗紀錄上的等級。GSE 用來比較；同一份英檢才把原始分相減。這是觀察到的差異。
                </p>
                {!skillRows.length ? <p className="small text-muted">這份快照沒有英檢前後測。</p> : null}
                {skillRows.length ? (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>技能</th>
                          <th>前測原始分</th>
                          <th>前測 CEFR</th>
                          <th>前測 GSE</th>
                          <th>後測原始分</th>
                          <th>後測 CEFR</th>
                          <th>後測 GSE</th>
                          <th>原始分差</th>
                          <th>GSE 差</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skillRows.map((row) => (
                          <tr key={row.skill}>
                            <td>{SKILL_LABELS[row.skill] || row.skill}</td>
                            <td><RawScoreText cell={row.pre} /></td>
                            <td><CefrText cell={row.pre} /></td>
                            <td><GseText cell={row.pre} /></td>
                            <td><RawScoreText cell={row.post} /></td>
                            <td><CefrText cell={row.post} /></td>
                            <td><GseText cell={row.post} /></td>
                            <td>{rawDeltaText(row)}</td>
                            <td>{row.gseDelta != null ? formatSignedMeasure(row.gseDelta) : '—'}</td>
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
                          {event.lane === 'exam' ? (
                            <>
                              {event.invalidScore ? '無效分' : <ScoreCell value={event.rawScore} missingLabel="沒有原始分" />}
                              {' · '}
                              {event.cefrLevel || '沒有 CEFR'}
                              {' · '}
                              {event.gse != null
                                ? `GSE ${formatMeasure(event.gse)}`
                                : (event.invalidScore || recordedScore(event.rawScore) == null ? '沒有 GSE' : 'GSE 無法換算')}
                            </>
                          ) : (event.hours != null ? `${event.hours} 小時` : '沒有時數')}
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
