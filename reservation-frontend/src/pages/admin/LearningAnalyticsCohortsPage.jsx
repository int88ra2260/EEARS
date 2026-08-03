import React, { useCallback, useEffect, useState } from 'react';

import Alert from 'react-bootstrap/Alert';

import Form from 'react-bootstrap/Form';

import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';
import { getLearningAnalyticsCohorts } from '../../services/learningAnalyticsService';

import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';

import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import GrowthMetricsExplainer from '../../components/learningAnalytics/GrowthMetricsExplainer';

import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';



const GROUP_OPTIONS = [

  { value: 'department', label: '系所' },

  { value: 'college', label: '學院' },

  { value: 'cohort', label: '入學 cohort' },

  { value: 'exposure_level', label: '資源曝光等級' },

  { value: 'baseline_level', label: '起始能力' },

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



function formatGrowth(value) {

  const n = Number(value);

  if (!Number.isFinite(n)) return '—';

  return n.toFixed(1);

}



export default function LearningAnalyticsCohortsPage() {

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

  const [groupBy, setGroupBy] = useState('department');

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [data, setData] = useState(null);



  const load = useCallback(async () => {

    if (!ready) return;

    setLoading(true);

    setError('');

    try {

      const payload = await getLearningAnalyticsCohorts(token, { ...apiParams(), group_by: groupBy });

      setData(payload);

    } catch (e) {

      setData(null);

      setError(e.message || '載入失敗');

    } finally {

      setLoading(false);

    }

  }, [token, apiParams, groupBy, ready]);



  useEffect(() => {

    load();

  }, [load]);



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

      <Form.Group className="mt-3" style={{ maxWidth: 280 }}>

        <Form.Label className="small text-muted">分組維度</Form.Label>

        <Form.Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} disabled={loading}>

          {GROUP_OPTIONS.map((opt) => (

            <option key={opt.value} value={opt.value}>{opt.label}</option>

          ))}

        </Form.Select>

      </Form.Group>



      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}

      {loading ? (

        <div className="text-center py-5"><Spinner animation="border" /></div>

      ) : null}



      {!loading && data ? (

        <>

          <div className="la-panel mt-3">

            <div className="la-panel-title">群體比較（{data.totalStudents} 人）</div>

            <p className="small text-muted mb-2">{data.note}</p>

            <p className="small text-muted">

              成長區間樣本數：{data.totalGrowthEpisodes ?? 0}（僅含有前後測、可計算 GSE 增益者）

            </p>

            <p className="small mb-2">

              散點圖、熱圖與認證趨勢請至

              {' '}

              <Link to="/admin/learning-analytics/insights">決策支援</Link>

              。

            </p>

            <div className="table-responsive">

              <table className="table table-sm align-middle">

                <thead>

                  <tr>

                    <th>群體</th>

                    <th className="text-end">人數</th>

                    <th className="text-end">B2+ 率</th>

                    <th className="text-end">重測率</th>

                    <th className="text-end">平均資源時數</th>

                    <th className="text-end" title="GSE 原始增益平均">平均成長</th>

                    <th className="text-end" title="控制起始能力、系所與資料完整度後的估計">修正後成長</th>

                  </tr>

                </thead>

                <tbody>

                  {(data.rows || []).map((row) => (

                    <tr key={row.groupKey}>

                      <td className="fw-semibold">{row.groupKey}</td>

                      <td className="text-end">{row.students}</td>

                      <td className="text-end">{formatPct(row.b2plusRate)}</td>

                      <td className="text-end">{formatPct(row.retestRate)}</td>

                      <td className="text-end">{row.avgResourceHours}</td>

                      <td className="text-end">{formatGrowth(row.avgActualGseGrowth)}</td>

                      <td className="text-end">{formatGrowth(row.avgAdjustedGseGrowth)}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>



          {(data.participationComparison || []).length > 0 ? (

            <div className="la-panel mt-3">

              <div className="la-panel-title">參與組 vs 低／無參與（描述性）</div>

              <p className="small text-muted">

                比較「考前資源時數 ≥10 小時」與「低／無參與」學生的平均成長；此為觀察比較，不代表參與「造成」進步。

              </p>

              <div className="table-responsive">

                <table className="table table-sm align-middle">

                  <thead>

                    <tr>

                      <th>群體</th>

                      <th className="text-end">學生數</th>

                      <th className="text-end">成長樣本數</th>

                      <th className="text-end">平均成長</th>

                      <th className="text-end">修正後成長</th>

                    </tr>

                  </thead>

                  <tbody>

                    {data.participationComparison.map((row) => (

                      <tr key={row.key}>

                        <td>{row.label}</td>

                        <td className="text-end">{row.students}</td>

                        <td className="text-end">{row.growthEpisodeCount}</td>

                        <td className="text-end">{formatGrowth(row.avgActualGseGrowth)}</td>

                        <td className="text-end">{formatGrowth(row.avgAdjustedGseGrowth)}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

          ) : null}



          {(data.skillGrowthSummary || []).length > 0 ? (

            <div className="la-panel mt-3">

              <div className="la-panel-title">分技能成長摘要（全體）</div>

              <div className="table-responsive">

                <table className="table table-sm align-middle">

                  <thead>

                    <tr>

                      <th>技能</th>

                      <th className="text-end">樣本數</th>

                      <th className="text-end">平均成長</th>

                      <th className="text-end">修正後成長</th>

                    </tr>

                  </thead>

                  <tbody>

                    {data.skillGrowthSummary.map((row) => (

                      <tr key={row.skill}>

                        <td>{SKILL_LABELS[row.skill] || row.skill}</td>

                        <td className="text-end">{row.sampleSize}</td>

                        <td className="text-end">{formatGrowth(row.avgActualGseGrowth)}</td>

                        <td className="text-end">{formatGrowth(row.avgAdjustedGseGrowth)}</td>

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

