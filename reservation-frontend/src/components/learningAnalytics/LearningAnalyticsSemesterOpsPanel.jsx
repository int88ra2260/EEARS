import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';
import MetricCard from './MetricCard';
import LearningAnalyticsPanelHeader from './LearningAnalyticsPanelHeader';
import {
  exportLearningAnalyticsKpiGaps,
  listLearningAnalyticsKpiPolicies,
  runLearningAnalyticsKpiGaps,
} from '../../services/learningAnalyticsService';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';

function formatPct(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function formatNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('zh-TW');
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 總覽 A 區：學期營運 KPI（名冊分母＋政策達標）與缺口匯出。
 * 與下方「能力觀察」快照累積 B2 刻意分開。
 */
export default function LearningAnalyticsSemesterOpsPanel({
  token,
  semesterId,
  ready,
}) {
  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_LEARNING_ANALYTICS);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [gapReport, setGapReport] = useState(null);
  const [policyId, setPolicyId] = useState(null);

  const load = useCallback(async () => {
    if (!ready || !token || !semesterId) {
      setGapReport(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const policies = await listLearningAnalyticsKpiPolicies(token, {});
      const list = Array.isArray(policies) ? policies : [];
      const preferred = list.find((p) => !p.isArchived && p.policyKey === 'ay115-sitting-pair-sum')
        || list.find((p) => !p.isArchived)
        || null;
      if (!preferred) {
        setGapReport(null);
        setPolicyId(null);
        setError('尚無可用 KPI 政策，請先至 B2 KPI 報表確認政策庫。');
        return;
      }
      setPolicyId(preferred.id);
      const data = await runLearningAnalyticsKpiGaps(token, {
        policyId: preferred.id,
        semesterId,
        includeRows: false,
      });
      setGapReport(data);
    } catch (e) {
      setGapReport(null);
      setError(e.message || '載入學期營運 KPI 失敗');
    } finally {
      setLoading(false);
    }
  }, [ready, token, semesterId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportGaps = async () => {
    if (!policyId || !semesterId || !canExport) return;
    setExporting(true);
    setError('');
    try {
      const { blob, fileName } = await exportLearningAnalyticsKpiGaps(token, {
        policyId,
        semesterId,
      });
      downloadBlob(blob, fileName);
    } catch (e) {
      setError(e.message || '匯出缺口名單失敗');
    } finally {
      setExporting(false);
    }
  };

  const kpiDims = gapReport?.kpiSummary?.dimensions || [];
  const gapSummary = gapReport?.gaps?.summary;
  const gradeLabel = gapReport?.population?.gradeFilter?.label || '不限年級';
  const policyName = gapReport?.policy?.name || '—';

  return (
    <section className="la-zone la-zone--ops mb-4">
      <div className="la-zone__badge">A · 學期營運</div>
      <LearningAnalyticsPanelHeader
        title="學期營運 KPI"
        lead="依選定學期名冊與官方 KPI 政策計算達標／缺口。這裡不是分析快照的累積 B2。"
      />

      {!semesterId ? (
        <Alert variant="info" className="small mb-0">
          請在上方篩選條件選擇<strong>學期</strong>並按「套用篩選」，即可載入名冊分母的達標摘要與缺口人數。
          {' '}
          正式一鍵報表請至
          {' '}
          <Link to="/admin/learning-analytics/kpi-report">B2 KPI 報表</Link>
          。
        </Alert>
      ) : null}

      {semesterId && error ? (
        <Alert variant="danger" className="mb-2" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      ) : null}

      {semesterId && loading ? (
        <div className="text-muted d-flex align-items-center gap-2 py-3">
          <Spinner size="sm" animation="border" />
          載入 {semesterId} 學期營運 KPI…
        </div>
      ) : null}

      {semesterId && !loading && gapReport ? (
        <>
          <p className="small text-muted mb-3">
            學期 <strong>{gapReport.population?.semesterId}</strong>
            {' · '}
            政策「{policyName}」
            {' · '}
            年級 {gradeLabel}
            {' · '}
            分母 {formatNum(gapReport.population?.totalStudents)} 人
            {gapReport.population?.rosterStats?.excludedByGrade
              ? `（年級排除 ${formatNum(gapReport.population.rosterStats.excludedByGrade)}）`
              : ''}
          </p>

          <Row className="g-3">
            {kpiDims.map((dim) => (
              <Col md={3} sm={6} key={dim.id}>
                <MetricCard
                  label={`${dim.label} 達標率`}
                  value={formatPct(dim.rate)}
                  hint={`${formatNum(dim.passedCount)} / ${formatNum(gapReport.population?.totalStudents)} 人`}
                  tooltip="與 B2 KPI 報表同分母、同達標規則（非快照累積 B2）。"
                />
              </Col>
            ))}
            <Col md={3} sm={6}>
              <MetricCard
                label="未達標（任一單元）"
                value={formatNum(gapSummary?.notAttainedCount)}
                hint={formatPct(gapSummary?.notAttainedRate)}
                tooltip="名冊分母中，至少有一個官方達標單元未通過的人數。"
              />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard
                label="缺重測（僅 1 場）"
                value={formatNum(gapSummary?.missingRetestCount)}
                hint={formatPct(gapSummary?.missingRetestRate)}
                tooltip="政策成績時間窗內只有 1 場有效考試：有基線、尚無法算成長。"
              />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard
                label="無考試"
                value={formatNum(gapSummary?.noExamCount)}
                hint={formatPct(gapSummary?.noExamRate)}
                tooltip="政策成績時間窗內尚無有效考試場次。"
              />
            </Col>
          </Row>

          <div className="d-flex flex-wrap gap-2 mt-3">
            <Button
              as={Link}
              to={`/admin/learning-analytics/kpi-report`}
              variant="outline-primary"
              size="sm"
            >
              開啟正式 KPI 報表
            </Button>
            {canExport ? (
              <Button
                variant="primary"
                size="sm"
                disabled={exporting || !policyId}
                onClick={handleExportGaps}
              >
                {exporting ? '匯出中…' : '匯出缺口名單（Excel）'}
              </Button>
            ) : (
              <span className="small text-muted align-self-center">
                匯出缺口需具備學習成效分析匯出權限。
              </span>
            )}
          </div>
          <p className="small text-muted mt-2 mb-0">
            缺口 Excel 含：未達標／缺重測／無考試名單與全部學生明細；場次以英檢 attempts 計算，不是快照 retest_flag。
          </p>
        </>
      ) : null}
    </section>
  );
}
