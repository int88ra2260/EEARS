import React, { useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';
import { Link } from 'react-router-dom';
import EvidenceQualityBadge from './EvidenceQualityBadge';
import StudentTrajectoryLink from './StudentTrajectoryLink';
import { EVIDENCE_QUALITY_OPTIONS } from './learningAnalyticsFilterConstants';
import { EVIDENCE_LEVEL_LABELS } from './learningAnalyticsCopy';
import ColumnHead, { HEAD } from './ColumnHead';

const SORT_OPTIONS = [
  { value: 'examDate', label: '後測日期' },
  { value: 'rawGrowth', label: '這份測驗多幾分' },
  { value: 'peerPercentile', label: '跟同樣起點比' },
  { value: 'adjustedGseGrowth', label: '比預期多多少' },
  { value: 'resourceHours', label: '後測前的時數' },
  { value: 'studentId', label: '學號' },
  { value: 'skill', label: '技能' },
];

function PeerComparison({ episode }) {
  if (!episode?.pretestBandLabel) {
    return <span className="text-muted">沒有前測區間</span>;
  }
  if (!episode.peerInterpretable || episode.peerPercentile == null) {
    return (
      <span className="la-peer-compare text-muted" title="同一科、同一前測區間要至少 5 人才比較">
        <span>{`前測 ${episode.pretestBandLabel}`}</span>
        <span>這組不到 5 人</span>
      </span>
    );
  }
  const gap = Number(episode.peerGapFromMedian);
  let pace = '跟這組正中間差不多';
  if (Number.isFinite(gap) && gap >= 1) pace = `比這組正中間多 ${gap.toFixed(1)}`;
  if (Number.isFinite(gap) && gap <= -1) pace = `比這組正中間少 ${Math.abs(gap).toFixed(1)}`;
  const beatenText = episode.peerPercentile === 0
    ? '沒有比過這組其他人'
    : `比過這組 ${episode.peerPercentile}% 的人`;
  return (
    <span
      className="la-peer-compare"
      title="跟同一科、前測落在同一區間的其他人比。比過的人愈多，代表在起點相近的人裡面進步較快。"
    >
      <span>{`前測 ${episode.pretestBandLabel}`}</span>
      <strong>{beatenText}</strong>
      <span className="text-muted">{pace}</span>
    </span>
  );
}

function formatHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

function episodeResourceHours(episode) {
  const exposure = episode?.timeWindow || {};
  const hours = exposure.resourceHoursBeforeExam ?? episode?.exposureBeforeExam?.resourceHours;
  const n = Number(hours);
  return Number.isFinite(n) ? n : null;
}

function compareNullableNumber(a, b) {
  const aOk = Number.isFinite(a);
  const bOk = Number.isFinite(b);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return a - b;
}

function compareNullableString(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'zh-Hant', { sensitivity: 'base' });
}

function buildUniqueOptions(episodes, getValue, getLabel) {
  const seen = new Map();
  for (const episode of episodes) {
    const value = getValue(episode);
    if (value == null || value === '') continue;
    const key = String(value);
    if (!seen.has(key)) {
      seen.set(key, getLabel ? getLabel(episode, key) : key);
    }
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => compareNullableString(a.label, b.label));
}

function sortEpisodes(list, sortKey, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'rawGrowth') {
      cmp = compareNullableNumber(Number(a.rawGrowth), Number(b.rawGrowth));
    } else if (sortKey === 'peerPercentile') {
      cmp = compareNullableNumber(Number(a.peerPercentile), Number(b.peerPercentile));
    } else if (sortKey === 'adjustedGseGrowth') {
      cmp = compareNullableNumber(Number(a.adjustedGseGrowth), Number(b.adjustedGseGrowth));
    } else if (sortKey === 'resourceHours') {
      cmp = compareNullableNumber(episodeResourceHours(a), episodeResourceHours(b));
    } else if (sortKey === 'studentId') {
      cmp = compareNullableString(a.studentId, b.studentId);
    } else if (sortKey === 'skill') {
      cmp = compareNullableString(a.skillLabel || a.skill, b.skillLabel || b.skill);
    } else {
      cmp = compareNullableString(a.examDate, b.examDate);
    }
    if (cmp !== 0) return cmp * dir;
    return compareNullableString(a.studentId, b.studentId);
  });
}

export default function GrowthEpisodeTable({ episodes = [], focusRequest = null, onScopeChange = null }) {
  const [studentQuery, setStudentQuery] = useState('');
  const [skill, setSkill] = useState('');
  const [instrument, setInstrument] = useState('');
  const [evidenceQuality, setEvidenceQuality] = useState('');
  const [improvedOnly, setImprovedOnly] = useState(false);
  const [sortKey, setSortKey] = useState('examDate');
  const [sortDir, setSortDir] = useState('desc');
  const [focusHint, setFocusHint] = useState('');

  useEffect(() => {
    if (!focusRequest?.token) return;
    setStudentQuery('');
    setInstrument('');
    setEvidenceQuality('');
    setSkill(focusRequest.skill || '');
    setImprovedOnly(Boolean(focusRequest.improvedOnly));
    setSortKey(focusRequest.sortKey || 'rawGrowth');
    setSortDir(focusRequest.sortDir || 'desc');
    setFocusHint(
      focusRequest.improvedOnly && focusRequest.skillLabel
        ? `已篩選「${focusRequest.skillLabel}」裡 GSE 有進步的明細，並依原始分進步由高到低排列。`
        : focusRequest.skillLabel
          ? `已篩選「${focusRequest.skillLabel}」，並依原始分進步由高到低排列（進步最多 → 退步最多）。`
          : '已依原始分進步由高到低排列（進步最多 → 退步最多）。',
    );
  }, [focusRequest]);

  const skillOptions = useMemo(
    () => buildUniqueOptions(
      episodes,
      (ep) => ep.skill,
      (ep, key) => ep.skillLabel || key,
    ),
    [episodes],
  );

  const instrumentOptions = useMemo(
    () => buildUniqueOptions(episodes, (ep) => ep.instrument),
    [episodes],
  );

  const evidenceOptions = useMemo(() => {
    const present = new Set(
      episodes.map((ep) => String(ep.evidenceQuality || '').toLowerCase()).filter(Boolean),
    );
    const known = EVIDENCE_QUALITY_OPTIONS.filter((opt) => !opt.value || present.has(opt.value));
    const extras = [...present]
      .filter((level) => !EVIDENCE_QUALITY_OPTIONS.some((opt) => opt.value === level))
      .map((level) => ({
        value: level,
        label: EVIDENCE_LEVEL_LABELS[level] || level,
      }));
    return [...known, ...extras];
  }, [episodes]);

  const filteredEpisodes = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return episodes.filter((episode) => {
      if (q && !String(episode.studentId || '').toLowerCase().includes(q)) return false;
      if (skill && String(episode.skill) !== skill) return false;
      if (instrument && String(episode.instrument) !== instrument) return false;
      if (improvedOnly && !(Number(episode.actualGseGrowth) > 0)) return false;
      if (evidenceQuality) {
        const level = String(episode.evidenceQuality || '').toLowerCase();
        if (level !== evidenceQuality) return false;
      }
      return true;
    });
  }, [episodes, studentQuery, skill, instrument, evidenceQuality, improvedOnly]);

  const visibleEpisodes = useMemo(
    () => sortEpisodes(filteredEpisodes, sortKey, sortDir),
    [filteredEpisodes, sortKey, sortDir],
  );

  const hasActiveControls = Boolean(
    studentQuery.trim() || skill || instrument || evidenceQuality || improvedOnly
    || sortKey !== 'examDate' || sortDir !== 'desc',
  );

  const resetControls = () => {
    setStudentQuery('');
    setSkill('');
    setInstrument('');
    setEvidenceQuality('');
    setImprovedOnly(false);
    setSortKey('examDate');
    setSortDir('desc');
    setFocusHint('');
  };

  useEffect(() => {
    if (!onScopeChange) return;
    const ids = [];
    const seen = new Set();
    for (const episode of visibleEpisodes) {
      const id = String(episode.studentId || '').trim().toUpperCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    onScopeChange({
      skill,
      improvedOnly,
      narrowed: Boolean(studentQuery.trim() || instrument || evidenceQuality),
      studentIds: ids,
      episodeCount: visibleEpisodes.length,
    });
  }, [evidenceQuality, improvedOnly, instrument, onScopeChange, skill, studentQuery, visibleEpisodes]);

  if (!episodes.length) {
    return (
      <p className="small text-muted mb-0">
        目前沒有前後測進步明細。請確認資料已重建，且學生有兩次以上英檢成績。
      </p>
    );
  }

  return (
    <div>
      <div className="la-episode-toolbar border rounded p-2 bg-light mb-2">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md-3 col-xl-2">
            <Form.Group className="mb-0">
              <Form.Label className="small text-muted mb-1">學號</Form.Label>
              <Form.Control
                size="sm"
                value={studentQuery}
                onChange={(e) => {
                  setStudentQuery(e.target.value);
                  setFocusHint('');
                }}
                placeholder="搜尋學號"
                aria-label="依學號篩選"
              />
            </Form.Group>
          </div>
          <div className="col-6 col-md-3 col-xl-2">
            <Form.Group className="mb-0">
              <Form.Label className="small text-muted mb-1">技能</Form.Label>
              <Form.Select
                size="sm"
                value={skill}
                onChange={(e) => {
                  setSkill(e.target.value);
                  setFocusHint('');
                }}
                aria-label="依技能篩選"
              >
                <option value="">全部</option>
                {skillOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>
          <div className="col-6 col-md-3 col-xl-2">
            <Form.Group className="mb-0">
              <Form.Label className="small text-muted mb-1">工具</Form.Label>
              <Form.Select
                size="sm"
                value={instrument}
                onChange={(e) => {
                  setInstrument(e.target.value);
                  setFocusHint('');
                }}
                aria-label="依工具篩選"
              >
                <option value="">全部</option>
                {instrumentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>
          <div className="col-6 col-md-3 col-xl-2">
            <Form.Group className="mb-0">
              <Form.Label className="small text-muted mb-1">資料品質</Form.Label>
              <Form.Select
                size="sm"
                value={evidenceQuality}
                onChange={(e) => {
                  setEvidenceQuality(e.target.value);
                  setFocusHint('');
                }}
                aria-label="依資料品質篩選"
              >
                {evidenceOptions.map((opt) => (
                  <option key={opt.value || '__all__'} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <Form.Group className="mb-0">
              <Form.Label className="small text-muted mb-1">排序</Form.Label>
              <Form.Select
                size="sm"
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value);
                  setFocusHint('');
                }}
                aria-label="排序欄位"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                  setFocusHint('');
                }}
                aria-label={sortDir === 'asc' ? '目前由小到大，點擊改為由大到小' : '目前由大到小，點擊改為由小到大'}
              >
                {sortDir === 'asc' ? '由小到大' : '由大到小'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={resetControls}
                disabled={!hasActiveControls}
              >
                重設
              </button>
            </div>
          </div>
        </div>
        <Form.Check
          type="checkbox"
          id="la-episode-improved-only"
          className="small mt-2 mb-0"
          label="只看 GSE 有進步"
          checked={improvedOnly}
          onChange={(event) => {
            setImprovedOnly(event.target.checked);
            setFocusHint('');
          }}
        />
        <div className="small text-muted mt-2">
          顯示 {visibleEpisodes.length} / {episodes.length} 筆
          {visibleEpisodes.length !== episodes.length ? '（已套用表格篩選）' : null}
        </div>
        {focusHint ? <div className="small text-primary mt-1">{focusHint}</div> : null}
      </div>

      {!visibleEpisodes.length ? (
        <p className="small text-muted mb-0">目前條件下沒有符合的前後測明細，請調整篩選後再試。</p>
      ) : (
        <div className="table-responsive">
          <Table size="sm" hover className="la-episode-table mb-0">
            <thead>
              <tr>
                <th>學號</th>
                <th>技能</th>
                <th><ColumnHead {...HEAD.instrument} /></th>
                <th>後測日期</th>
                <th className="text-end"><ColumnHead {...HEAD.rawGain} /></th>
                <th><ColumnHead {...HEAD.sameStart} /></th>
                <th className="text-end"><ColumnHead {...HEAD.beyondExpected} /></th>
                <th className="text-end"><ColumnHead {...HEAD.hoursBeforeExam} /></th>
                <th><ColumnHead {...HEAD.evidence} /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleEpisodes.map((episode) => {
                const key = `${episode.studentId}-${episode.skill}-${episode.instrument}-${episode.examDate}`;
                const exposure = episode.timeWindow || {};
                const resourceHours = episodeResourceHours(episode);
                return (
                  <tr key={key}>
                    <td>
                      <StudentTrajectoryLink studentId={episode.studentId} />
                    </td>
                    <td>{episode.skillLabel || episode.skill}</td>
                    <td>{episode.instrument}</td>
                    <td>{episode.examDate || '—'}</td>
                    <td className="text-end">{episode.rawGrowth ?? '—'}</td>
                    <td><PeerComparison episode={episode} /></td>
                    <td className="text-end">{episode.adjustedGseGrowth ?? '—'}</td>
                    <td
                      className="text-end"
                      title={`課程 ${formatHours(exposure.courseHoursBeforeExam)} / 活動 ${formatHours(exposure.activityHoursBeforeExam)}`}
                    >
                      {formatHours(resourceHours)}
                    </td>
                    <td>
                      <EvidenceQualityBadge level={episode.evidenceQuality} />
                    </td>
                    <td>
                      <StudentTrajectoryLink studentId={episode.studentId} className="small me-2">
                        軌跡
                      </StudentTrajectoryLink>
                      <Link
                        to={`/admin/learning-analytics/skills/${encodeURIComponent(episode.studentId)}`}
                        className="small"
                      >
                        技能
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
