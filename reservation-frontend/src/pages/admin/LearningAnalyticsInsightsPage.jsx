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
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
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
      <LearningAnalyticsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={applyFilters}
        onReset={resetFilters}
        loading={loading || !ready}
        filterOptions={meta?.filterOptions}
        matchingCaliperDefault={meta?.matchingCaliperDefault}
        filterTitle="篩選條件"
        submitLabel="套用篩選"
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} />

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
                  label="尚未達 B2+"
                  value={outlook.notB2plusStudents}
                  tooltip="目前篩選中，還沒達到 B2 以上的學生人數。"
                />
              </Col>
              <Col xs={6} md={3}>
                <MetricCard
                  label="通過機會較高"
                  value={outlook.buckets?.high ?? 0}
                  hint="估計 ≥65%"
                  tooltip="依起始程度與資源效果校正後的通過機會。僅供優先關注，不是認證保證。"
                />
              </Col>
              <Col xs={6} md={3}>
                <MetricCard
                  label="再加強可期"
                  value={outlook.buckets?.medium ?? 0}
                  hint="40%–65%"
                />
              </Col>
              <Col xs={6} md={3}>
                <MetricCard
                  label="建議優先投入"
                  value={outlook.buckets?.low ?? 0}
                  hint="低於 40%"
                />
              </Col>
            </Row>
          ) : null}

          <Row className="g-3 mt-1 la-bento-row la-bento-reveal">
            <Col lg={7}>
              <div className="la-panel la-bento-card">
                <LearningAnalyticsPanelHeader
                  title="參與時數與進步"
                  lead="橫軸是考前累積時數，縱軸是校正後進步。點愈右上，參與多且進步也多。"
                />
                <ParticipationGrowthScatter points={data.participationVsGrowth} />
              </div>
            </Col>
            <Col lg={5}>
              <div className="la-panel la-bento-card">
                <LearningAnalyticsPanelHeader
                  title="各學期 B2+ 通過率"
                  lead="跨學期名冊的 B2 以上比例。"
                />
                <CertificationTrendChart points={data.certificationTrend} />
              </div>
            </Col>
          </Row>

          <Row className="g-3 mt-1 la-bento-row la-bento-reveal">
            <Col lg={6}>
              <div className="la-panel la-bento-card">
                <LearningAnalyticsPanelHeader
                  title="系所進步分布"
                  lead="箱子愈高代表該系所學生進步幅度愈大。"
                />
                <CohortGrowthBoxplot rows={data.cohortGrowthBoxplot} />
              </div>
            </Col>
            <Col lg={6}>
              <div className="la-panel la-bento-card">
                <LearningAnalyticsPanelHeader
                  title="資源對應技能"
                  lead="該資源主要訓練技能上的平均進步。顏色愈深進步愈多。"
                />
                <ResourceSkillHeatmap rows={data.resourceSkillHeatmap} />
              </div>
            </Col>
          </Row>

          {outlook?.topProspects?.length ? (
            <div className="la-panel mt-3">
              <LearningAnalyticsPanelHeader
                title="通過機會較高的學生（前 10）"
                lead="可優先追蹤輔導。機會是估計值，不是保證會通過。"
              />
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>學號</th>
                      <th>系所</th>
                      <th className="text-end">估計通過機會</th>
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
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
