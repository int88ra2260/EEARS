import React, { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
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
            本頁是研究附錄：用來檢查假設、資料分布與模型方向，不作為主管上呈或輔導點名依據。
            「各學期 B2+」為固定學期序列，不受系所等學生篩選。
          </Alert>

          <Row className="g-3 mt-1 la-bento-row la-bento-reveal">
            <Col lg={7}>
              <div className="la-panel la-bento-card">
                <LearningAnalyticsPanelHeader
                  title="參與時數與進步"
                  lead="橫軸是考前累積時數，縱軸是校正後進步。此圖只看分布形狀，不用來宣稱參與造成進步。"
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
                  lead="檢查不同系所的成長分布與離散程度；解讀前需確認樣本數與前後測覆蓋。"
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
                lead="依起始程度與資源參與粗估分層，只保留總量觀察；不輸出學生排名或點名清單。"
              />
              <Alert variant="warning" className="small py-2">
                請勿將下列人數解讀為「應優先投入／保證通過」。正式行動請使用 B2 KPI 缺口名單、缺重測與無考試名單。
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
              <LaFold label="為什麼不顯示學生排名？" className="mt-3">
                啟發式分層混合了起始程度、重測紀錄與粗略資源參與，適合做模型 sanity check，
                但不適合作為個別學生輔導順序。需要採取行動時，請回到 KPI 報表匯出未達標、缺重測、無考試名單。
              </LaFold>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
