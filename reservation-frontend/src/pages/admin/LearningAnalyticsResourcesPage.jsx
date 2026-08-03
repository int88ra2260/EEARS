import React, { useCallback, useEffect, useState } from 'react';

import Alert from 'react-bootstrap/Alert';

import Col from 'react-bootstrap/Col';

import Row from 'react-bootstrap/Row';

import Spinner from 'react-bootstrap/Spinner';

import { getLearningAnalyticsResources } from '../../services/learningAnalyticsService';

import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';

import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import GrowthMetricsExplainer from '../../components/learningAnalytics/GrowthMetricsExplainer';

import EvidenceQualityBadge from '../../components/learningAnalytics/EvidenceQualityBadge';

import LearningAnalyticsModelRunPanel from '../../components/learningAnalytics/LearningAnalyticsModelRunPanel';

import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';



const RESOURCE_LABELS = {

  GE: '通識英文',

  EAP: 'EAP',

  ESP: 'ESP',

  ENGLISH_TABLE: 'English Table',

  ENGLISH_CLUB: 'English Club',

  JOB_TALK: 'Job Talk',

  INTERNATIONAL_FORUM: 'International Forum',

  WORKSHOP: '工作坊',

  TUTOR_IN_PERSON: '實體一對一諮詢',

  TUTOR_ONLINE: '線上一對一諮詢',

};



function QuasiCausalTable({ estimates }) {

  const rows = Array.isArray(estimates?.byResource) ? estimates.byResource.slice(0, 8) : [];

  if (!rows.length) {

    return <p className="small text-muted mb-0">尚無可建立背景相近比較組的資料。</p>;

  }

  return (

    <div className="table-responsive">

      <table className="table table-sm align-middle mb-0">

        <thead>

          <tr>

            <th>資源</th>

            <th className="text-end">參與</th>

            <th className="text-end">匹配組</th>

            <th className="text-end">估計效果</th>

            <th>證據</th>

          </tr>

        </thead>

        <tbody>

          {rows.map((row) => (

            <tr key={row.resourceType}>

              <td>{RESOURCE_LABELS[row.resourceType] || row.resourceType}</td>

              <td className="text-end">{row.treatedCount ?? 0}</td>

              <td className="text-end">{row.matchedPairs ?? 0}</td>

              <td className="text-end">{row.estimatedEffect ?? '—'}</td>

              <td><EvidenceQualityBadge level={row.evidenceLevel} /></td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}



function AipwEstimateTable({ estimates }) {
  const rows = Array.isArray(estimates?.byResource) ? estimates.byResource.slice(0, 8) : [];
  if (!rows.length) {
    return <p className="small text-muted mb-0">尚無 AIPW doubly robust 估計。</p>;
  }
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>資源</th>
            <th className="text-end">樣本</th>
            <th className="text-end">AIPW 效應</th>
            <th>證據</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.resourceType}>
              <td>{RESOURCE_LABELS[row.resourceType] || row.resourceType}</td>
              <td className="text-end">{row.sampleSize ?? 0}</td>
              <td className="text-end">{row.estimatedEffect ?? '—'}</td>
              <td><EvidenceQualityBadge level={row.evidenceLevel} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeightedEstimateTable({ estimates }) {

  const rows = Array.isArray(estimates?.byResource) ? estimates.byResource.slice(0, 8) : [];

  if (!rows.length) {

    return <p className="small text-muted mb-0">尚無 propensity-style weighting 估計。</p>;

  }

  return (

    <div className="table-responsive">

      <table className="table table-sm align-middle mb-0">

        <thead>

          <tr>

            <th>資源</th>

            <th className="text-end">樣本</th>

            <th className="text-end">估計效果</th>

            <th>證據</th>

          </tr>

        </thead>

        <tbody>

          {rows.map((row) => (

            <tr key={row.resourceType}>

              <td>{RESOURCE_LABELS[row.resourceType] || row.resourceType}</td>

              <td className="text-end">{row.sampleSize ?? 0}</td>

              <td className="text-end">{row.estimatedEffect ?? '—'}</td>

              <td><EvidenceQualityBadge level={row.evidenceLevel} /></td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}



export default function LearningAnalyticsResourcesPage() {

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

      setData(await getLearningAnalyticsResources(token, apiParams()));

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



  const rows = data?.resourceEffectiveness || [];



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

      />

      <LearningAnalyticsActiveFilters filters={appliedFilters} />
      <GrowthMetricsExplainer compact className="mt-3" />

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}

      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}



      {!loading && data ? (

        <>

          <div className="la-panel mt-3">

            <div className="la-panel-title">課程與活動效益（觀察資料）</div>

            <p className="small text-muted mb-3">

              {data.estimatePolicy?.estimateTypes?.descriptive || '描述性趨勢；不作因果宣稱。'}

            </p>

            <div className="table-responsive">

              <table className="table table-sm align-middle">

                <thead>

                  <tr>

                    <th>資源</th>

                    <th className="text-end">參與人數</th>

                    <th className="text-end">成長樣本</th>

                    <th className="text-end">平均成長</th>

                    <th>主要技能</th>

                    <th>證據</th>

                  </tr>

                </thead>

                <tbody>

                  {rows.length ? rows.map((row) => (

                    <tr key={row.resourceType}>

                      <td className="fw-semibold">{RESOURCE_LABELS[row.resourceType] || row.resourceType}</td>

                      <td className="text-end">{row.participantCount ?? '—'}</td>

                      <td className="text-end">{row.growthSampleSize ?? '—'}</td>

                      <td className="text-end">{row.rawGrowthAverage ?? '—'}</td>

                      <td className="small">{(row.mainSkills || []).join(', ') || '—'}</td>

                      <td><EvidenceQualityBadge level={row.evidenceLevel} /></td>

                    </tr>

                  )) : (

                    <tr><td colSpan={6} className="text-muted text-center py-4">尚無資源效益資料</td></tr>

                  )}

                </tbody>

              </table>

            </div>

          </div>



          <Row className="g-3 mt-1">

            <Col lg={6}>

              <div className="la-panel h-100">

                <div className="la-panel-title">背景相近比較組估計</div>

                <p className="small text-muted">觀察資料 matched comparison（v2：logistic PS + Austin caliper）；非因果證明。</p>

                <QuasiCausalTable estimates={data.quasiCausalEstimates} />

              </div>

            </Col>

            <Col lg={6}>

              <div className="la-panel h-100">

                <div className="la-panel-title">Propensity-style Weighting</div>

                <p className="small text-muted">輔助檢查（v2：logistic PS stabilized IPW）。</p>

                <WeightedEstimateTable estimates={data.propensityWeightedEstimates} />

              </div>

            </Col>

          </Row>

          <Row className="g-3 mt-1">
            <Col lg={12}>
              <div className="la-panel h-100">
                <div className="la-panel-title">AIPW Doubly Robust 估計</div>
                <p className="small text-muted">第三種輔助估計；請與上方 matching / IPW 交叉比對，仍非因果證明。</p>
                <AipwEstimateTable estimates={data.aipwEstimates} />
              </div>
            </Col>
          </Row>



          <LearningAnalyticsModelRunPanel

            token={token}

            apiParams={apiParams}

            disabled={loading || !ready}

          />

        </>

      ) : null}

    </div>

  );

}

