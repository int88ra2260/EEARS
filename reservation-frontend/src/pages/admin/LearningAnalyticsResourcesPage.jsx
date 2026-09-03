import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ESTIMATE_METHODS, LA_MIN_DISPLAY_SAMPLE, RESOURCE_TYPE_LABELS, SKILL_LABELS } from '../../components/learningAnalytics/learningAnalyticsCopy';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { LA_FILTER_INTRO_COHORT } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';

function resourceLabel(type) {
  return RESOURCE_TYPE_LABELS[type] || type;
}

function skillList(skills) {
  if (!Array.isArray(skills) || !skills.length) return '—';
  return skills.map((s) => SKILL_LABELS[s] || s).join('、');
}

function filterEstimateRows(rows, countKey, minN = LA_MIN_DISPLAY_SAMPLE) {
  return (rows || []).filter((row) => Number(row[countKey]) >= minN);
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
  const matched = useMemo(
    () => filterEstimateRows(data?.quasiCausalEstimates?.byResource, 'matchedPairs').slice(0, 8),
    [data]
  );
  const weighted = useMemo(
    () => filterEstimateRows(data?.propensityWeightedEstimates?.byResource, 'sampleSize').slice(0, 8),
    [data]
  );
  const aipw = useMemo(
    () => filterEstimateRows(data?.aipwEstimates?.byResource, 'sampleSize').slice(0, 8),
    [data]
  );
  const showAdvancedEstimates = matched.length > 0 || weighted.length > 0 || aipw.length > 0;

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
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}

      {!loading && data ? (
        <>
          <div className="la-panel mt-3">
            <LearningAnalyticsPanelHeader
              title={ESTIMATE_METHODS.descriptive.title}
              lead={ESTIMATE_METHODS.descriptive.lead}
              tooltip="有參加該資源、且有前後測的學生，其工具原始分進步平均。沒有扣掉背景差異；跨英檢工具不宜直接互比。"
            />
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>資源</th>
                    <th className="text-end">參與人數</th>
                    <th className="text-end">有前後測</th>
                    <th className="text-end">平均原始分進步</th>
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

          <div className="la-panel mt-3">
            <LearningAnalyticsPanelHeader
              title="進階觀察估計（實驗）"
              lead={`僅顯示樣本人數 ≥ ${LA_MIN_DISPLAY_SAMPLE} 的資源。Matching／IPW／AIPW 皆為觀察估計，不可解讀為「參加該資源就造成進步」。`}
            />
            {!showAdvancedEstimates ? (
              <Alert variant="secondary" className="small mb-0">
                目前篩選下沒有足夠樣本可顯示進階估計（門檻 {LA_MIN_DISPLAY_SAMPLE} 人）。
                請參考上方描述表，或放寬篩選後再試。
              </Alert>
            ) : (
              <>
                <Row className="g-3">
                  <Col lg={6}>
                    <div className="h-100">
                      <div className="fw-semibold small mb-1">{ESTIMATE_METHODS.matching.title}</div>
                      <p className="small text-muted mb-2">{ESTIMATE_METHODS.matching.lead}</p>
                      <EstimateTable
                        rows={matched}
                        countKey="matchedPairs"
                        emptyText="沒有達到樣本人數門檻的對照組結果。"
                      />
                    </div>
                  </Col>
                  <Col lg={6}>
                    <div className="h-100">
                      <div className="fw-semibold small mb-1">{ESTIMATE_METHODS.ipw.title}</div>
                      <p className="small text-muted mb-2">{ESTIMATE_METHODS.ipw.lead}</p>
                      <EstimateTable
                        rows={weighted}
                        countKey="sampleSize"
                        emptyText="沒有達到樣本人數門檻的加權結果。"
                      />
                    </div>
                  </Col>
                </Row>
                <div className="mt-3">
                  <div className="fw-semibold small mb-1">{ESTIMATE_METHODS.aipw.title}</div>
                  <p className="small text-muted mb-2">{ESTIMATE_METHODS.aipw.lead}</p>
                  <EstimateTable
                    rows={aipw}
                    countKey="sampleSize"
                    emptyText="沒有達到樣本人數門檻的綜合校正結果。"
                  />
                </div>
                <LaFold label="三種數字怎麼看？" className="mt-2">
                  正值代表「有參加者」平均進步較多。三種算法方向一致，比單一欄位更值得注意。
                  都不是保證參加就進步；樣本不足的列已隱藏。
                </LaFold>
              </>
            )}
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
