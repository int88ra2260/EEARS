import React, { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';
import CertificationTrendChart from '../../components/learningAnalytics/charts/CertificationTrendChart';
import CohortGrowthBoxplot from '../../components/learningAnalytics/charts/CohortGrowthBoxplot';
import ParticipationGrowthScatter from '../../components/learningAnalytics/charts/ParticipationGrowthScatter';
import ResourceSkillHeatmap from '../../components/learningAnalytics/charts/ResourceSkillHeatmap';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import GrowthMetricsExplainer from '../../components/learningAnalytics/GrowthMetricsExplainer';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import MetricCard from '../../components/learningAnalytics/MetricCard';
import { getLearningAnalyticsInsights } from '../../services/learningAnalyticsService';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';

export default function LearningAnalyticsInsightsPage() {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      const payload = await getLearningAnalyticsInsights(token, apiParams());
      setData(payload);
    } catch (e) {
      setData(null);
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, ready]);

  useEffect(() => {
    load();
  }, [load]);

  const outlook = data?.certificationOutlookSummary;

  return (
    <div>
      <LearningAnalyticsDataHealth meta={meta} error={metaError} />
      <div className="la-disclaimer mb-3">
        Phase 5 決策支援：圖表與 outlook 皆為觀察資料估計，不得解讀為因果證明或認證保證。
        Model Run 固化請至
        {' '}
        <Link to="/admin/learning-analytics/model-runs">模型執行紀錄</Link>
        。
      </div>

      <LearningAnalyticsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={applyFilters}
        onReset={resetFilters}
        loading={loading || !ready}
        filterOptions={meta?.filterOptions}
        matchingCaliperDefault={meta?.matchingCaliperDefault}
        filterTitle="決策支援篩選"
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} />
      <GrowthMetricsExplainer compact className="mt-3" />

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : null}

      {!loading && data ? (
        <>
          {outlook ? (
            <Row className="g-3 mt-1 la-bento-row la-bento-reveal">
              <Col xs={6} md={3}>
                <MetricCard
                  label="尚未 B2+"
                  value={outlook.notB2plusStudents}
                  hint="納入分析且未達 B2+"
                />
              </Col>
              <Col xs={6} md={3}>
                <MetricCard
                  label="Outlook 較佳"
                  value={outlook.buckets?.high ?? 0}
                  hint="估計通過機率 ≥65%"
                />
              </Col>
              <Col xs={6} md={3}>
                <MetricCard
                  label="需持續努力"
                  value={outlook.buckets?.medium ?? 0}
                  hint="40%–65%"
                />
              </Col>
              <Col xs={6} md={3}>
                <MetricCard
                  label="建議加強"
                  value={outlook.buckets?.low ?? 0}
                  hint="&lt;40%"
                />
              </Col>
            </Row>
          ) : null}

          <Row className="g-3 mt-1 la-bento-row la-bento-reveal">
            <Col lg={7}>
              <div className="la-panel la-bento-card">
                <div className="la-panel-title">資源時數 × 修正後成長</div>
                <p className="small text-muted la-panel-lead">
                  每點為一筆前後測成長區間；觀察參與量與進步的共變，非因果。
                  縱軸為 GSE 能力量尺變化。
                </p>
                <ParticipationGrowthScatter points={data.participationVsGrowth} />
              </div>
            </Col>
            <Col lg={5}>
              <div className="la-panel la-bento-card">
                <div className="la-panel-title">跨學期 B2+ 認證率</div>
                <CertificationTrendChart points={data.certificationTrend} />
              </div>
            </Col>
          </Row>

          <Row className="g-3 mt-1 la-bento-row la-bento-reveal">
            <Col lg={6}>
              <div className="la-panel la-bento-card">
                <div className="la-panel-title">系所成長分布（箱型近似）</div>
                <CohortGrowthBoxplot rows={data.cohortGrowthBoxplot} />
              </div>
            </Col>
            <Col lg={6}>
              <div className="la-panel la-bento-card">
                <div className="la-panel-title">資源 × 技能成長熱圖</div>
                <p className="small text-muted la-panel-lead">主影響技能上的描述性平均成長（GSE）。</p>
                <ResourceSkillHeatmap rows={data.resourceSkillHeatmap} />
              </div>
            </Col>
          </Row>

          {outlook?.topProspects?.length ? (
            <div className="la-panel mt-3">
              <div className="la-panel-title">Outlook 較佳學生（前 10，供行政追蹤）</div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>學號</th>
                      <th>系所</th>
                      <th className="text-end">估計通過機率</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {outlook.topProspects.map((row) => (
                      <tr key={row.studentId}>
                        <td className="fw-semibold">{row.studentId}</td>
                        <td>{row.department || '—'}</td>
                        <td className="text-end">{`${(row.probability * 100).toFixed(0)}%`}</td>
                        <td className="text-end">
                          <Link to={`/admin/learning-analytics/students/${encodeURIComponent(row.studentId)}`}>
                            學習軌跡
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small text-muted mb-0 mt-2">{outlook.disclaimer}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
