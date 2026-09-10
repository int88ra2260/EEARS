import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Collapse from 'react-bootstrap/Collapse';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import {
  exportLearningAnalyticsOfferings,
  getLearningAnalyticsOfferingDetail,
  getLearningAnalyticsOfferings,
} from '../../services/learningAnalyticsService';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import LaFold from '../../components/learningAnalytics/LaFold';
import StudentTrajectoryLink from '../../components/learningAnalytics/StudentTrajectoryLink';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { downloadBlob } from '../../utils/learningJourneyOperationsHelpers';
import { P } from '../../constants/permissions';

const DIMENSION_OPTIONS = [
  { value: 'course', label: '課程' },
  { value: 'instructor', label: '教師' },
  { value: 'activity', label: '個別活動' },
  { value: 'resource_category', label: '資源類別（通識英文等）' },
];

const INSTRUCTOR_GROUPING_OPTIONS = [
  { value: 'by_semester', label: '依學期分開' },
  { value: 'merged', label: '跨學期合併' },
];

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

function formatPct(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function formatDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

function dimensionLabel(value) {
  return DIMENSION_OPTIONS.find((opt) => opt.value === value)?.label || value;
}

function meanOf(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 100) / 100;
}

function percentileOf(values, p) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  if (nums.length === 1) return Math.round(nums[0] * 100) / 100;
  const rank = (Math.max(0, Math.min(100, Number(p))) / 100) * (nums.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return Math.round(nums[lo] * 100) / 100;
  const weight = rank - lo;
  return Math.round((nums[lo] * (1 - weight) + nums[hi] * weight) * 100) / 100;
}

function buildClientDistribution(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) {
    return { n: 0, median: null, p25: null, p75: null, min: null, max: null };
  }
  const sorted = [...nums].sort((a, b) => a - b);
  return {
    n: sorted.length,
    median: percentileOf(sorted, 50),
    p25: percentileOf(sorted, 25),
    p75: percentileOf(sorted, 75),
    min: Math.round(sorted[0] * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
  };
}

function buildClientDirection(avgs) {
  let improved = 0;
  let flat = 0;
  let declined = 0;
  for (const value of avgs) {
    if (value > 0) improved += 1;
    else if (value < 0) declined += 1;
    else flat += 1;
  }
  return { improved, flat, declined, total: improved + flat + declined };
}

function assessClientOutlierSkew(avgRaw, distribution, avgs) {
  if (avgRaw == null || distribution?.median == null || avgs.length < 10) {
    return { flagged: false, reason: null };
  }
  const gap = avgRaw - distribution.median;
  const iqr = distribution.p75 != null && distribution.p25 != null
    ? distribution.p75 - distribution.p25
    : null;
  const threshold = iqr != null && iqr > 0 ? Math.max(4, 0.75 * iqr) : 5;
  const reasons = [];
  if (Math.abs(gap) >= threshold) {
    reasons.push(
      `原始分平均（${formatDelta(avgRaw)}）與中位數（${formatDelta(distribution.median)}）差距明顯，可能受少數極端值影響`
    );
  }
  let extremeIdx = 0;
  for (let i = 1; i < avgs.length; i += 1) {
    if (Math.abs(avgs[i]) > Math.abs(avgs[extremeIdx])) extremeIdx = i;
  }
  const without = avgs.filter((_, i) => i !== extremeIdx);
  const meanWithout = meanOf(without);
  if (meanWithout != null && Math.abs(avgRaw - meanWithout) >= 4) {
    reasons.push(`剔除極端 1 人後平均為 ${formatDelta(meanWithout)}（原 ${formatDelta(avgRaw)}）`);
  }
  return {
    flagged: reasons.length > 0,
    reason: reasons.length ? [...new Set(reasons)].join('；') : null,
  };
}

/** 由學生明細推算列層方向／分布／極端值（API 尚未回傳 v3 欄位時補齊） */
function deriveStatsFromStudents(students) {
  const rawAvgs = (students || [])
    .map((s) => Number(s.avgRawDelta))
    .filter(Number.isFinite);
  const gseActualAvgs = (students || [])
    .map((s) => Number(s.avgActualGseGrowth))
    .filter(Number.isFinite);
  const gseAdjustedAvgs = (students || [])
    .map((s) => Number(s.avgAdjustedGseGrowth))
    .filter(Number.isFinite);
  if (!rawAvgs.length) return null;
  const rawDistribution = buildClientDistribution(rawAvgs);
  const avgRaw = meanOf(rawAvgs);
  return {
    direction: buildClientDirection(rawAvgs),
    rawDistribution,
    gseActualDistribution: buildClientDistribution(gseActualAvgs),
    gseAdjustedDistribution: buildClientDistribution(gseAdjustedAvgs),
    outlierSkew: assessClientOutlierSkew(avgRaw, rawDistribution, rawAvgs),
  };
}

function resolveRowDisplayStats(row, detailStudents) {
  if (row?.privacySuppressed) {
    return {
      direction: null,
      rawDistribution: null,
      gseActualDistribution: null,
      gseAdjustedDistribution: null,
      outlierSkew: null,
      source: 'suppressed',
    };
  }
  if (row?.direction?.improved != null) {
    return {
      direction: row.direction,
      rawDistribution: row.rawDistribution || null,
      gseActualDistribution: row.gseActualDistribution || null,
      gseAdjustedDistribution: row.gseAdjustedDistribution || null,
      outlierSkew: row.outlierSkew || null,
      source: 'api',
    };
  }
  const fromDetail = deriveStatsFromStudents(detailStudents);
  if (fromDetail) {
    return { ...fromDetail, source: 'detail' };
  }
  // 舊 API：至少能顯示「平均 > 0」人數，持平／退步需展開明細
  const improvedOnly = row?.improvement?.avgPositive?.studentCount;
  if (improvedOnly != null) {
    return {
      direction: {
        improved: improvedOnly,
        flat: null,
        declined: null,
        total: row.growthSampleSize ?? null,
        partial: true,
      },
      rawDistribution: null,
      gseActualDistribution: null,
      gseAdjustedDistribution: null,
      outlierSkew: null,
      source: 'partial',
    };
  }
  return {
    direction: null,
    rawDistribution: null,
    gseActualDistribution: null,
    gseAdjustedDistribution: null,
    outlierSkew: null,
    source: 'none',
  };
}

function ImprovementCell({ metric }) {
  if (!metric || metric.rate == null) return <span className="text-muted">—</span>;
  return (
    <span title={metric.label}>
      {metric.studentCount ?? '—'}
      <span className="text-muted small ms-1">({formatPct(metric.rate)})</span>
    </span>
  );
}

/** 進步／持平／退步（學生層級平均） */
function DirectionCell({ direction }) {
  if (!direction || direction.improved == null) {
    return <span className="text-muted">—</span>;
  }
  if (direction.partial || direction.flat == null || direction.declined == null) {
    return (
      <span
        className="small text-nowrap"
        title="目前僅知「學生平均 > 0」人數；展開學生明細後可補齊持平／退步"
      >
        <span className="text-success">↑{direction.improved}</span>
        <span className="text-muted ms-1">（展開補齊）</span>
      </span>
    );
  }
  const title = `依學生前後測平均：進步 ${direction.improved}、持平 ${direction.flat}、退步 ${direction.declined}`;
  return (
    <span className="small text-nowrap" title={title}>
      <span className="text-success">↑{direction.improved}</span>
      <span className="text-muted mx-1">·</span>
      <span className="text-secondary">→{direction.flat}</span>
      <span className="text-muted mx-1">·</span>
      <span className="text-danger">↓{direction.declined}</span>
    </span>
  );
}

/** 平均 + 中位／四分位，便於判斷是否被極端值拉高 */
function DeltaWithDistribution({ avg, distribution, skewFlagged }) {
  if (avg == null && distribution?.median == null) {
    return <span className="text-muted">—</span>;
  }
  const qTitle = distribution?.p25 != null && distribution?.p75 != null
    ? `Q1–Q3：${formatDelta(distribution.p25)} ～ ${formatDelta(distribution.p75)}`
    : '';
  return (
    <div className={skewFlagged ? 'border-start border-warning border-3 ps-2' : undefined}>
      <div className="fw-semibold">{formatDelta(avg)}</div>
      {distribution?.median != null ? (
        <div className="small text-muted" title={qTitle || undefined}>
          中位 {formatDelta(distribution.median)}
          {distribution.p25 != null && distribution.p75 != null ? (
            <span className="ms-1">({formatDelta(distribution.p25)}–{formatDelta(distribution.p75)})</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SkillBreakdownTable({ rows }) {
  if (!rows?.length) return <p className="small text-muted mb-0">尚無技能 breakdown 資料。</p>;
  return (
    <div className="table-responsive">
      <table className="table table-sm mb-0">
        <thead>
          <tr>
            <th>技能</th>
            <th className="text-end">可計算人數</th>
            <th className="text-end">平均原始進步</th>
            <th className="text-end">GSE 實際成長</th>
            <th className="text-end">GSE 修正成長</th>
            <th className="text-end">任一進步率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.skill}>
              <td>{row.label || SKILL_LABELS[row.skill] || row.skill}</td>
              <td className="text-end">{row.growthSampleSize}</td>
              <td className="text-end">{formatDelta(row.avgRawDelta)}</td>
              <td className="text-end">{formatDelta(row.avgActualGseGrowth)}</td>
              <td className="text-end">{formatDelta(row.avgAdjustedGseGrowth)}</td>
              <td className="text-end">{formatPct(row.improvedRateAny)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function studentDirection(avg) {
  const n = Number(avg);
  if (!Number.isFinite(n)) return null;
  if (n > 0) return 'improved';
  if (n < 0) return 'declined';
  return 'flat';
}

function DirectionBadge({ avg }) {
  const dir = studentDirection(avg);
  if (!dir) return <span className="text-muted">—</span>;
  if (dir === 'improved') return <Badge bg="success">進步</Badge>;
  if (dir === 'declined') return <Badge bg="danger">退步</Badge>;
  return <Badge bg="secondary">持平</Badge>;
}

/** 列有極端值警示時，標出落在四分位外或相對中位偏離大的學生 */
function isExtremeStudent(avg, distribution) {
  const n = Number(avg);
  if (!Number.isFinite(n) || !distribution) return false;
  const { p25, p75, median } = distribution;
  if (p25 != null && p75 != null) {
    const iqr = p75 - p25;
    const fence = Math.max(iqr, 0) * 1.5;
    if (n < p25 - fence || n > p75 + fence) return true;
  }
  if (median != null && Math.abs(n - median) >= 4) return true;
  return false;
}

function StudentDetailTable({ students, distribution, skewFlagged, direction }) {
  if (!students?.length) return <p className="small text-muted mb-0">尚無學生明細。</p>;
  const withGrowth = students.filter((s) => s.growthSampleSize > 0).length;
  const gseWarnCount = students.filter((s) => s.gseResolutionWarning?.flagged).length;
  return (
    <div>
      <p className="small text-muted mb-2">
        同測進步以「平均原始進步」為準；GSE 為跨測驗量尺（同測可能因錨點較粗顯示 0）。
        依平均原始進步由高到低排序；有成長資料 {withGrowth}／{students.length} 人。
        {direction?.improved != null && direction.flat != null ? (
          <>
            {' '}群體方向：進步 {direction.improved}、持平 {direction.flat}、退步 {direction.declined}。
          </>
        ) : null}
        {gseWarnCount ? ` ${gseWarnCount} 人有 GSE 換算解析度警示。` : null}
        {skewFlagged ? ' 黃色列為相對群體分布偏離較大、可能拉高或拉低平均者。' : null}
      </p>
      <div className="table-responsive">
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th>學號</th>
              <th className="text-end" title="單一技能的前後測配對數，不是考試場次">前後測筆數</th>
              <th className="text-center" title="依平均原始進步">方向</th>
              <th className="text-end" title="同測主指標">平均原始進步</th>
              <th className="text-end" title="跨測驗量尺；同測時可能較鈍">GSE 實際</th>
              <th className="text-end">GSE 修正</th>
              <th className="text-end" title="聽／說／讀／寫至少一項有前後測且後測優於前測">任一技能進步</th>
              <th className="text-end" title="四項都有前後測且每一項都進步">全技能進步</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const extreme = skewFlagged && isExtremeStudent(student.avgRawDelta, distribution);
              const gseWarn = Boolean(student.gseResolutionWarning?.flagged);
              return (
                <tr
                  key={student.studentId}
                  className={extreme || gseWarn ? 'table-warning' : undefined}
                >
                  <td>
                    <StudentTrajectoryLink studentId={student.studentId} />
                    {extreme ? (
                      <Badge bg="warning" text="dark" className="ms-2">極端</Badge>
                    ) : null}
                    {gseWarn ? (
                      <Badge
                        bg="info"
                        className="ms-2"
                        title={student.gseResolutionWarning?.reason || ''}
                      >
                        GSE 鈍化
                      </Badge>
                    ) : null}
                  </td>
                  <td className="text-end">{student.growthEpisodeCount || 0}</td>
                  <td className="text-center">
                    <DirectionBadge avg={student.avgRawDelta} />
                  </td>
                  <td className="text-end fw-semibold">{formatDelta(student.avgRawDelta)}</td>
                  <td className="text-end">
                    {formatDelta(student.avgActualGseGrowth)}
                    {student.gseMappedEpisodeCount != null ? (
                      <div className="small text-muted">可換算 {student.gseMappedEpisodeCount}/{student.growthEpisodeCount || 0}</div>
                    ) : null}
                  </td>
                  <td className="text-end">{formatDelta(student.avgAdjustedGseGrowth)}</td>
                  <td className="text-end">{student.improvement?.any?.studentCount ? '是' : '—'}</td>
                  <td className="text-end">{student.improvement?.allSkills?.studentCount ? '是' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DimensionMetaCells({ dimension, row }) {
  return (
    <>
      {dimension === 'course' ? <td className="small text-muted">{row.courseCode || '—'}</td> : null}
      {dimension === 'course' || dimension === 'instructor' || dimension === 'activity' ? (
        <td className="small">{row.semesterLabel || row.semesterId || (row.semesterIds?.join('、')) || '—'}</td>
      ) : null}
      {dimension === 'activity' ? <td className="small">{row.eventDate || '—'}</td> : null}
      {dimension === 'instructor' ? (
        <td className="text-end">{row.courseCount ?? '—'}</td>
      ) : null}
    </>
  );
}

function AlertCell({ skewFlagged, outlierReason, gseWarnCount }) {
  if (!skewFlagged && !(gseWarnCount > 0)) {
    return <span className="text-muted small">—</span>;
  }
  return (
    <div className="d-flex flex-column align-items-center gap-1">
      {skewFlagged ? (
        <Badge bg="warning" text="dark" title={outlierReason || ''}>
          極端值
        </Badge>
      ) : null}
      {gseWarnCount > 0 ? (
        <Badge
          bg="info"
          title={`${gseWarnCount} 人原始分明顯變動但 GSE≈0 或無法換算`}
        >
          GSE 鈍化 {gseWarnCount}
        </Badge>
      ) : null}
    </div>
  );
}

function AdvancedMetricsStrip({ row, stats }) {
  return (
    <div className="la-offerings-advanced-strip mb-3">
      <div className="small fw-semibold mb-2">進階指標（預設表隱藏）</div>
      <div className="row g-2 small">
        <div className="col-md-3">
          <div className="text-muted">任一技能進步</div>
          <ImprovementCell metric={row.improvement?.any} />
        </div>
        <div className="col-md-3">
          <div className="text-muted">全技能進步</div>
          <ImprovementCell metric={row.improvement?.allSkills} />
        </div>
        <div className="col-md-3">
          <div className="text-muted">GSE 實際（輔）</div>
          <DeltaWithDistribution
            avg={row.avgActualGseGrowth}
            distribution={stats.gseActualDistribution}
            skewFlagged={false}
          />
        </div>
        <div className="col-md-3">
          <div className="text-muted">GSE 修正（輔）</div>
          <DeltaWithDistribution
            avg={row.avgAdjustedGseGrowth}
            distribution={stats.gseAdjustedDistribution}
            skewFlagged={false}
          />
        </div>
      </div>
    </div>
  );
}

function countOfferingsColSpan(dimension, showAdvanced) {
  let n = 7; // expand, name, participants, growth, direction, raw, alerts
  if (dimension === 'course') n += 2; // code + semester
  else if (dimension === 'instructor') n += 2; // semester + courseCount
  else if (dimension === 'activity') n += 2; // semester + date
  if (showAdvanced) n += 4; // any, all, gse actual, gse adjusted
  return n;
}

/** 細項分析僅適用學期／資料版本，不沿用學生群體篩選 */
const OFFERING_SCOPE_KEYS = ['semester', 'snapshot_version'];

export default function LearningAnalyticsOfferingsPage() {
  const {
    meta,
    metaError,
    filters,
    setFilters,
    appliedFilters,
    applyFilters,
    resetFilters,
    ready,
    apiParams,
    token,
  } = useLearningAnalyticsBootstrap({
    scopeKeys: OFFERING_SCOPE_KEYS,
    defaultSemester: 'current',
  });
  const [dimension, setDimension] = useState('course');
  const [instructorGrouping, setInstructorGrouping] = useState('by_semester');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [expandedKey, setExpandedKey] = useState('');
  const [detailLoadingKey, setDetailLoadingKey] = useState('');
  const [detailByKey, setDetailByKey] = useState({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);

  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_LEARNING_ANALYTICS);
  const showSnapshotFilter = (meta?.snapshotVersionCount || 0) > 1;
  const offeringVisibleKeys = useMemo(() => (
    showSnapshotFilter ? ['semester', 'snapshot_version'] : ['semester']
  ), [showSnapshotFilter]);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      const payload = await getLearningAnalyticsOfferings(token, {
        ...apiParams(),
        dimension,
        instructor_grouping: dimension === 'instructor' ? instructorGrouping : undefined,
      });
      setData(payload);
      setExpandedKey('');
      setDetailByKey({});
    } catch (e) {
      setData(null);
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, dimension, instructorGrouping, ready]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(async (offeringKey) => {
    if (!ready || detailByKey[offeringKey]) return;
    setDetailLoadingKey(offeringKey);
    try {
      const payload = await getLearningAnalyticsOfferingDetail(token, {
        ...apiParams(),
        dimension,
        instructor_grouping: dimension === 'instructor' ? instructorGrouping : undefined,
        offering_key: offeringKey,
      });
      setDetailByKey((prev) => ({ ...prev, [offeringKey]: payload }));
    } catch (e) {
      setDetailByKey((prev) => ({
        ...prev,
        [offeringKey]: { error: e.message || '載入學生明細失敗' },
      }));
    } finally {
      setDetailLoadingKey('');
    }
  }, [apiParams, detailByKey, dimension, instructorGrouping, ready, token]);

  const toggleRow = useCallback((offeringKey) => {
    setExpandedKey((prev) => {
      const next = prev === offeringKey ? '' : offeringKey;
      if (next) loadDetail(next);
      return next;
    });
  }, [loadDetail]);

  const handleExport = useCallback(async () => {
    if (!ready || !canExport) return;
    setExporting(true);
    setExportError('');
    try {
      const { blob, fileName } = await exportLearningAnalyticsOfferings(token, {
        ...apiParams(),
        dimension,
        instructor_grouping: dimension === 'instructor' ? instructorGrouping : undefined,
      });
      downloadBlob(blob, fileName);
    } catch (e) {
      setExportError(e.message || '匯出失敗');
    } finally {
      setExporting(false);
    }
  }, [apiParams, canExport, dimension, instructorGrouping, ready, token]);

  const rows = useMemo(() => {
    const list = [...(data?.rows || [])];
    // 預設：可計算成長多的排前面，方便先看有意義的列
    list.sort((a, b) => {
      const g = (Number(b.growthSampleSize) || 0) - (Number(a.growthSampleSize) || 0);
      if (g !== 0) return g;
      return (Number(b.participantCount) || 0) - (Number(a.participantCount) || 0);
    });
    return list;
  }, [data?.rows]);
  const showSemesterHint = useMemo(
    () => (dimension === 'course' || dimension === 'activity')
      && !appliedFilters.semester,
    [dimension, appliedFilters.semester]
  );

  return (
    <div>
      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />

      <LearningAnalyticsPanelHeader
        title="課／師／活動細項"
        lead="看某一門課、一位教師或一場活動：多少人參與、多少人可算成長、進步／持平／退步各多少。同測請看「平均原始進步」；這是觀察關聯，不是因果證明。"
      />

      <LaFold label="如何閱讀本頁" className="mb-3">
        <ol className="small mb-2 ps-3">
          <li className="mb-1">先選<strong>學期</strong>，再選分析維度（課程／教師／活動／資源類別）。</li>
          <li className="mb-1">
            預設只看五個核心欄：參與人數、可計算成長、進步／持平／退步、平均原始進步、警示。
          </li>
          <li className="mb-1">
            「可計算成長」太少時不要解讀平均；有「極端值」警示時請對照中位數或展開學生。
          </li>
          <li className="mb-1">
            需要「任一／全技能進步」或 GSE 時，再開「顯示進階欄位」，或點 ▶ 展開該列。
          </li>
        </ol>
        <p className="small text-muted mb-0">
          三種「有進步」定義不同：預設方向桶用學生平均原始分；任一技能／全技能為較嚴格的技能條件，放在進階。
        </p>
      </LaFold>

      <Alert variant="secondary" className="small py-2">
        <strong>非因果。</strong>
        {' '}
        數字高不代表「上這門課就會進步」。可計算成長少於 {data?.minGrowthSample || 10} 人時，平均與進步率會遮蔽。
      </Alert>

      <LearningAnalyticsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={applyFilters}
        onReset={resetFilters}
        loading={loading || !ready}
        filterOptions={meta?.filterOptions}
        snapshotOptions={meta?.snapshots}
        visibleKeys={offeringVisibleKeys}
        showAdvanced={false}
        filterTitle="範圍條件"
        emptyHint="未選學期時顯示所有學期細項（建議先選學期）"
        intro="本頁依課程／教師／活動彙總，不使用系所、入學年度等學生群體條件；請用下方「分析維度」切換。學期會篩選修課與活動細項。"
      />

      <LearningAnalyticsActiveFilters
        filters={appliedFilters}
        visibleKeys={offeringVisibleKeys}
        semesterScope="full"
      />

      <div className="d-flex flex-wrap gap-3 align-items-end mt-3">
        <Form.Group style={{ minWidth: 220 }}>
          <Form.Label className="small text-muted">分析維度</Form.Label>
          <Form.Select value={dimension} onChange={(e) => setDimension(e.target.value)} disabled={loading}>
            {DIMENSION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Form.Select>
        </Form.Group>
        {dimension === 'instructor' ? (
          <Form.Group style={{ minWidth: 220 }}>
            <Form.Label className="small text-muted">教師彙總方式</Form.Label>
            <Form.Select
              value={instructorGrouping}
              onChange={(e) => setInstructorGrouping(e.target.value)}
              disabled={loading}
            >
              {INSTRUCTOR_GROUPING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        ) : null}
        {data?.semester ? (
          <Badge bg="light" text="dark" className="mb-2">
            學期篩選：{data.semester}
          </Badge>
        ) : null}
        {data?.teacherScope === 'teacher' ? (
          <Badge bg="secondary" className="mb-2">僅顯示您的授課細項</Badge>
        ) : null}
        <Form.Check
          type="switch"
          id="la-offerings-advanced-cols"
          className="mb-2"
          label="顯示進階欄位（技能定義／GSE）"
          checked={showAdvancedColumns}
          onChange={(e) => setShowAdvancedColumns(e.target.checked)}
        />
        <Button
          variant="outline-primary"
          size="sm"
          className="mb-2"
          onClick={handleExport}
          disabled={!canExport || !ready || loading || exporting || !rows.length}
        >
          {exporting ? '匯出中…' : '匯出 Excel'}
        </Button>
      </div>

      {!canExport ? (
        <Alert variant="secondary" className="mt-3 mb-0 small">
          您目前僅可檢視細項分析；匯出 Excel 需「學習成效分析（匯出）」權限。
        </Alert>
      ) : null}
      {exportError ? <Alert variant="danger" className="mt-3 mb-0">{exportError}</Alert> : null}

      {showSemesterHint ? (
        <Alert variant="warning" className="mt-3 mb-0">
          建議先選擇學期，以便聚焦單一學期的課程或活動細項；教師維度可切換「跨學期合併」。
        </Alert>
      ) : null}

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}

      {!loading && data ? (
        <div className="la-panel mt-3">
          <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
            <div className="la-panel-title mb-0">
              {dimensionLabel(data.dimension)}細項（{data.rowCount} 列）
            </div>
            <div className="small text-muted">
              預設主指標：進步／持平／退步 ＋ 平均原始進步
              {showAdvancedColumns ? ' · 已顯示進階欄' : ' · 進階欄已隱藏'}
            </div>
          </div>
          {data.growthScaleGuidance?.summary ? (
            <p className="small text-muted mb-3">{data.growthScaleGuidance.summary}</p>
          ) : (
            <Alert variant="warning" className="mb-3 py-2 small">
              後端尚未回傳量尺說明（contract：{data.contractVersion || '未知'}）。
              請重啟後端至 offerings.v4。同測進步請先看原始分；GSE 僅作跨測驗參考。
            </Alert>
          )}
          {(data.improvementDefinitions || []).length ? (
            <LaFold label="「有進步」定義對照" className="mb-3">
              <ul className="small text-muted mb-0">
                {data.improvementDefinitions.map((def) => (
                  <li key={def.key}>
                    <strong>{def.label}</strong>
                    {def.detail ? `：${def.detail}` : null}
                  </li>
                ))}
                <li>
                  <strong>進步／持平／退步</strong>
                  ：依學生前後測平均原始分 &gt;0／=0／&lt;0（預設表主看這個）
                </li>
              </ul>
            </LaFold>
          ) : null}
          {!rows.length ? (
            <p className="small text-muted mb-0">目前篩選條件下沒有可顯示的細項資料。</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 la-offerings-table">
                <thead>
                  <tr>
                    <th aria-label="展開" style={{ width: '2rem' }} />
                    <th>名稱</th>
                    {dimension === 'course' ? <th>課號</th> : null}
                    {dimension === 'course' || dimension === 'instructor' || dimension === 'activity' ? (
                      <th>學期</th>
                    ) : null}
                    {dimension === 'activity' ? <th>日期</th> : null}
                    {dimension === 'instructor' ? <th className="text-end">開課數</th> : null}
                    <th className="text-end">參與人數</th>
                    <th
                      className="text-end"
                      title="有可配對前後測、能算個人進步的人數"
                    >
                      可計算成長
                    </th>
                    <th
                      className="text-end"
                      title="依學生前後測平均原始分：進步（>0）／持平（=0）／退步（<0）"
                    >
                      進步／持平／退步
                    </th>
                    <th
                      className="text-end"
                      title="同測主指標：平均 + 中位數（Q1–Q3）"
                    >
                      平均原始進步
                    </th>
                    {showAdvancedColumns ? (
                      <>
                        <th
                          className="text-end"
                          title="聽／說／讀／寫至少一項有前後測且後測優於前測"
                        >
                          任一技能進步
                        </th>
                        <th
                          className="text-end"
                          title="聽／說／讀／寫四項都有前後測，且每一項後測都優於前測"
                        >
                          全技能進步
                        </th>
                        <th
                          className="text-end"
                          title="跨測驗量尺。同測時錨點較粗可能≈0，請對照原始分"
                        >
                          GSE 實際
                        </th>
                        <th className="text-end" title="GSE 修正成長：平均 + 中位（Q1–Q3）">
                          GSE 修正
                        </th>
                      </>
                    ) : null}
                    <th className="text-center" title="平均相對中位偏離，或 GSE 相對原始分鈍化">
                      警示
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isOpen = expandedKey === row.offeringKey;
                    const detail = detailByKey[row.offeringKey];
                    const stats = resolveRowDisplayStats(row, detail?.students);
                    const skewFlagged = Boolean(stats.outlierSkew?.flagged);
                    const colSpan = countOfferingsColSpan(dimension, showAdvancedColumns);
                    return (
                      <React.Fragment key={row.offeringKey}>
                        <tr className={skewFlagged ? 'table-warning' : undefined}>
                          <td>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 text-decoration-none"
                              onClick={() => toggleRow(row.offeringKey)}
                              aria-expanded={isOpen}
                              title={isOpen ? '收合明細' : '展開技能與學生明細'}
                            >
                              {isOpen ? '▼' : '▶'}
                            </Button>
                          </td>
                          <td className="fw-semibold">{row.label}</td>
                          <DimensionMetaCells dimension={dimension} row={row} />
                          <td className="text-end">{row.participantCount ?? 0}</td>
                          <td className="text-end">{row.growthSampleSize ?? 0}</td>
                          <td className="text-end">
                            <DirectionCell direction={stats.direction} />
                          </td>
                          <td className="text-end">
                            <DeltaWithDistribution
                              avg={row.avgRawDelta}
                              distribution={stats.rawDistribution}
                              skewFlagged={skewFlagged}
                            />
                          </td>
                          {showAdvancedColumns ? (
                            <>
                              <td className="text-end">
                                <ImprovementCell metric={row.improvement?.any} />
                              </td>
                              <td className="text-end">
                                <ImprovementCell metric={row.improvement?.allSkills} />
                              </td>
                              <td className="text-end">
                                <DeltaWithDistribution
                                  avg={row.avgActualGseGrowth}
                                  distribution={stats.gseActualDistribution}
                                  skewFlagged={false}
                                />
                              </td>
                              <td className="text-end">
                                <DeltaWithDistribution
                                  avg={row.avgAdjustedGseGrowth}
                                  distribution={stats.gseAdjustedDistribution}
                                  skewFlagged={false}
                                />
                              </td>
                            </>
                          ) : null}
                          <td className="text-center">
                            <AlertCell
                              skewFlagged={skewFlagged}
                              outlierReason={stats.outlierSkew?.reason}
                              gseWarnCount={row.gseResolutionWarningStudentCount}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={colSpan} className="p-0 border-0">
                            <Collapse in={isOpen}>
                              <div className="p-3 bg-light border-top">
                                {row.privacySuppressed ? (
                                  <Alert variant="warning" className="mb-3 py-2 small">
                                    {row.suppressionReason}
                                  </Alert>
                                ) : null}
                                {skewFlagged ? (
                                  <Alert variant="warning" className="mb-3 py-2 small">
                                    {stats.outlierSkew?.reason
                                      || '此列平均可能受少數極端值影響；請對照中位數與學生明細。'}
                                  </Alert>
                                ) : null}
                                {stats.source === 'detail' || stats.source === 'partial' ? (
                                  <Alert variant="info" className="mb-3 py-2 small">
                                    {stats.source === 'partial'
                                      ? '列上暫只顯示「平均 > 0」人數。展開學生明細後，會依個人進步補齊持平／退步、中位數與極端值警示。'
                                      : '以下方向／中位／極端值由學生明細推算，並已回填上方列。'}
                                  </Alert>
                                ) : null}
                                {!showAdvancedColumns ? (
                                  <AdvancedMetricsStrip row={row} stats={stats} />
                                ) : null}
                                <div className="mb-3">
                                  <div className="small fw-semibold mb-2">各技能明細</div>
                                  <SkillBreakdownTable rows={row.skillBreakdown} />
                                </div>
                                <div>
                                  <div className="small fw-semibold mb-2">學生明細（點學號可看個人軌跡）</div>
                                  {detailLoadingKey === row.offeringKey ? (
                                    <div className="text-center py-3"><Spinner size="sm" animation="border" /></div>
                                  ) : null}
                                  {detail?.error ? (
                                    <Alert variant="danger" className="mb-0 py-2 small">{detail.error}</Alert>
                                  ) : null}
                                  {detail?.students ? (
                                    <StudentDetailTable
                                      students={detail.students}
                                      distribution={stats.rawDistribution}
                                      skewFlagged={skewFlagged}
                                      direction={stats.direction}
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </Collapse>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {(data.cautions || []).length ? (
            <ul className="small text-muted mt-3 mb-0">
              {data.cautions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
