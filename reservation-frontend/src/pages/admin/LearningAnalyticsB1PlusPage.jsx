import React, { useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { Link } from 'react-router-dom';
import {
  getLearningAnalyticsB1Plus,
  getLearningAnalyticsMeta,
} from '../../services/learningAnalyticsService';
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import ColumnHead, { HEAD } from '../../components/learningAnalytics/ColumnHead';
import LearningAnalyticsNextSteps from '../../components/learningAnalytics/LearningAnalyticsNextSteps';
import LearningAnalyticsStatus from '../../components/learningAnalytics/LearningAnalyticsStatus';
import MetricCard from '../../components/learningAnalytics/MetricCard';
import { formatCount, formatHours, formatRate } from '../../components/learningAnalytics/learningAnalyticsFormat';
import { pushRecentStudent, studentTrajectoryPath } from '../../utils/learningAnalyticsRecentStudents';
import { useLearningAnalyticsWorkingSet } from '../../utils/learningAnalyticsWorkingSet';

const PAGE_SIZE = 40;

const EMPTY_FILTERS = Object.freeze({
  snapshot_version: '',
  department: '',
  college: '',
  cohort: '',
  engagement: 'any',
  has_pretest: 'any',
  weak_pretest_skill: '',
  keyword: '',
});

const ENGAGEMENT_OPTIONS = [
  { value: 'any', label: '全部接近 B2', countKey: 'matched' },
  { value: 'neither', label: '尚未修課，也尚未參加活動', countKey: 'neither' },
  { value: 'course_only', label: '有修課，尚未參加活動', countKey: 'courseOnly' },
  { value: 'activity_only', label: '有活動，尚未修課', countKey: 'activityOnly' },
  { value: 'both', label: '已有修課與活動', countKey: 'both' },
];

const PRETEST_OPTIONS = [
  { value: 'any', label: '不限' },
  { value: 'yes', label: '有前測，可看落點' },
  { value: 'no', label: '還沒有前測' },
];

const WEAK_SKILL_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'listening', label: '聽力前測 GSE 還不到 51' },
  { value: 'reading', label: '閱讀前測 GSE 還不到 51' },
  { value: 'speaking', label: '口說前測 GSE 還不到 51' },
  { value: 'writing', label: '寫作前測 GSE 還不到 51' },
];

const SITUATION_LABELS = {
  neither: '尚未修課，也尚未參加活動',
  course_only: '有修課，尚未參加活動',
  activity_only: '有活動，尚未修課',
  both: '已有修課與活動，仍未達 B2',
};

const SKILL_COLUMNS = [
  ['listening', '聽力前測'],
  ['reading', '閱讀前測'],
  ['speaking', '口說前測'],
  ['writing', '寫作前測'],
];

function pretestCell(row, skill) {
  const band = row.pretest?.[skill];
  const gse = row.pretestGse?.[skill];
  if (!band && gse == null) return '—';
  if (band && gse != null) return `${band}（${gse}）`;
  return band || String(gse);
}

function snapshotLabel(snapshot) {
  if (!snapshot) return '';
  return snapshot.label || snapshot.version || snapshot.snapshotVersion || '';
}

export default function LearningAnalyticsB1PlusPage() {
  const token = localStorage.getItem('token') || '';
  const [draft, setDraft] = useState({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const { active: workingSetActive, withWorkingSet } = useLearningAnalyticsWorkingSet();

  useEffect(() => {
    let cancelled = false;
    getLearningAnalyticsMeta(token)
      .then((payload) => {
        if (cancelled) return;
        setMeta(payload);
        const recommended = payload?.recommendedSnapshotVersion || '';
        if (!recommended) return;
        setDraft((current) => (current.snapshot_version ? current : { ...current, snapshot_version: recommended }));
        setApplied((current) => (current.snapshot_version ? current : { ...current, snapshot_version: recommended }));
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const queryKey = JSON.stringify(applied);

  useEffect(() => {
    if (!applied.snapshot_version && meta && !meta.recommendedSnapshotVersion) {
      setLoading(false);
      return undefined;
    }
    if (!applied.snapshot_version) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');
    getLearningAnalyticsB1Plus(token, withWorkingSet({ ...applied, limit: PAGE_SIZE, offset }))
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null);
          setError(err.message || '接近 B2 追蹤名單取得失敗。');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, queryKey, offset, applied, withWorkingSet, meta]);

  const summary = data?.summary;
  const total = data?.pagination?.total ?? 0;
  const matched = summary?.matched ?? 0;
  const options = data?.options || { departments: [], colleges: [], cohorts: [] };
  const snapshots = meta?.snapshots || [];

  const chips = useMemo(() => {
    const list = [];
    if (applied.college) list.push({ key: 'college', label: applied.college });
    if (applied.department) list.push({ key: 'department', label: applied.department });
    if (applied.cohort) list.push({ key: 'cohort', label: `入學 ${applied.cohort}` });
    if (applied.engagement && applied.engagement !== 'any') {
      const option = ENGAGEMENT_OPTIONS.find((item) => item.value === applied.engagement);
      list.push({ key: 'engagement', label: option?.label || applied.engagement });
    }
    if (applied.has_pretest && applied.has_pretest !== 'any') {
      const option = PRETEST_OPTIONS.find((item) => item.value === applied.has_pretest);
      list.push({ key: 'has_pretest', label: option?.label || applied.has_pretest });
    }
    if (applied.weak_pretest_skill) {
      const option = WEAK_SKILL_OPTIONS.find((item) => item.value === applied.weak_pretest_skill);
      list.push({ key: 'weak_pretest_skill', label: option?.label || applied.weak_pretest_skill });
    }
    if (applied.keyword) list.push({ key: 'keyword', label: `搜尋 ${applied.keyword}` });
    return list;
  }, [applied]);

  const patchDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const applyFilters = (event) => {
    event?.preventDefault();
    setApplied({ ...draft });
    setOffset(0);
  };

  const clearChip = (key) => {
    const blank = key === 'engagement' || key === 'has_pretest' ? 'any' : '';
    const next = { ...applied, [key]: blank };
    setDraft(next);
    setApplied(next);
    setOffset(0);
  };

  const resetFilters = () => {
    const next = {
      ...EMPTY_FILTERS,
      snapshot_version: applied.snapshot_version || meta?.recommendedSnapshotVersion || '',
    };
    setDraft(next);
    setApplied(next);
    setOffset(0);
  };

  const noCohort = !loading && !error && data && matched === 0;
  const engagementLabel = (option) => {
    if (!summary || option.countKey == null) return option.label;
    const count = summary[option.countKey];
    if (count == null) return option.label;
    return `${option.label}（${formatCount(count)}）`;
  };

  return (
    <LearningAnalyticsPageFrame
      title="接近 B2"
      showWorkingSet
      workingSetHere="b1-plus"
      question="找還沒達 B2、但能力已接近 B2 的學生：看前測落點、有沒有修課、有沒有參加活動。"
      scope={data?.definition?.rule || 'B2 仍是達標線。這頁用 GSE 51–58（B1+ 帶）找出接近 B2、尚未達標的人。'}
      howToRead={(
        <ul className="small mb-0 ps-3">
          <li className="mb-1">達標仍看 B2。GSE 已到 59 以上的人不在這份名單。</li>
          <li className="mb-1">「接近 B2」是目前最佳能力的 GSE 落在 51–58。有原始分就換成 GSE，不依賴 CEFR 字串有沒有加號。</li>
          <li className="mb-1">前測是第一梯有效英檢，學測不算。某一科沒有前測會顯示「—」。</li>
          <li>有修課＝有選課紀錄（退選不算）；當下學期有選課列視為修課中。活動仍看累積活動時數。兩邊都沒有的人，是還沒被校內英語資源接觸到的接近 B2 學生。</li>
        </ul>
      )}
    >
      <form className="la-b1-filters" onSubmit={applyFilters}>
        <div className="la-b1-filters__row">
          <Form.Group>
            <Form.Label className="small text-muted">資料版本</Form.Label>
            <Form.Select
              value={draft.snapshot_version}
              onChange={(event) => patchDraft({ snapshot_version: event.target.value })}
            >
              {!draft.snapshot_version ? <option value="">請選擇資料版本</option> : null}
              {snapshots.map((snapshot) => {
                const version = snapshot.version || snapshot.snapshotVersion;
                return (
                  <option key={version} value={version}>
                    {snapshotLabel(snapshot)}
                  </option>
                );
              })}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted">學院</Form.Label>
            <Form.Select
              value={draft.college}
              onChange={(event) => patchDraft({ college: event.target.value, department: '' })}
            >
              <option value="">全部學院</option>
              {options.colleges.map((name) => <option key={name} value={name}>{name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted">系所</Form.Label>
            <Form.Select
              value={draft.department}
              onChange={(event) => patchDraft({ department: event.target.value })}
            >
              <option value="">全部系所</option>
              {options.departments.map((name) => <option key={name} value={name}>{name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted">入學年度</Form.Label>
            <Form.Select
              value={draft.cohort}
              onChange={(event) => patchDraft({ cohort: event.target.value })}
            >
              <option value="">全部年度</option>
              {options.cohorts.map((year) => <option key={year} value={year}>{year}</option>)}
            </Form.Select>
          </Form.Group>
        </div>

        <div className="la-b1-filters__row">
          <Form.Group>
            <Form.Label className="small text-muted">修課與活動</Form.Label>
            <Form.Select
              value={draft.engagement}
              onChange={(event) => patchDraft({ engagement: event.target.value })}
            >
              {ENGAGEMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{engagementLabel(option)}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted">有沒有前測</Form.Label>
            <Form.Select
              value={draft.has_pretest}
              onChange={(event) => patchDraft({ has_pretest: event.target.value })}
            >
              {PRETEST_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted">哪一科前測偏低</Form.Label>
            <Form.Select
              value={draft.weak_pretest_skill}
              onChange={(event) => patchDraft({ weak_pretest_skill: event.target.value })}
            >
              {WEAK_SKILL_OPTIONS.map((option) => (
                <option key={option.value || 'any'} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted">學號或姓名</Form.Label>
            <Form.Control
              value={draft.keyword}
              placeholder="搜尋一位學生"
              onChange={(event) => patchDraft({ keyword: event.target.value })}
            />
          </Form.Group>
        </div>

        <div className="la-b1-filters__actions">
          <Button type="submit" variant="primary">套用篩選</Button>
          <Button type="button" variant="outline-secondary" onClick={resetFilters}>重設</Button>
          <span className="small text-muted">
            學院、系所、入學年度來自整份分析資料，不限這頁目前有多少人。
          </span>
        </div>
      </form>

      <div className="la-explorer-chips mt-3" aria-label="目前篩選">
        {chips.length === 0 ? <span className="la-explorer-chip is-quiet">目前是全部接近 B2</span> : null}
        {chips.map((chip) => (
          <button key={chip.key} type="button" className="la-explorer-chip" onClick={() => clearChip(chip.key)}>
            {chip.label}
            <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>

      <LearningAnalyticsStatus
        loading={loading}
        error={error}
        emptyKind={noCohort ? 'no-match' : null}
        emptyMessage="這組條件下沒有「GSE 51–58、尚未達 B2」的學生。剛進 B1 前段的人不會算成接近 B2。"
      />

      {!loading && !error && summary ? (
        <>
          <div className="row g-3 mt-1">
            <div className="col-md-3 col-sm-6">
              <MetricCard
                label="接近 B2 人數"
                value={formatCount(summary.matched)}
                hint={`GSE ${summary.gseMin ?? 51}–${summary.gseMax ?? 58}`}
              />
            </div>
            <div className="col-md-3 col-sm-6">
              <MetricCard
                label="有前測"
                value={formatRate(summary.withPretest, summary.matched)}
                hint="第一梯有效英檢"
              />
            </div>
            <div className="col-md-3 col-sm-6">
              <MetricCard
                label="有修課"
                value={formatRate(summary.withCourse, summary.matched)}
                hint={
                  summary.withCourseInProgress != null && summary.currentSemester
                    ? `有選課紀錄；其中修課中 ${formatCount(summary.withCourseInProgress)}（${summary.currentSemester}）`
                    : '有選課紀錄（退選不算）'
                }
              />
            </div>
            <div className="col-md-3 col-sm-6">
              <MetricCard
                label="有活動"
                value={formatRate(summary.withActivity, summary.matched)}
                hint="累積活動時數大於 0"
              />
            </div>
          </div>

          {matched > 0 && data?.handoff?.studentIds?.length ? (
            <LearningAnalyticsNextSteps
              label={workingSetActive ? '這批人裡接近 B2 的人' : '目前這份接近 B2 名單'}
              studentIds={data.handoff.studentIds}
              total={data.handoff.total}
              truncated={data.handoff.truncated}
              note="已套用畫面上的切法。B2 達標仍用學期名冊，不在名冊的人不會進分母。"
              source="b1-plus"
              sourcePath="/admin/learning-analytics/b1-plus"
            />
          ) : null}

          {matched > 0 ? (
            <div className="la-panel mt-3">
              <div className="la-panel-title mb-2">
                學生名單（{formatCount(total)} 人
                {applied.engagement !== 'any' || applied.has_pretest !== 'any' || applied.weak_pretest_skill || applied.keyword
                  ? '，已依切法縮小'
                  : ''}
                ）
              </div>
              {total === 0 ? (
                <p className="small text-muted mb-0">這組切法下沒有學生。改回「全部接近 B2」再看。</p>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0 la-table">
                      <thead>
                        <tr>
                          <th>學生</th>
                          <th>系所</th>
                          <th><ColumnHead {...HEAD.admissionYear} /></th>
                          <th className="la-num">
                            <ColumnHead
                              name="目前最佳 GSE"
                              hint="四技能裡最高的 GSE。這頁的人落在 51–58。"
                            />
                          </th>
                          {SKILL_COLUMNS.map(([, label]) => (
                            <th key={label}>
                              <ColumnHead name={label} hint="這一科前測的帶級與 GSE。學測不算前測。" />
                            </th>
                          ))}
                          <th><ColumnHead {...HEAD.courseStatus} /></th>
                          <th className="la-num"><ColumnHead {...HEAD.activityHours} /></th>
                          <th><ColumnHead {...HEAD.situation} /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.items || []).map((row) => (
                          <tr key={row.studentId}>
                            <td>
                              <Link
                                to={studentTrajectoryPath(row.studentId)}
                                onClick={() => pushRecentStudent({ studentId: row.studentId, name: row.studentName })}
                              >
                                {row.studentId}
                              </Link>
                              {row.studentName ? <div className="small text-muted">{row.studentName}</div> : null}
                            </td>
                            <td>{row.department || '—'}</td>
                            <td>{row.cohort || '—'}</td>
                            <td className="la-num">
                              {row.bestGse != null ? row.bestGse : '—'}
                              {row.currentLevel ? (
                                <div className="small text-muted">{row.currentLevel}</div>
                              ) : null}
                            </td>
                            {SKILL_COLUMNS.map(([key]) => (
                              <td key={key}>{pretestCell(row, key)}</td>
                            ))}
                            <td>
                              {row.courseInProgress
                                ? '修課中'
                                : row.hasCourse
                                  ? '有紀錄'
                                  : '—'}
                            </td>
                            <td className="la-num">{formatHours(row.activityHours)}</td>
                            <td>{SITUATION_LABELS[row.situation] || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {total > PAGE_SIZE ? (
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <span className="small text-muted">
                        {formatCount(offset + 1)}–{formatCount(Math.min(offset + PAGE_SIZE, total))}／{formatCount(total)}
                      </span>
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          disabled={offset === 0}
                          onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                        >
                          上一頁
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          disabled={offset + PAGE_SIZE >= total}
                          onClick={() => setOffset((current) => current + PAGE_SIZE)}
                        >
                          下一頁
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </LearningAnalyticsPageFrame>
  );
}
