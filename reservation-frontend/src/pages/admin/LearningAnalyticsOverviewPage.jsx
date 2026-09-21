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
import LearningAnalyticsSemesterOpsPanel from '../../components/learningAnalytics/LearningAnalyticsSemesterOpsPanel';
import MicroLearningEngagementPanel from '../../components/learningAnalytics/MicroLearningEngagementPanel';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import LaFold from '../../components/learningAnalytics/LaFold';
import EvidenceQualityBadge from '../../components/learningAnalytics/EvidenceQualityBadge';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { LA_FILTER_INTRO_COHORT, OVERVIEW_FILTER_KEYS } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';

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

function formatCoverage(part, total) {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return '—';
  return `${((p / t) * 100).toFixed(1)}%`;
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
  } = useLearningAnalyticsBootstrap({ scopeKeys: OVERVIEW_FILTER_KEYS });
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

  const resourceChart = useMemo(() => (
    (data?.resourceParticipation || []).slice(0, 8).map((row) => ({
      name: row.label,
      hours: row.hours,
    }))
  ), [data]);

  const resourceObservability = useMemo(() => {
    const byResource = new Map((data?.resourceRanking || []).map((row) => [row.resourceType, row]));
    return (data?.resourceParticipation || []).slice(0, 6).map((row) => {
      const ranking = byResource.get(row.resourceType) || {};
      return {
        ...row,
        growthSampleSize: ranking.growthSampleSize,
        evidenceLevel: ranking.evidenceLevel,
      };
    });
  }, [data]);

  const filterHasNoMatch = data?.hasData === false && meta?.hasAnalyticData;
  const semesterId = appliedFilters.semester || '';

  return (
    <div>
      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />
      <LearningAnalyticsOverviewGuide />
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
        snapshotOptions={meta?.snapshots}
        visibleKeys={OVERVIEW_FILTER_KEYS}
        groupSnapshots
        filterTitle="篩選條件"
        submitLabel="套用篩選"
        showAdvanced={false}
        intro={LA_FILTER_INTRO_COHORT}
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} visibleKeys={OVERVIEW_FILTER_KEYS} />

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}

      <div className="mt-3">
        <LearningAnalyticsSemesterOpsPanel
          token={token}
          semesterId={semesterId}
          ready={ready}
        />
      </div>

      <section className="la-zone la-zone--observe mt-3">
        <div className="la-zone__badge">B · 能力觀察</div>
        <LearningAnalyticsPanelHeader
          title="能力觀察（分析快照）"
          lead="以下為長期能力分布與成長趨勢。上方「B2 以上達標率」是快照累積，不可當作學期 KPI。"
        />

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" role="status" />
            <div className="text-muted mt-2 small">正在依您套用的條件載入圖表與指標…</div>
          </div>
        ) : null}

        {!loading && data && !data.hasData ? (
          <Alert variant={filterHasNoMatch ? 'info' : 'warning'} className="mt-2 mb-0">
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

        {!loading && data?.hasData ? (
          <>
            <Alert variant="secondary" className="small py-2 mt-2">
              此區<strong>不受「學期」名冊分母約束</strong>（學期篩選主要影響上方 A 區）。
              正式聽讀／說寫達標請用 A 區或
              {' '}
              <Link to="/admin/learning-analytics/kpi-report">B2 KPI 報表</Link>
              。
            </Alert>

            <Row className="g-3 mt-1">
              <Col md={3} sm={6}>
                <MetricCard
                  label="納入快照學生"
                  value={formatNum(headline.studentsInAnalysis)}
                  tooltip="符合目前篩選條件、且已納入分析快照的學生人數；這是觀察母體，不等於學期名冊分母。"
                />
              </Col>
              <Col md={3} sm={6}>
                <MetricCard
                  label="有效英檢覆蓋"
                  value={formatCoverage(headline.studentsWithValidExam, headline.studentsInAnalysis)}
                  hint={`${formatNum(headline.studentsWithValidExam)} 人有有效英檢`}
                  tooltip="納入快照學生中，至少有一筆可用英檢資料的人數比例。覆蓋不足時，成長與達標解讀都要降權。"
                />
              </Col>
              <Col md={3} sm={6}>
                <MetricCard
                  label="前後測覆蓋"
                  value={formatCoverage(headline.studentsWithMultipleExams, headline.studentsInAnalysis)}
                  hint={`${formatNum(headline.studentsWithMultipleExams)} 人可算成長`}
                  tooltip="至少有兩次有效英檢紀錄，才能計算個人進步。這比平均成長更適合作為總覽主指標。"
                />
              </Col>
              <Col md={3} sm={6}>
                <MetricCard
                  label="B2+（快照背景）"
                  value={formatPct(headline.b2plusRate)}
                  hint={`${formatNum(headline.b2plusCount)} 人；非學期 KPI`}
                  tooltip="依分析快照中每位學生歷史最佳技能成績，CEFR 達 B2 或以上者所占比例。正式上呈請看 A 區或 B2 KPI 報表。"
                />
              </Col>
            </Row>

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
                    title="成長資料可用性"
                    lead="先看有多少資料能支撐成長解讀；平均成長請到技能成長頁查看分布與明細。"
                  />
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <tbody>
                        <tr>
                          <th>有 baseline</th>
                          <td className="text-end">{formatNum(headline.studentsWithBaseline)}</td>
                          <td className="text-end text-muted">{formatCoverage(headline.studentsWithBaseline, headline.studentsInAnalysis)}</td>
                        </tr>
                        <tr>
                          <th>有有效英檢</th>
                          <td className="text-end">{formatNum(headline.studentsWithValidExam)}</td>
                          <td className="text-end text-muted">{formatCoverage(headline.studentsWithValidExam, headline.studentsInAnalysis)}</td>
                        </tr>
                        <tr>
                          <th>僅 1 場英檢</th>
                          <td className="text-end">{formatNum(headline.studentsWithSingleExam)}</td>
                          <td className="text-end text-muted">需補重測</td>
                        </tr>
                        <tr>
                          <th>可算前後測</th>
                          <td className="text-end">{formatNum(headline.studentsWithMultipleExams)}</td>
                          <td className="text-end text-muted">{formatCoverage(headline.studentsWithMultipleExams, headline.studentsInAnalysis)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="small text-muted mt-2 mb-0">
                    成長值只應在「可算前後測」樣本足夠時解讀；正式缺口請以 A 區缺重測／無考試為主。
                  </p>
                </div>
              </Col>
            </Row>

            <Row className="g-3 mt-1">
              <Col lg={7}>
                <div className="la-panel">
                  <LearningAnalyticsPanelHeader
                    title="英語中心資源參與"
                    lead="各類課程／活動的累積時數（前 8 名）。"
                    tooltip="未修完或進行中的課程可能不計入。"
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
                    title="資源資料可觀察性"
                    lead="先看哪些資源有足夠參與與前後測樣本；不要把此處解讀成成效排名。"
                  />
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>資源類型</th>
                          <th className="text-end">累積時數</th>
                          <th className="text-end">可算成長</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resourceObservability.map((row) => (
                          <tr key={row.resourceType}>
                            <td>{row.label}</td>
                            <td className="text-end">{row.hours ?? '—'}</td>
                            <td className="text-end">{row.growthSampleSize ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="small text-muted mt-2 mb-0">
                    若要看課程、教師或活動層級，請先確認「可算成長」樣本是否足夠，再到
                    {' '}
                    <Link to="/admin/learning-analytics/offerings">課／師／活動</Link>
                    。
                  </p>
                </div>
              </Col>
            </Row>

            <Row className="g-3 mt-1">
              <Col md={6}>
                <div className="la-panel">
                  <LearningAnalyticsPanelHeader
                    title="資料完整度"
                    lead="英檢與參與紀錄夠不夠。完整度低的學生仍會列入，解讀宜保守。"
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
                <div className="la-panel h-100">
                  <div className="la-panel-title">閱讀時請記得</div>
                  <p className="small text-muted mb-2">數字用來比較趨勢，不是「參加就一定進步」。</p>
                  <LaFold label="更多提醒">
                    <ul className="mb-0 ps-3">
                      {(data.disclaimers || []).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                      <li>數字與預期不符時，先確認是否已重建資料、篩選是否過窄。</li>
                    </ul>
                    {data.snapshotVersion ? (
                      <div className="mt-2">資料版本：{data.snapshotVersion}</div>
                    ) : null}
                  </LaFold>
                </div>
              </Col>
            </Row>

            <MicroLearningEngagementPanel token={token} ready={ready} />

            <div className="d-flex flex-wrap gap-3 mt-3 pt-2 border-top small">
              <Link to="/admin/learning-analytics/cohorts">群體比較</Link>
              <Link to="/admin/learning-analytics/skills">技能成長</Link>
              <Link to="/admin/learning-analytics/raw-data">匯出資料</Link>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
