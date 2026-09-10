import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';
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

function formatDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
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
            <th className="text-end">估計差</th>
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
  const [showAdvancedEstimatesUi, setShowAdvancedEstimatesUi] = useState(false);

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

  const rows = useMemo(() => {
    const list = [...(data?.resourceEffectiveness || [])];
    list.sort((a, b) => {
      const g = (Number(b.growthSampleSize) || 0) - (Number(a.growthSampleSize) || 0);
      if (g !== 0) return g;
      return (Number(b.participantCount) || 0) - (Number(a.participantCount) || 0);
    });
    return list;
  }, [data?.resourceEffectiveness]);

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
  const hasAdvancedEstimateData = matched.length > 0 || weighted.length > 0 || aipw.length > 0;

  return (
    <div>
      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />

      <LearningAnalyticsPanelHeader
        title="資源效益"
        lead="依資源類型（English Table、EAP、通識英文等）看參與規模與前後測原始分進步。預設只看描述統計；進階對照估計請手動開啟。"
      />

      <LaFold label="如何閱讀本頁" className="mb-3">
        <ol className="small mb-2 ps-3">
          <li className="mb-1">
            預設只看<strong>描述表</strong>：誰參加多、有多少人能算成長、平均原始分進步多少。
          </li>
          <li className="mb-1">
            「有前後測」太少時不要解讀平均；跨英檢工具的原始分<strong>不宜直接互比</strong>。
          </li>
          <li className="mb-1">
            Matching／IPW／AIPW 是觀察估計，用來對照「背景相近但沒參加者」——
            <strong>不是</strong>
            「參加就造成進步」。預設隱藏，需要時再開。
          </li>
          <li className="mb-1">
            要盯某一門課／老師／活動，請到
            {' '}
            <Link to="/admin/learning-analytics/offerings">課／師／活動</Link>
            ；正式達標請到
            {' '}
            <Link to="/admin/learning-analytics/kpi-report">B2 KPI 報表</Link>
            。
          </li>
        </ol>
      </LaFold>

      <Alert variant="secondary" className="small py-2">
        <strong>非因果。</strong>
        {' '}
        數字高不代表該資源類型保證有效；進階估計同樣不可當開課／砍課依據。
      </Alert>

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

      <div className="d-flex flex-wrap gap-3 align-items-center mt-3">
        <Form.Check
          type="switch"
          id="la-resources-advanced-estimates"
          label="顯示進階觀察估計（Matching／IPW／AIPW）"
          checked={showAdvancedEstimatesUi}
          onChange={(e) => setShowAdvancedEstimatesUi(e.target.checked)}
        />
        <span className="small text-muted">
          {showAdvancedEstimatesUi ? '已顯示進階區' : '進階估計已隱藏（建議多數場合維持關閉）'}
        </span>
      </div>

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}

      {!loading && data ? (
        <>
          <div className="la-panel mt-3">
            <LearningAnalyticsPanelHeader
              title="資源類型對照（描述）"
              lead={ESTIMATE_METHODS.descriptive.lead}
              tooltip="有參加該資源、且有前後測的學生，其工具原始分進步平均。沒有扣掉背景差異；跨英檢工具不宜直接互比。"
            />
            <p className="small text-muted mb-3">
              預設主指標：參與人數、有前後測、平均原始分進步。列依「有前後測」人數排序。
            </p>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 la-resources-table">
                <thead>
                  <tr>
                    <th>資源類型</th>
                    <th className="text-end" title="曾參與該類資源的學生數">參與人數</th>
                    <th className="text-end" title="有可配對前後測、能算進步的人數">有前後測</th>
                    <th
                      className="text-end"
                      title="同測原始分進步平均；跨工具不宜直接互比"
                    >
                      平均原始分進步
                    </th>
                    <th className="d-none d-md-table-cell">主要技能</th>
                    <th>資料完整度</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? rows.map((row) => (
                    <tr key={row.resourceType}>
                      <td className="fw-semibold">{resourceLabel(row.resourceType)}</td>
                      <td className="text-end">{row.participantCount ?? '—'}</td>
                      <td className="text-end">{row.growthSampleSize ?? '—'}</td>
                      <td className="text-end fw-semibold">{formatDelta(row.rawGrowthAverage)}</td>
                      <td className="small d-none d-md-table-cell">{skillList(row.mainSkills)}</td>
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

          {showAdvancedEstimatesUi ? (
            <>
              <div className="la-panel mt-3 la-zone la-zone--observe">
                <div className="la-zone__badge">進階 · 實驗</div>
                <LearningAnalyticsPanelHeader
                  title="進階觀察估計"
                  lead={`僅顯示樣本人數 ≥ ${LA_MIN_DISPLAY_SAMPLE} 的資源。Matching／IPW／AIPW 皆為觀察估計，不可解讀為「參加該資源就造成進步」。`}
                />
                {!hasAdvancedEstimateData ? (
                  <Alert variant="secondary" className="small mb-0">
                    目前篩選下沒有足夠樣本可顯示進階估計（門檻 {LA_MIN_DISPLAY_SAMPLE} 人）。
                    請參考上方描述表，或放寬篩選後再試。
                  </Alert>
                ) : (
                  <>
                    <Alert variant="warning" className="small py-2">
                      三種方法並陳是為了看方向是否大致一致，不是選一個最大的當「真相」。
                      欄位已改稱「估計差」，避免讀成保證效果。
                    </Alert>
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
                      正值代表「有參加者」相對對照／加權後平均進步較多。三種算法方向一致，比單一欄位更值得注意。
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
          ) : (
            <p className="small text-muted mt-3 mb-0">
              進階觀察估計與「儲存分析紀錄」已隱藏。若需對照 Matching／IPW／AIPW 或固化結果，請開啟上方開關。
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
