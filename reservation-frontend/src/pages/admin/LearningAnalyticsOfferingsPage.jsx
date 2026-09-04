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
                    <a href={`/admin/learning-analytics/students/${encodeURIComponent(student.studentId)}`}>
                      {student.studentId}
                    </a>
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

  const rows = data?.rows || [];
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

      <Alert variant="info" className="mt-2 mb-0">
        <strong>描述性統計，非因果證明。</strong>
        本頁同時呈現三種「有進步」定義：任一前後測有進步、所有技能都進步、整體平均 &gt; 0。
        可計算成長少於 {data?.minGrowthSample || 10} 人時，平均進步與進步率會遮蔽。
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
        intro="本頁依課程／教師／活動彙總，不使用系所、入學年度等學生群體條件；請用下方「分析維度」切換彙總方式。學期會篩選修課與活動細項。"
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
          <div className="la-panel-title">
            {dimensionLabel(data.dimension)}細項（{data.rowCount} 列）
          </div>
          {data.growthScaleGuidance?.summary ? (
            <Alert variant="info" className="mb-3 py-2 small">
              {data.growthScaleGuidance.summary}
            </Alert>
          ) : (
            <Alert variant="warning" className="mb-3 py-2 small">
              後端尚未回傳量尺說明（contract：{data.contractVersion || '未知'}）。
              請重啟後端至 offerings.v4。同測進步請先看原始分；GSE 僅作跨測驗參考。
            </Alert>
          )}
          {(data.improvementDefinitions || []).length ? (
            <ul className="small text-muted mb-3">
              {data.improvementDefinitions.map((def) => (
                <li key={def.key}>
                  <strong>{def.label}</strong>
                  {def.detail ? `：${def.detail}` : null}
                </li>
              ))}
            </ul>
          ) : null}
          {!rows.length ? (
            <p className="small text-muted mb-0">目前篩選條件下沒有可顯示的細項資料。</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th aria-label="展開" />
                    <th>名稱</th>
                    {dimension === 'course' ? <th>課號</th> : null}
                    {dimension === 'course' || dimension === 'instructor' || dimension === 'activity' ? (
                      <th>學期</th>
                    ) : null}
                    {dimension === 'activity' ? <th>日期</th> : null}
                    {dimension === 'instructor' ? <th className="text-end">開課數</th> : null}
                    <th className="text-end">參與人數</th>
                    <th className="text-end">可計算成長</th>
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
                      title="依學生前後測平均原始分：進步（>0）／持平（=0）／退步（<0）"
                    >
                      進步／持平／退步
                    </th>
                    <th
                      className="text-end"
                      title="同測主指標：平均 + 中位數（Q1–Q3）"
                    >
                      平均原始進步（主）
                    </th>
                    <th
                      className="text-end"
                      title="跨測驗量尺。同測時錨點較粗可能≈0，請對照原始分"
                    >
                      GSE 實際（輔）
                    </th>
                    <th className="text-end" title="GSE 修正成長：平均 + 中位（Q1–Q3）">GSE 修正</th>
                    <th className="text-center" title="平均相對中位偏離，或 GSE 相對原始分鈍化">警示</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isOpen = expandedKey === row.offeringKey;
                    const detail = detailByKey[row.offeringKey];
                    const stats = resolveRowDisplayStats(row, detail?.students);
                    const skewFlagged = Boolean(stats.outlierSkew?.flagged);
                    const colSpan = 11
                      + (dimension === 'course' ? 1 : 0)
                      + (dimension === 'course' || dimension === 'instructor' || dimension === 'activity' ? 1 : 0)
                      + (dimension === 'activity' ? 1 : 0)
                      + (dimension === 'instructor' ? 1 : 0);
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
                            >
                              {isOpen ? '▼' : '▶'}
                            </Button>
                          </td>
                          <td className="fw-semibold">{row.label}</td>
                          {dimension === 'course' ? <td>{row.courseCode || '—'}</td> : null}
                          {dimension === 'course' || dimension === 'instructor' || dimension === 'activity' ? (
                            <td>{row.semesterLabel || row.semesterId || (row.semesterIds?.join('、')) || '—'}</td>
                          ) : null}
                          {dimension === 'activity' ? <td>{row.eventDate || '—'}</td> : null}
                          {dimension === 'instructor' ? (
                            <td className="text-end">{row.courseCount ?? '—'}</td>
                          ) : null}
                          <td className="text-end">{row.participantCount ?? 0}</td>
                          <td className="text-end">{row.growthSampleSize ?? 0}</td>
                          <td className="text-end">
                            <ImprovementCell metric={row.improvement?.any} />
                          </td>
                          <td className="text-end">
                            <ImprovementCell metric={row.improvement?.allSkills} />
                          </td>
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
                          <td className="text-center">
                            <div className="d-flex flex-column align-items-center gap-1">
                              {skewFlagged ? (
                                <Badge
                                  bg="warning"
                                  text="dark"
                                  title={stats.outlierSkew?.reason || ''}
                                >
                                  極端值
                                </Badge>
                              ) : null}
                              {row.gseResolutionWarningStudentCount > 0 ? (
                                <Badge
                                  bg="info"
                                  title={`${row.gseResolutionWarningStudentCount} 人原始分明顯變動但 GSE≈0 或無法換算`}
                                >
                                  GSE 鈍化 {row.gseResolutionWarningStudentCount}
                                </Badge>
                              ) : null}
                              {!skewFlagged && !(row.gseResolutionWarningStudentCount > 0) ? (
                                <span className="text-muted small">—</span>
                              ) : null}
                            </div>
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
                                      : '以下方向／中位／極端值由學生明細推算，並已回填上方列。重啟後端（offerings.v3）後可在列表 API 直接取得。'}
                                  </Alert>
                                ) : null}
                                <div className="mb-3">
                                  <div className="small fw-semibold mb-2">技能 breakdown</div>
                                  <SkillBreakdownTable rows={row.skillBreakdown} />
                                </div>
                                <div>
                                  <div className="small fw-semibold mb-2">學生明細（學號與個人進步）</div>
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
