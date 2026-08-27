import React, { useCallback, useEffect, useMemo, useState } from 'react';

import Alert from 'react-bootstrap/Alert';

import Col from 'react-bootstrap/Col';

import Row from 'react-bootstrap/Row';

import Spinner from 'react-bootstrap/Spinner';

import {

  Bar,

  BarChart,

  CartesianGrid,

  Legend,

  PolarAngleAxis,

  PolarGrid,

  PolarRadiusAxis,

  Radar,

  RadarChart,

  ResponsiveContainer,

  Tooltip,

  XAxis,

  YAxis,

} from 'recharts';

import { getLearningAnalyticsSkills } from '../../services/learningAnalyticsService';

import GrowthEpisodeTable from '../../components/learningAnalytics/GrowthEpisodeTable';

import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';

import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';

import MetricCard from '../../components/learningAnalytics/MetricCard';
import GrowthMetricsExplainer from '../../components/learningAnalytics/GrowthMetricsExplainer';

import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';



const SKILL_LABELS = {

  listening: '聽力',

  reading: '閱讀',

  speaking: '口說',

  writing: '寫作',

};



function pct(value) {

  const n = Number(value);

  if (!Number.isFinite(n)) return '—';

  return `${Math.round(n * 100)}%`;

}



export default function LearningAnalyticsSkillsPage() {

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

      setData(await getLearningAnalyticsSkills(token, apiParams()));

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



  const growth = data?.growth;

  const chartData = useMemo(() => {

    const bySkill = growth?.bySkill || data?.growthEpisodes?.bySkill || [];

    const adjusted = data?.adjustedGrowth?.bySkill || [];

    const adjMap = new Map(adjusted.map((r) => [r.skill, r.adjustedGseGrowthAverage]));

    return bySkill

      .filter((r) => SKILL_LABELS[r.skill])

      .map((r) => ({

        skill: r.label || SKILL_LABELS[r.skill],

        raw: Number(r.rawGrowthAverage) || 0,

        adjusted: Number(adjMap.get(r.skill)) || 0,

        sampleSize: r.sampleSize,

        growthRatio: r.growthStudentRatio,

      }));

  }, [data, growth]);



  const radarData = useMemo(() => {

    return (growth?.radar || []).map((row) => ({

      skill: row.label || SKILL_LABELS[row.skill] || row.skill,

      raw: Number(row.rawGrowthAverage) || 0,

      adjusted: Number(row.adjustedGseGrowthAverage) || 0,

      fullMark: Math.max(

        50,

        ...chartData.map((r) => Math.abs(r.raw)),

        ...chartData.map((r) => Math.abs(r.adjusted))

      ),

    }));

  }, [growth, chartData]);



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

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}

      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}



      {!loading && data ? (

        <>

          <Row className="g-3 mt-1">

            <Col sm={6} lg={3}>

              <MetricCard

                label="有前後測人數"

                value={growth?.summary?.retestCount ?? data.growthEpisodes?.retestRows ?? 0}

                hint="才能計算個人進步"

              />

            </Col>

            <Col sm={6} lg={3}>

              <MetricCard

                label="明細筆數"

                value={growth?.episodes?.length ?? 0}

                hint="最多顯示 100 筆"

              />

            </Col>

            <Col sm={6} lg={6}>
              <div className="la-panel h-100 d-flex flex-column justify-content-center">
                <p className="small text-muted mb-2">時數只算考試前的課程／活動，考後不計入該次進步。</p>
                <GrowthMetricsExplainer />
              </div>
            </Col>

          </Row>



          <Row className="g-3 mt-1">

            <Col lg={7}>

              <div className="la-panel">

                <div className="la-panel-title">各技能進步</div>

                <div style={{ width: '100%', height: 320 }}>

                  <ResponsiveContainer>

                    <BarChart data={chartData}>

                      <CartesianGrid strokeDasharray="3 3" vertical={false} />

                      <XAxis dataKey="skill" />

                      <YAxis />

                      <Tooltip />

                      <Legend />

                      <Bar dataKey="raw" name="實際進步" fill="#94a3b8" radius={[4, 4, 0, 0]} />

                      <Bar dataKey="adjusted" name="校正後進步" fill="#2c5282" radius={[4, 4, 0, 0]} />

                    </BarChart>

                  </ResponsiveContainer>

                </div>

              </div>

            </Col>

            <Col lg={5}>

              <div className="la-panel">

                <div className="la-panel-title">有進步的學生比例</div>

                <ul className="list-unstyled small mb-0">

                  {chartData.map((row) => (

                    <li key={row.skill} className="border-bottom py-2 d-flex justify-content-between">

                      <span>

                        <strong>{row.skill}</strong>

                        <span className="text-muted ms-2">n={row.sampleSize}</span>

                      </span>

                      <span>{pct(row.growthRatio)}</span>

                    </li>

                  ))}

                </ul>

                {radarData.length > 0 ? (

                  <div style={{ width: '100%', height: 220 }} className="mt-3">

                    <ResponsiveContainer>

                      <RadarChart data={radarData}>

                        <PolarGrid />

                        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />

                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10 }} />

                        <Radar name="實際" dataKey="raw" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.25} />

                        <Radar name="校正後" dataKey="adjusted" stroke="#2c5282" fill="#2c5282" fillOpacity={0.2} />

                        <Legend />

                      </RadarChart>

                    </ResponsiveContainer>

                  </div>

                ) : null}

              </div>

            </Col>

          </Row>



          <Row className="g-3 mt-1">

            <Col xs={12}>

              <div className="la-panel">

                <div className="la-panel-title">前後測進步明細</div>

                <p className="small text-muted">

                  時數只算考試前的課程／活動。點「軌跡」看該生時間線。

                </p>

                <GrowthEpisodeTable episodes={growth?.episodes || data.growthEpisodes?.sampleEpisodes || []} />

              </div>

            </Col>

          </Row>

        </>

      ) : null}

    </div>

  );

}

