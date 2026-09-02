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

function ImprovementCell({ metric }) {
  if (!metric || metric.rate == null) return <span className="text-muted">—</span>;
  return (
    <span title={metric.label}>
      {metric.studentCount ?? '—'}
      <span className="text-muted small ms-1">({formatPct(metric.rate)})</span>
    </span>
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

function StudentDetailTable({ students }) {
  if (!students?.length) return <p className="small text-muted mb-0">尚無學生明細。</p>;
  return (
    <div className="table-responsive">
      <table className="table table-sm mb-0">
        <thead>
          <tr>
            <th>學號</th>
            <th className="text-end">前後測筆數</th>
            <th className="text-end">平均原始進步</th>
            <th className="text-end">GSE 實際</th>
            <th className="text-end">GSE 修正</th>
            <th className="text-end">任一進步</th>
            <th className="text-end">全技能進步</th>
            <th className="text-end">平均 &gt; 0</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.studentId}>
              <td>
                <a href={`/admin/learning-analytics/students/${encodeURIComponent(student.studentId)}`}>
                  {student.studentId}
                </a>
              </td>
              <td className="text-end">{student.growthEpisodeCount || 0}</td>
              <td className="text-end">{formatDelta(student.avgRawDelta)}</td>
              <td className="text-end">{formatDelta(student.avgActualGseGrowth)}</td>
              <td className="text-end">{formatDelta(student.avgAdjustedGseGrowth)}</td>
              <td className="text-end">{student.improvement?.any?.studentCount ? '是' : '—'}</td>
              <td className="text-end">{student.improvement?.allSkills?.studentCount ? '是' : '—'}</td>
              <td className="text-end">{student.improvement?.avgPositive?.studentCount ? '是' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  } = useLearningAnalyticsBootstrap();
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
      <LearningAnalyticsDataHealth meta={meta} error={metaError} />

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
        matchingCaliperDefault={meta?.matchingCaliperDefault}
      />

      <LearningAnalyticsActiveFilters filters={appliedFilters} />

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
          建議在篩選條件中選擇學期，以便聚焦單一學期的課程或活動細項；教師維度可切換「跨學期合併」。
        </Alert>
      ) : null}

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}

      {!loading && data ? (
        <div className="la-panel mt-3">
          <div className="la-panel-title">
            {dimensionLabel(data.dimension)}細項（{data.rowCount} 列）
          </div>
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
                    <th className="text-end" title="至少一筆前後測 delta > 0">任一進步</th>
                    <th className="text-end" title="有資料的所有技能皆 delta > 0">全技能進步</th>
                    <th className="text-end" title="該學生所有前後測 delta 平均 > 0">平均 &gt; 0</th>
                    <th className="text-end">平均原始進步</th>
                    <th className="text-end">GSE 實際</th>
                    <th className="text-end">GSE 修正</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isOpen = expandedKey === row.offeringKey;
                    const detail = detailByKey[row.offeringKey];
                    const colSpan = 10
                      + (dimension === 'course' ? 1 : 0)
                      + (dimension === 'course' || dimension === 'instructor' || dimension === 'activity' ? 1 : 0)
                      + (dimension === 'activity' ? 1 : 0)
                      + (dimension === 'instructor' ? 1 : 0);
                    return (
                      <React.Fragment key={row.offeringKey}>
                        <tr>
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
                            <ImprovementCell metric={row.improvement?.avgPositive} />
                          </td>
                          <td className="text-end">{formatDelta(row.avgRawDelta)}</td>
                          <td className="text-end">{formatDelta(row.avgActualGseGrowth)}</td>
                          <td className="text-end">{formatDelta(row.avgAdjustedGseGrowth)}</td>
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
                                <div className="mb-3">
                                  <div className="small fw-semibold mb-2">技能 breakdown</div>
                                  <SkillBreakdownTable rows={row.skillBreakdown} />
                                </div>
                                <div>
                                  <div className="small fw-semibold mb-2">學生明細</div>
                                  {detailLoadingKey === row.offeringKey ? (
                                    <div className="text-center py-3"><Spinner size="sm" animation="border" /></div>
                                  ) : null}
                                  {detail?.error ? (
                                    <Alert variant="danger" className="mb-0 py-2 small">{detail.error}</Alert>
                                  ) : null}
                                  {detail?.students ? (
                                    <StudentDetailTable students={detail.students} />
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
