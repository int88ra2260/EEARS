import React, { useCallback, useEffect, useState } from 'react';

import Alert from 'react-bootstrap/Alert';

import Form from 'react-bootstrap/Form';

import Spinner from 'react-bootstrap/Spinner';
import { getLearningAnalyticsCohorts } from '../../services/learningAnalyticsService';

import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';

import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';

import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';



const GROUP_OPTIONS = [

  { value: 'department', label: '系所' },

  { value: 'college', label: '學院' },

  { value: 'cohort', label: '入學年度' },

  { value: 'exposure_level', label: '資源參與量' },

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

            <div className="table-responsive">

              <table className="table table-sm align-middle">

                <thead>

                  <tr>

                    <th>群體</th>

                    <th className="text-end">人數</th>

                    <th className="text-end">B2+ 率</th>

                    <th className="text-end">重測率</th>

                    <th className="text-end">平均資源時數</th>

                    <th className="text-end" title="後測減前測的平均進步">實際進步</th>

                    <th className="text-end" title="扣掉起始程度差異後的進步">校正後進步</th>

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

              <div className="la-panel-title">有參與 vs 較少參與</div>

              <p className="small text-muted">

                比較考前時數 ≥10 小時與較少參與者的平均進步。用來對照，不是「參加造成進步」。

              </p>

              <div className="table-responsive">

                <table className="table table-sm align-middle">

                  <thead>

                    <tr>

                      <th>群體</th>

                      <th className="text-end">學生數</th>

                      <th className="text-end">成長樣本數</th>

                      <th className="text-end">實際進步</th>

                      <th className="text-end">校正後進步</th>

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

              <div className="la-panel-title">各技能進步</div>

              <div className="table-responsive">

                <table className="table table-sm align-middle">

                  <thead>

                    <tr>

                      <th>技能</th>

                      <th className="text-end">樣本數</th>

                      <th className="text-end">實際進步</th>

                      <th className="text-end">校正後進步</th>

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

