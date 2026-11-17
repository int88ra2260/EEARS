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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getLearningAnalyticsOverview, getLearningAnalyticsOverviewStudents } from '../../services/learningAnalyticsService';
import MetricCard from '../../components/learningAnalytics/MetricCard';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import OverviewStudentListModal from '../../components/learningAnalytics/OverviewStudentListModal';
import MicroLearningEngagementPanel from '../../components/learningAnalytics/MicroLearningEngagementPanel';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { OVERVIEW_FILTER_KEYS, scopeSearchPath } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';

const LEVEL_LABELS = {
  BELOW_A1: '未達 A1',
  UNKNOWN: '未記載',
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

function formatSigned(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const text = v.toFixed(1);
  return v > 0 ? `+${text}` : text;
}

function ratioHint(count, total) {
  return `${formatNum(count)} / ${formatNum(total)}`;
}

function barPayload(entry) {
  return entry?.payload || entry || {};
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
    withWorkingSet,
    workingSetScope,
    token,
    semesterFromUrl,
  } = useLearningAnalyticsBootstrap({ scopeKeys: OVERVIEW_FILTER_KEYS });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [listRequest, setListRequest] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [listData, setListData] = useState(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      const payload = await getLearningAnalyticsOverview(token, withWorkingSet(apiParams()));
      setData(payload);
    } catch (e) {
      setData(null);
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, withWorkingSet, ready]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setListRequest(null);
    setListData(null);
    setListError('');
  }, [appliedFilters]);

  useEffect(() => {
    if (!listRequest || !ready) return undefined;
    const controller = new AbortController();
    setListLoading(true);
    setListError('');
    getLearningAnalyticsOverviewStudents(token, withWorkingSet({
      ...apiParams(),
      slice: listRequest.slice,
      skill: listRequest.skill,
      department: listRequest.department,
      level: listRequest.level,
      limit: 40,
      offset: listRequest.offset || 0,
    }), { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted) setListData(payload);
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setListData(null);
          setListError(e.message || '名單載入失敗');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, [listRequest, ready, token, apiParams, withWorkingSet]);

  const dashboard = data?.dashboard;
  const ability = dashboard?.ability;
  const growth = dashboard?.growth;
  const resources = dashboard?.resources;
  const scopeQuery = new URLSearchParams();
  if (appliedFilters.snapshot_version) scopeQuery.set('snapshot_version', appliedFilters.snapshot_version);
  if (appliedFilters.cohort) scopeQuery.set('cohort', appliedFilters.cohort);
  const scopeSearch = scopeQuery.toString() ? `?${scopeQuery.toString()}` : '';
  const kpiHref = scopeSearchPath('/admin/learning-analytics/kpi-report', scopeSearch);
  const compareHref = scopeSearchPath('/admin/learning-analytics/cohorts', scopeSearch);
  const resourcesHref = scopeSearchPath('/admin/learning-analytics/resources', scopeSearch);
  const baselineChart = useMemo(
    () => (growth?.baseline || []).map((row) => ({
      ...row,
      label: LEVEL_LABELS[row.level] || row.level,
    })),
    [growth]
  );
  const departmentChart = ability?.byDepartment || [];
  const resourceChart = useMemo(
    () => (resources?.participation || []).slice(0, 8).map((row) => ({
      name: row.label,
      hours: row.hours,
    })),
    [resources]
  );
  const filterHasNoMatch = data?.hasData === false && meta?.hasAnalyticData;

  const openList = (request) => {
    setListData(null);
    setListRequest({ ...request, offset: 0 });
  };

  return (
    <div>
      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />
      <LearningAnalyticsPageFrame
        title="學習成效概況"
        showWorkingSet
        workingSetHere="overview"
        workingSetScope={workingSetScope}
        question="同一頁看英語能力、學習起點與成長、課程資源。"
      >
      {(semesterFromUrl || filters.semester) ? (
        <Alert variant="light" className="small py-2 mb-3 border">
          <Link to={`/admin/learning-journey?semester=${encodeURIComponent(filters.semester || semesterFromUrl)}`}>
            返回該學期學習歷程名單（{filters.semester || semesterFromUrl}）
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
        intro="這兩項會一起套到本頁的摘要、圖表與點開的名單。"
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} visibleKeys={OVERVIEW_FILTER_KEYS} />

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
          <div className="text-muted mt-2 small">正在依資料版本與入學年度載入…</div>
        </div>
      ) : null}

      {!loading && data && !data.hasData ? (
        <Alert variant={filterHasNoMatch ? 'info' : 'warning'} className="mt-3 mb-0">
          <div className="fw-semibold mb-1">
            {filterHasNoMatch ? '目前篩選條件下沒有符合的學生' : '尚無可顯示的分析資料'}
          </div>
          <div>{data.emptyStateHint}</div>
        </Alert>
      ) : null}

      {!loading && data?.hasData && ability && growth ? (
        <>
          <section className="mt-4">
            <LearningAnalyticsPanelHeader
              title="英語能力摘要"
              lead={`分母 ${formatNum(ability.total)} 人，是目前資料版本與入學年度的快照學生。`}
            />
            <Row className="g-3">
              <Col xs={12} sm={6} xl className="d-flex">
                <MetricCard
                  label="任一技能達 B2（含）以上"
                  value={formatPct(ability.overall.rate)}
                  hint={ratioHint(ability.overall.count, ability.overall.total)}
                  tooltip="聽、讀、說、寫各取原始分最高的那一次有效英檢。四項裡只要有一項的 CEFR 是 B2、C1 或 C2 就計入。這不是聽讀成對或說寫成對的政策達標率。"
                  onClick={() => openList({ slice: 'overall_b2', title: '任一技能達 B2（含）以上' })}
                />
              </Col>
              {(ability.skills || []).map((skill) => (
                <Col xs={12} sm={6} xl key={skill.skill} className="d-flex">
                  <MetricCard
                    label={`${skill.label}達 B2（含）以上`}
                    value={formatPct(skill.rate)}
                    hint={ratioHint(skill.count, skill.total)}
                    tooltip={`${skill.label}取原始分最高的那次有效英檢，該次 CEFR 達 B2（含）以上。分母與左邊相同。學測不計。較早一次達 B2、但原始分不是最高的那次，不算。`}
                    onClick={() => openList({
                      slice: 'skill_b2',
                      skill: skill.skill,
                      title: `${skill.label}達 B2（含）以上`,
                    })}
                  />
                </Col>
              ))}
            </Row>
            <p className="small text-muted mt-3 mb-2">
              聽讀成對、說寫成對與採計學期在
              {' '}
              <Link to={kpiHref}>學期 B2 KPI</Link>
              。系所的進一步比較在
              {' '}
              <Link to={compareHref}>群體與技能比較</Link>
              。
            </p>
            {departmentChart.length ? (
              <div className="la-panel">
                <LearningAnalyticsPanelHeader
                  title="各系所達 B2（含）以上"
                  lead="長條是人數。點一列可看該系所名單。"
                />
                <div style={{ width: '100%', height: Math.min(480, Math.max(220, departmentChart.length * 28)) }}>
                  <ResponsiveContainer>
                    <BarChart data={departmentChart} layout="vertical" margin={{ left: 16, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="department" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value, _name, item) => {
                        const row = item?.payload || {};
                        return [`${value} / ${row.total}（${formatPct(row.rate)}）`, '達 B2（含）以上'];
                      }}
                      />
                      <Bar
                        dataKey="count"
                        name="達 B2（含）以上"
                        fill="#2c5282"
                        radius={[0, 4, 4, 0]}
                        onClick={(entry) => {
                          const row = barPayload(entry);
                          if (!row.department) return;
                          openList({
                            slice: 'department_b2',
                            department: row.department,
                            title: `${row.department}達 B2（含）以上`,
                          });
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </section>

          <section className="mt-4">
            <LearningAnalyticsPanelHeader
              title="學習起點與成長"
              lead="先看入學時的等級，再看前測與後測收了多少，最後才看可配對的 GSE 變化。"
            />
            <Row className="g-3">
              <Col lg={6}>
                <div className="la-panel h-100">
                  <LearningAnalyticsPanelHeader title="英語起始分級" lead="點一個等級可看該等級的學生。" />
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={baselineChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar
                          dataKey="count"
                          name="人數"
                          fill="#94a3b8"
                          radius={[4, 4, 0, 0]}
                          onClick={(entry) => {
                            const row = barPayload(entry);
                            if (!row.level) return;
                            openList({
                              slice: 'baseline',
                              level: row.level,
                              title: `起始分級 ${row.label || row.level}`,
                            });
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Col>
              <Col lg={6}>
                <div className="la-panel h-100">
                  <LearningAnalyticsPanelHeader
                    title="前後測覆蓋與可比較人數"
                    lead="覆蓋率是資料有沒有收到。下方各技能的人數才是能拿來比成長的配對。"
                  />
                  <Row className="g-2">
                    <Col xs={4}>
                      <MetricCard
                        label="前測"
                        value={formatPct(growth.coverage?.pretest?.rate)}
                        hint={ratioHint(growth.coverage?.pretest?.count, growth.coverage?.pretest?.total)}
                        tooltip="第一梯有效英檢，含只有一次的檢定。學測不算前測。"
                        onClick={() => openList({ slice: 'coverage_pre', title: '有前測' })}
                      />
                    </Col>
                    <Col xs={4}>
                      <MetricCard
                        label="後測"
                        value={formatPct(growth.coverage?.posttest?.rate)}
                        hint={ratioHint(growth.coverage?.posttest?.count, growth.coverage?.posttest?.total)}
                        onClick={() => openList({ slice: 'coverage_post', title: '有後測' })}
                      />
                    </Col>
                    <Col xs={4}>
                      <MetricCard
                        label="兩者皆有"
                        value={formatPct(growth.coverage?.both?.rate)}
                        hint={ratioHint(growth.coverage?.both?.count, growth.coverage?.both?.total)}
                        onClick={() => openList({ slice: 'coverage_both', title: '前測與後測皆有' })}
                      />
                    </Col>
                  </Row>
                  <div className="table-responsive mt-3">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>技能</th>
                          <th className="text-end">平均 GSE 變化</th>
                          <th className="text-end">配對</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(growth.skills || []).map((row) => (
                          <tr key={row.skill}>
                            <td>{row.label}</td>
                            <td className="text-end">
                              {row.status === 'ok' ? (
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0"
                                  onClick={() => openList({
                                    slice: 'comparable',
                                    skill: row.skill,
                                    title: `${row.label}可比較學生`,
                                  })}
                                >
                                  {formatSigned(row.average)}
                                </button>
                              ) : '資料不足'}
                            </td>
                            <td className="text-end text-muted">
                              {row.status === 'ok'
                                ? `${formatNum(row.sampleSize)} 人／${formatNum(row.episodeCount)} 筆`
                                : `${formatNum(row.unavailable)} 人未配對或不符合比較條件`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="small text-muted mt-2 mb-0">
                    成績分布與各工具明細在
                    {' '}
                    <Link to={compareHref}>群體與技能比較</Link>
                    。
                  </p>
                </div>
              </Col>
            </Row>
          </section>

          <section className="mt-4">
            <LearningAnalyticsPanelHeader
              title="課程資源"
              lead="這裡看資源投入與參與。課程、教師與活動明細在資源與開課分析。"
            />
            <Row className="g-3">
              <Col lg={7}>
                <div className="la-panel">
                  <LearningAnalyticsPanelHeader title="資源累積時數" lead="前 8 類。" />
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <BarChart data={resourceChart} layout="vertical" margin={{ left: 16 }}>
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
                <div className="la-panel h-100">
                  <LearningAnalyticsPanelHeader title="可觀察樣本" lead="參與人數旁是能對上成長資料的樣本數。" />
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-2">
                      <thead>
                        <tr>
                          <th>資源</th>
                          <th className="text-end">參與</th>
                          <th className="text-end">成長樣本</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(resources?.ranking || []).slice(0, 6).map((row) => (
                          <tr key={row.resourceType}>
                            <td>{row.label}</td>
                            <td className="text-end">{row.participantCount ?? '—'}</td>
                            <td className="text-end">{row.growthSampleSize ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Link to={resourcesHref}>資源與開課分析</Link>
                </div>
              </Col>
            </Row>
            <details className="la-panel mt-3">
              <summary className="fw-semibold">微學習參與</summary>
              <div className="pt-3">
                <MicroLearningEngagementPanel token={token} ready={ready} />
              </div>
            </details>
          </section>
        </>
      ) : null}
      </LearningAnalyticsPageFrame>
      <OverviewStudentListModal
        show={Boolean(listRequest)}
        title={listRequest?.title}
        loading={listLoading}
        error={listError}
        data={listData}
        onHide={() => setListRequest(null)}
        onPage={(offset) => setListRequest((current) => (current ? { ...current, offset } : current))}
      />
    </div>
  );
}
