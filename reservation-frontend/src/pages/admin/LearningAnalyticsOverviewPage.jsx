import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';
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
import { getLearningAnalyticsOverview } from '../../services/learningAnalyticsService';
import MetricCard from '../../components/learningAnalytics/MetricCard';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import LearningAnalyticsOverviewGuide from '../../components/learningAnalytics/LearningAnalyticsOverviewGuide';
import GrowthMetricsExplainer from '../../components/learningAnalytics/GrowthMetricsExplainer';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import EvidenceQualityBadge from '../../components/learningAnalytics/EvidenceQualityBadge';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
  interaction: '互動',
  mediation: '調整',
  overall: '整體',
};

const EVIDENCE_QUALITY_USER_LABELS = {
  high: '高（英檢與參與紀錄較完整）',
  medium: '中',
  medium_low: '中低',
  low: '低（可參考但解讀宜保守）',
};

function formatPct(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function formatNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('zh-TW');
}

export default function LearningAnalyticsOverviewPage() {
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
    semesterFromUrl,
  } = useLearningAnalyticsBootstrap();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      const payload = await getLearningAnalyticsOverview(token, apiParams());
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

  const headline = data?.headline || {};
  const cefrChart = useMemo(() => {
    const baseline = data?.cefrDistribution?.baseline || [];
    const current = data?.cefrDistribution?.currentBest || [];
    const levels = [...new Set([
      ...baseline.map((r) => r.level),
      ...current.map((r) => r.level),
    ])].filter((l) => l !== 'UNKNOWN');
    return levels.map((level) => ({
      level,
      baseline: baseline.find((r) => r.level === level)?.count || 0,
      current: current.find((r) => r.level === level)?.count || 0,
    }));
  }, [data]);

  const skillRadar = useMemo(() => (
    (data?.skillGrowth || []).map((row) => ({
      skill: SKILL_LABELS[row.skill] || row.skill,
      adjusted: Number(row.adjustedGrowthAverage) || 0,
      raw: Number(row.rawGrowthAverage) || 0,
    }))
  ), [data]);

  const resourceChart = useMemo(() => (
    (data?.resourceParticipation || []).slice(0, 8).map((row) => ({
      name: row.label,
      hours: row.hours,
    }))
  ), [data]);

  const certSkills = data?.certification?.skills;
  const filterHasNoMatch = data?.hasData === false && meta?.hasAnalyticData;

  return (
    <div>
      <LearningAnalyticsDataHealth meta={meta} error={metaError} userFriendly />
      <LearningAnalyticsOverviewGuide />
      <GrowthMetricsExplainer compact />
      {(semesterFromUrl || filters.semester) ? (
        <Alert variant="light" className="small py-2 mb-3 border">
          您是從學習歷程儀表板進入？
          {' '}
          <Link to={`/admin/learning-journey?semester=${encodeURIComponent(filters.semester || semesterFromUrl)}`}>
            返回該學期營運總覽（{filters.semester || semesterFromUrl}）
          </Link>
        </Alert>
      ) : null}
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
        showAdvanced={false}
        intro="選擇想觀察的學生群體（例如特定 cohort、系所或起始英語能力）。「起始英語能力」主要依學測英文成績推估；「英語資源參與量」指考前累積的課程與活動時數。"
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} />

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
          <div className="text-muted mt-2 small">正在依您套用的條件載入圖表與指標…</div>
        </div>
      ) : null}

      {!loading && data && !data.hasData ? (
        <Alert variant={filterHasNoMatch ? 'info' : 'warning'} className="mt-3">
          <div className="fw-semibold mb-1">
            {filterHasNoMatch ? '目前篩選條件下沒有符合的學生' : '尚無可顯示的分析資料'}
          </div>
          <div>{data.emptyStateHint}</div>
          {!filterHasNoMatch ? (
            <div className="small mt-2">
              請至後台「英語學習歷程 → 學習歷程維運」執行「背景重建（全部）」。
              {' '}
              <Link to="/admin/learning-journey/operations">前往維運頁面 →</Link>
            </div>
          ) : (
            <div className="small mt-2 text-muted">
              建議放寬或清除部分篩選（例如起始英語能力、參與量），再按「套用篩選」重試。
            </div>
          )}
        </Alert>
      ) : null}

      {!loading && data?.hasData && (filters.semester || semesterFromUrl) ? (
        <Alert variant="info" className="mt-3 small mb-0">
          學期
          <strong className="mx-1">{filters.semester || semesterFromUrl}</strong>
          {data.certification?.skills
            ? '：下方額外顯示該學期名冊學生，在四項技能上達 B2 以上的認證通過率（與上方全域指標分開計算）。'
            : (data.certification?.note || '：此學期名冊資料不足，僅顯示不依學期切分的整體指標。')}
        </Alert>
      ) : null}

      {!loading && data?.hasData ? (
        <>
          <p className="small text-muted mt-3 mb-2">
            以下摘要依<strong>已套用</strong>的篩選條件計算；指標旁的 ⓘ 可查看定義。
          </p>
          <Row className="g-3">
            <Col md={3} sm={6}>
              <MetricCard
                label="納入分析的學生"
                value={formatNum(headline.studentsInAnalysis)}
                tooltip="符合目前篩選條件、且已納入成效分析摘要的學生人數。"
              />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard
                label="可算成長的學生"
                value={formatNum(headline.studentsWithMultipleExams)}
                hint={`其中曾重測 ${formatNum(headline.studentsWithRetest)} 人`}
                tooltip="至少有兩次有效英檢紀錄，系統才能計算個人進步幅度（含 BESTEP 多梯次等）。"
              />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard
                label="B2 以上達標率"
                value={formatPct(headline.b2plusRate)}
                hint={`${formatNum(headline.b2plusCount)} 人`}
                tooltip="依每位學生歷史最佳技能成績，CEFR 達 B2 或以上者所占比例。"
              />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard
                label="平均能力成長（校正後）"
                value={headline.averageAdjustedGseGrowth ?? '—'}
                hint="GSE 能力量尺，愈高代表進步愈多"
                tooltip="在控制起始英語能力與資料完整度後，估計的平均進步幅度。用於群體比較，不代表單一課程的因果效果。"
              />
            </Col>
          </Row>

          {certSkills ? (
            <Row className="g-3 mt-1">
              <Col xs={12}>
                <LearningAnalyticsPanelHeader
                  title={`${data.certification.semesterId} 學期 · 四技能 B2+ 認證通過率`}
                  lead={`依該學期名冊${data.certification.totalStudents != null ? `（共 ${data.certification.totalStudents} 人）` : ''}，統計各技能達 B2 以上的比例。`}
                />
              </Col>
              {Object.entries(certSkills).map(([skill, cell]) => (
                <Col md={3} sm={6} key={skill}>
                  <MetricCard
                    label={`${SKILL_LABELS[skill] || skill} 達 B2+`}
                    value={formatPct(cell?.rate)}
                    hint={cell?.count != null && data.certification.totalStudents
                      ? `${cell.count} / ${data.certification.totalStudents} 人`
                      : ''}
                  />
                </Col>
              ))}
            </Row>
          ) : null}

          <Row className="g-3 mt-2">
            <Col lg={6}>
              <div className="la-panel">
                <LearningAnalyticsPanelHeader
                  title="英語等級分布"
                  lead="比較學生「入學起點」與「目前最佳英檢成績」的 CEFR 等級人數分布。"
                  tooltip="起點多依學測或最早英檢推估；目前最佳為歷次英檢中的最高技能等級。"
                />
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={cefrChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="baseline" name="起點" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="current" name="目前最佳" fill="#2c5282" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>
            <Col lg={6}>
              <div className="la-panel">
                <LearningAnalyticsPanelHeader
                  title="各技能平均成長"
                  lead="聽、說、讀、寫等技能的平均進步幅度（已校正起始能力）；雷達圖愈外圈代表該技能平均成長愈多。"
                  tooltip="僅含可計算前後測的樣本；觀察趨勢用，不宜解讀為某一課程的直接成效。"
                />
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <RadarChart data={skillRadar} outerRadius="70%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis tick={{ fontSize: 10 }} />
                      <Radar name="校正後成長" dataKey="adjusted" stroke="#2c5282" fill="#2c5282" fillOpacity={0.35} />
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            <Col lg={7}>
              <div className="la-panel">
                <LearningAnalyticsPanelHeader
                  title="英語中心資源參與"
                  lead="在目前群體中，各類課程或活動的累積有效參與時數（僅顯示參與量前 8 名）。"
                  tooltip="時數由學習歷程事件彙總，未修完或進行中的課程可能不計入。"
                />
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={resourceChart} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [`${value} 小時`, '累積時數']} />
                      <Bar dataKey="hours" name="累積時數" fill="#64748b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>
            <Col lg={5}>
              <div className="la-panel">
                <LearningAnalyticsPanelHeader
                  title="資源與成長的關聯（描述性）"
                  lead="參與某類資源的學生，平均英檢成長分數排名。僅供發現「可能值得進一步了解」的資源，不能解讀為保證有效。"
                />
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>資源類型</th>
                        <th className="text-end">樣本人數</th>
                        <th className="text-end">平均成長</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.resourceRanking || []).slice(0, 6).map((row) => (
                        <tr key={row.resourceType}>
                          <td>{row.label}</td>
                          <td className="text-end">{row.growthSampleSize ?? '—'}</td>
                          <td className="text-end">{row.rawGrowthAverage ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small text-muted mt-2 mb-0">
                  想深入比較各資源？請至
                  {' '}
                  <Link to="/admin/learning-analytics/resources">資源效益</Link>
                  。
                </p>
              </div>
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            <Col md={6}>
              <div className="la-panel">
                <LearningAnalyticsPanelHeader
                  title="資料完整度分布"
                  lead="每位學生的英檢與參與紀錄是否足夠支撐分析；完整度較低者仍會顯示，但解讀時宜保守。"
                />
                <ul className="list-unstyled mb-0">
                  {(data.evidenceQuality || []).map((row) => (
                    <li key={row.level} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                      <EvidenceQualityBadge
                        level={row.level}
                        label={EVIDENCE_QUALITY_USER_LABELS[row.level] || row.label}
                      />
                      <span className="text-muted small">
                        {formatNum(row.count)} 人（{formatPct(row.rate)}）
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Col>
            <Col md={6}>
              <div className="la-disclaimer">
                <strong>閱讀提醒</strong>
                <ul className="mb-0 mt-2 ps-3 small">
                  {(data.disclaimers || []).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                  <li>本頁為觀察統計，不能單獨作為「某課程讓學生進步」的因果證據。</li>
                  <li>若數字與預期不符，請先確認是否已執行學習歷程重建，並檢查篩選條件是否過窄。</li>
                </ul>
                {data.snapshotVersion ? (
                  <div className="small mt-2 text-muted">
                    本次圖表使用的資料批次：{data.snapshotVersion}
                  </div>
                ) : null}
              </div>
            </Col>
          </Row>

          <div className="d-flex flex-wrap gap-3 mt-3 pt-2 border-top small">
            <span className="text-muted">延伸功能：</span>
            <Link to="/admin/learning-analytics/cohorts">依 cohort／系所分組比較</Link>
            <Link to="/admin/learning-analytics/insights">決策支援圖表與 outlook</Link>
            <Link to="/admin/learning-analytics/skills">查單一學生技能成長</Link>
            <Link to="/admin/learning-analytics/model-runs">模型執行紀錄</Link>
            <Link to="/admin/learning-analytics/raw-data">匯出 Excel 原始資料</Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
