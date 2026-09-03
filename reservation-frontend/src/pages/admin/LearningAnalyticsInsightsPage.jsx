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
import LaFold from '../../components/learningAnalytics/LaFold';
import MetricCard from '../../components/learningAnalytics/MetricCard';
import { getLearningAnalyticsInsights } from '../../services/learningAnalyticsService';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { LA_FILTER_INTRO_COHORT } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';

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
      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />
      <LearningAnalyticsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={applyFilters}
        onReset={resetFilters}
        loading={loading || !ready}
        filterOptions={meta?.filterOptions}
        matchingCaliperDefault={meta?.matchingCaliperDefault}
        snapshotOptions={meta?.snapshots}
        filterTitle="篩選條件"
        submitLabel="套用篩選"
        intro={LA_FILTER_INTRO_COHORT}
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} />

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : null}

      {!loading && data ? (
        <>
          <Alert variant="secondary" className="mt-3 small mb-0">
            本頁圖表多為觀察趨勢。
            「啟發式通過分層」屬實驗功能（固定先驗＋粗資源標記），不可作為輔導優先序或認證預測的正式依據。
            「各學期 B2+」為固定學期序列，不受系所等學生篩選。
          </Alert>

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
                  lead="跨學期名冊的 B2 以上比例（固定學期序列；不受上方系所／入學年度篩選）。"
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
                  title="資源對應技能（示意）"
                  lead="色塊為該資源「整體」平均原始分進步，對應到設定檔主技能格；不是該技能專屬成長矩陣。"
                  tooltip="後端以資源總 rawGrowthAverage 填入主技能格子，勿解讀為聽說讀寫各自的資源成效。"
                />
                <ResourceSkillHeatmap rows={data.resourceSkillHeatmap} />
              </div>
            </Col>
          </Row>

          {outlook ? (
            <div className="la-panel mt-3">
              <LearningAnalyticsPanelHeader
                title="啟發式通過分層（實驗）"
                lead="依起始程度與資源參與粗估分層。僅供探索，非正式預測模型。"
              />
              <Alert variant="warning" className="small py-2">
                請勿將下列人數解讀為「應優先投入／保證通過」的決策依據。
              </Alert>
              <Row className="g-3 la-bento-row">
                <Col xs={6} md={3}>
                  <MetricCard
                    label="尚未達 B2+"
                    value={outlook.notB2plusStudents}
                    tooltip="目前篩選中，還沒達到 B2 以上的學生人數。"
                  />
                </Col>
                <Col xs={6} md={3}>
                  <MetricCard
                    label="啟發式偏高"
                    value={outlook.buckets?.high ?? 0}
                    hint="粗估 ≥65%"
                    tooltip="啟發式分層結果，非正式通過機率。"
                  />
                </Col>
                <Col xs={6} md={3}>
                  <MetricCard
                    label="啟發式中間"
                    value={outlook.buckets?.medium ?? 0}
                    hint="粗估 40%–65%"
                  />
                </Col>
                <Col xs={6} md={3}>
                  <MetricCard
                    label="啟發式偏低"
                    value={outlook.buckets?.low ?? 0}
                    hint="粗估 &lt;40%"
                  />
                </Col>
              </Row>

              {outlook?.topProspects?.length ? (
                <LaFold label="展開實驗名單（前 10）" className="mt-3">
                  <p className="small text-muted mb-2">
                    名單依啟發式分數排序，僅供內部探索；不是輔導優先序清單。
                  </p>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>學號</th>
                          <th>系所</th>
                          <th className="text-end">啟發式分數</th>
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
                </LaFold>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
