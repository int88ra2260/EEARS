import React, { useCallback, useEffect, useState } from 'react';

import Alert from 'react-bootstrap/Alert';

import Form from 'react-bootstrap/Form';

import Spinner from 'react-bootstrap/Spinner';
import { getLearningAnalyticsCohorts } from '../../services/learningAnalyticsService';

import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';

import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';

import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import ColumnHead, { HEAD } from '../../components/learningAnalytics/ColumnHead';
import { COHORT_COMPARISON_FILTER_KEYS, LA_FILTER_INTRO_COHORTS } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';



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

function formatSample(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-TW');
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

    withWorkingSet,

    token,

  } = useLearningAnalyticsBootstrap({ scopeKeys: COHORT_COMPARISON_FILTER_KEYS });

  const [groupBy, setGroupBy] = useState('department');

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [data, setData] = useState(null);



  const load = useCallback(async () => {

    if (!ready) return;

    setLoading(true);

    setError('');

    try {

      const payload = await getLearningAnalyticsCohorts(token, withWorkingSet({ ...apiParams(), group_by: groupBy }));

      setData(payload);

    } catch (e) {

      setData(null);

      setError(e.message || '載入失敗');

    } finally {

      setLoading(false);

    }

  }, [token, apiParams, withWorkingSet, groupBy, ready]);



  useEffect(() => {

    load();

  }, [load]);



  return (

    <div>

      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />

      <LearningAnalyticsPageFrame
        title="系所比較"
        showWorkingSet
        workingSetHere="cohorts"
        question="依系所或入學年，看學生人數、英檢覆蓋與前後測樣本差在哪。"
        scope="分析快照裡的學生。怎麼切只改表格分組，不另算一套人。"
        howToRead={(
          <ul className="small mb-0 ps-3">
            <li className="mb-1">先套用學院、系所或入學年，再用怎麼切決定每一列是系所還是入學年。</li>
            <li>人數少的列先不要互比平均。這頁看的是分布差異，不是學期 B2 KPI。</li>
          </ul>
        )}
      >
      <LearningAnalyticsFilters

        filters={filters}

        onChange={setFilters}

        onSubmit={applyFilters}

        onReset={resetFilters}

        loading={loading || !ready}

        filterOptions={meta?.filterOptions}
        matchingCaliperDefault={meta?.matchingCaliperDefault}
        snapshotOptions={meta?.snapshots}
        visibleKeys={COHORT_COMPARISON_FILTER_KEYS}
        showAdvanced={false}
        groupSnapshots
        intro={LA_FILTER_INTRO_COHORTS}

      />

      <LearningAnalyticsActiveFilters filters={appliedFilters} visibleKeys={COHORT_COMPARISON_FILTER_KEYS} />

      <Form.Group className="mt-3" style={{ maxWidth: 280 }}>

        <Form.Label className="small text-muted">怎麼切</Form.Label>

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

                    <th><ColumnHead {...HEAD.group} /></th>

                    <th className="text-end">學生人數</th>

                    <th className="text-end"><ColumnHead {...HEAD.b2Rate} /></th>

                    <th className="text-end"><ColumnHead {...HEAD.retestRate} /></th>

                    <th className="text-end"><ColumnHead {...HEAD.avgResourceHours} /></th>

                    <th className="text-end"><ColumnHead {...HEAD.growthEpisodes} /></th>

                    <th className="text-end"><ColumnHead {...HEAD.actualGse} /></th>

                    <th className="text-end"><ColumnHead {...HEAD.beyondExpectedNote} /></th>

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

                      <td className="text-end">{formatSample(row.growthEpisodeCount ?? row.sampleSize)}</td>

                      <td className="text-end">{formatGrowth(row.avgActualGseGrowth)}</td>

                      <td className="text-end text-muted">{formatGrowth(row.avgAdjustedGseGrowth)}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>



          {(data.participationComparison || []).length > 0 ? (

            <div className="la-panel mt-3">

              <div className="la-panel-title">參與量對照（輔助觀察）</div>

              <p className="small text-muted">

                比較考前時數 ≥10 小時與較少參與者的前後測樣本。這裡只幫忙找值得追查的群體，不用來宣稱參與造成進步。

              </p>

              <div className="table-responsive">

                <table className="table table-sm align-middle">

                  <thead>

                    <tr>

                      <th><ColumnHead {...HEAD.group} /></th>

                      <th className="text-end">學生人數</th>

                      <th className="text-end"><ColumnHead {...HEAD.growthEpisodes} /></th>

                      <th className="text-end"><ColumnHead {...HEAD.actualGse} /></th>

                      <th className="text-end"><ColumnHead {...HEAD.beyondExpectedNote} /></th>

                    </tr>

                  </thead>

                  <tbody>

                    {data.participationComparison.map((row) => (

                      <tr key={row.key}>

                        <td>{row.label}</td>

                        <td className="text-end">{row.students}</td>

                        <td className="text-end">{row.growthEpisodeCount}</td>

                        <td className="text-end">{formatGrowth(row.avgActualGseGrowth)}</td>

                        <td className="text-end text-muted">{formatGrowth(row.avgAdjustedGseGrowth)}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

          ) : null}



          {(data.skillGrowthSummary || []).length > 0 ? (

            <div className="la-panel mt-3">

              <div className="la-panel-title">各技能前後測樣本</div>

              <div className="table-responsive">

                <table className="table table-sm align-middle">

                  <thead>

                    <tr>

                      <th>技能</th>

                      <th className="text-end"><ColumnHead {...HEAD.growthEpisodes} /></th>

                      <th className="text-end"><ColumnHead {...HEAD.actualGse} /></th>

                      <th className="text-end"><ColumnHead {...HEAD.beyondExpectedNote} /></th>

                    </tr>

                  </thead>

                  <tbody>

                    {data.skillGrowthSummary.map((row) => (

                      <tr key={row.skill}>

                        <td>{SKILL_LABELS[row.skill] || row.skill}</td>

                        <td className="text-end">{row.sampleSize}</td>

                        <td className="text-end">{formatGrowth(row.avgActualGseGrowth)}</td>

                        <td className="text-end text-muted">{formatGrowth(row.avgAdjustedGseGrowth)}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

          ) : null}

        </>

      ) : null}

      </LearningAnalyticsPageFrame>

    </div>

  );

}

