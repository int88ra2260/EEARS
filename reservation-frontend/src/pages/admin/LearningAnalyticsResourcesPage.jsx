import React, { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { getLearningAnalyticsResources } from '../../services/learningAnalyticsService';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import EvidenceQualityBadge from '../../components/learningAnalytics/EvidenceQualityBadge';
import LearningAnalyticsModelRunPanel from '../../components/learningAnalytics/LearningAnalyticsModelRunPanel';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import LaFold from '../../components/learningAnalytics/LaFold';
import { ESTIMATE_METHODS, RESOURCE_TYPE_LABELS, SKILL_LABELS } from '../../components/learningAnalytics/learningAnalyticsCopy';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';

function resourceLabel(type) {
  return RESOURCE_TYPE_LABELS[type] || type;
}

function skillList(skills) {
  if (!Array.isArray(skills) || !skills.length) return '—';
  return skills.map((s) => SKILL_LABELS[s] || s).join('、');
}

function EstimateTable({ rows, emptyText, countKey, effectKey = 'estimatedEffect' }) {
  if (!rows.length) {
    return <p className="small text-muted mb-0">{emptyText}</p>;
  }
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>資源</th>
            <th className="text-end">人數</th>
            <th className="text-end">估計效果</th>
            <th>資料</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.resourceType}>
              <td>{resourceLabel(row.resourceType)}</td>
              <td className="text-end">{row[countKey] ?? 0}</td>
              <td className="text-end">{row[effectKey] ?? '—'}</td>
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
  const matched = (data?.quasiCausalEstimates?.byResource || []).slice(0, 8);
  const weighted = (data?.propensityWeightedEstimates?.byResource || []).slice(0, 8);
  const aipw = (data?.aipwEstimates?.byResource || []).slice(0, 8);

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
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}

      {!loading && data ? (
        <>
          <div className="la-panel mt-3">
            <LearningAnalyticsPanelHeader
              title={ESTIMATE_METHODS.descriptive.title}
              lead={ESTIMATE_METHODS.descriptive.lead}
              tooltip="有參加該資源、且有前後測的學生，其進步分數平均。沒有扣掉背景差異。"
            />
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>資源</th>
                    <th className="text-end">參與人數</th>
                    <th className="text-end">有前後測</th>
                    <th className="text-end">平均進步</th>
                    <th>主要技能</th>
                    <th>資料</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? rows.map((row) => (
                    <tr key={row.resourceType}>
                      <td className="fw-semibold">{resourceLabel(row.resourceType)}</td>
                      <td className="text-end">{row.participantCount ?? '—'}</td>
                      <td className="text-end">{row.growthSampleSize ?? '—'}</td>
                      <td className="text-end">{row.rawGrowthAverage ?? '—'}</td>
                      <td className="small">{skillList(row.mainSkills)}</td>
                      <td><EvidenceQualityBadge level={row.evidenceLevel} /></td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="text-muted text-center py-4">尚無資源資料</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Row className="g-3 mt-1">
            <Col lg={6}>
              <div className="la-panel h-100">
                <LearningAnalyticsPanelHeader
                  title={ESTIMATE_METHODS.matching.title}
                  lead={ESTIMATE_METHODS.matching.lead}
                />
                <EstimateTable
                  rows={matched}
                  countKey="matchedPairs"
                  emptyText="目前無法建立對照組（前後測或對照學生不足）。"
                />
              </div>
            </Col>
            <Col lg={6}>
              <div className="la-panel h-100">
                <LearningAnalyticsPanelHeader
                  title={ESTIMATE_METHODS.ipw.title}
                  lead={ESTIMATE_METHODS.ipw.lead}
                />
                <EstimateTable
                  rows={weighted}
                  countKey="sampleSize"
                  emptyText="目前無法做加權比較。"
                />
              </div>
            </Col>
          </Row>

          <div className="la-panel mt-3">
            <LearningAnalyticsPanelHeader
              title={ESTIMATE_METHODS.aipw.title}
              lead={ESTIMATE_METHODS.aipw.lead}
            />
            <EstimateTable
              rows={aipw}
              countKey="sampleSize"
              emptyText="目前無法計算綜合校正效果。"
            />
            <LaFold label="三種數字怎麼看？" className="mt-2">
              正值代表「有參加者」平均進步較多。三種算法方向一致，比單一欄位更值得注意。
              都不是保證參加就進步。
            </LaFold>
          </div>

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
