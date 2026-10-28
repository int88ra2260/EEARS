import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import GrowthEpisodeTable from '../../components/learningAnalytics/GrowthEpisodeTable';
import GrowthMetricsExplainer from '../../components/learningAnalytics/GrowthMetricsExplainer';
import LearningAnalyticsNextSteps from '../../components/learningAnalytics/LearningAnalyticsNextSteps';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import MetricCard from '../../components/learningAnalytics/MetricCard';
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import ColumnHead, { HEAD } from '../../components/learningAnalytics/ColumnHead';
import { LA_FILTER_INTRO_SKILLS, SKILL_GROWTH_FILTER_KEYS } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { getLearningAnalyticsSkills } from '../../services/learningAnalyticsService';

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

const SKILL_ORDER = ['listening', 'reading', 'speaking', 'writing'];

const MIN_INTERPRETABLE_SAMPLE = 5;
const STRONG_GROWTH_GSE = 5;
const LOW_GROWTH_RATIO = 0.4;

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '0';
}

function formatGse(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
}

function describeStartingBands(bands) {
  const ready = (bands || []).filter((band) => band.interpretable && Number.isFinite(Number(band.medianActualGseGrowth)));
  if (!ready.length) {
    return {
      lines: ['同一起點的人還不到 5 人，先不比較誰快誰慢。'],
      pulled: false,
    };
  }
  const low = ready[0];
  const high = ready[ready.length - 1];
  const lines = ready.length === 1
    ? [`前測在 ${low.label} 的人，正中間進步 ${formatGse(low.medianActualGseGrowth)}。`]
    : [
      `前測較低（${low.label}），正中間的人 ${formatGse(low.medianActualGseGrowth)}。`,
      `前測較高（${high.label}），正中間的人 ${formatGse(high.medianActualGseGrowth)}。`,
    ];
  return {
    lines,
    bandCount: ready.length,
    pulled: ready.some((band) => band.meanPulledByExtremes),
  };
}

function buildSkillJudgement(row) {
  const sampleSize = Number(row.sampleSize || 0);
  const actual = numberOrNull(row.actual);
  const ratio = numberOrNull(row.growthRatio);

  if (sampleSize < MIN_INTERPRETABLE_SAMPLE || actual == null) {
    return {
      tone: 'muted',
      status: '資料不足',
      summary: '目前不適合判讀成效。優先補足前後測或確認匯入資料。',
    };
  }

  if (actual >= STRONG_GROWTH_GSE && (ratio == null || ratio >= 0.5)) {
    return {
      tone: 'positive',
      status: '成長明確',
      summary: '平均成長與進步比例都偏正向，可作為本期較穩定的技能訊號。',
    };
  }

  if (actual > 0) {
    return {
      tone: 'watch',
      status: '小幅成長',
      summary: '有正向成長，但幅度或進步比例仍需搭配學生明細確認。',
    };
  }

  if (ratio != null && ratio < LOW_GROWTH_RATIO) {
    return {
      tone: 'risk',
      status: '需要追查',
      summary: '進步學生比例偏低，建議往下看個別學生與課程參與紀錄。',
    };
  }

  return {
    tone: 'risk',
    status: '未見成長',
    summary: '平均成長未轉正，需確認是否為缺測、分組差異或教學介入不足。',
  };
}

function compareSkillPriority(a, b) {
  const aSample = Number(a.sampleSize || 0);
  const bSample = Number(b.sampleSize || 0);
  const aActual = Number.isFinite(Number(a.actual)) ? Number(a.actual) : -Infinity;
  const bActual = Number.isFinite(Number(b.actual)) ? Number(b.actual) : -Infinity;
  if (bActual !== aActual) return bActual - aActual;
  return bSample - aSample;
}

function buildPageSummary(rows) {
  const interpretable = rows.filter((row) => row.judgement.tone !== 'muted');
  const insufficient = rows.filter((row) => row.judgement.tone === 'muted');
  const strongest = [...interpretable].sort(compareSkillPriority)[0] || null;
  const risk = interpretable.find((row) => row.judgement.tone === 'risk') || null;

  if (!rows.length) {
    return {
      headline: '目前沒有可呈現的技能成長資料。',
      action: '請先確認篩選條件、前後測匯入與快照版本。',
      interpretable,
      insufficient,
      strongest,
      risk,
    };
  }

  if (!interpretable.length) {
    return {
      headline: '目前四技能都還不能穩定判讀。',
      action: '下一步應先補足前後測樣本，而不是解讀成效高低。',
      interpretable,
      insufficient,
      strongest,
      risk,
    };
  }

  if (risk) {
    return {
      headline: `${risk.skill} 需要優先追查；${strongest?.skill || '部分技能'}呈現較明確成長。`,
      action: '建議先檢查低成長技能的學生明細，再回到課程或活動配置調整。',
      interpretable,
      insufficient,
      strongest,
      risk,
    };
  }

  return {
    headline: `${strongest?.skill || '可判讀技能'}是目前最明確的成長訊號。`,
    action: insufficient.length
      ? '樣本不足的技能仍不建議解讀，請先補測或補資料。'
      : '可進一步到學生明細確認哪些學生與活動經驗推動了成長。',
    interpretable,
    insufficient,
    strongest,
    risk,
  };
}

function formatBandRange(band) {
  return `${band.gseMin}–${band.gseMax}`;
}

function StartingGseCell({ band }) {
  if (!band) return <span className="text-muted">—</span>;
  if (!band.interpretable) {
    return (
      <div className="la-starting-gse-cell text-muted">
        <span>{`只有 ${formatCount(band.sampleSize)} 人`}</span>
        <span>先不比較</span>
      </div>
    );
  }
  return (
    <div className="la-starting-gse-cell">
      <span>
        平均
        {' '}
        <strong>{formatGse(band.actualGseGrowthAverage)}</strong>
      </span>
      <span>
        中間的人
        {' '}
        <strong>{formatGse(band.medianActualGseGrowth)}</strong>
      </span>
      <span className="text-muted">
        {`中間一半 ${formatGse(band.q1ActualGseGrowth)} 到 ${formatGse(band.q3ActualGseGrowth)}`}
      </span>
      <span className="text-muted">
        {`${formatCount(band.sampleSize)} 人，有進步 ${pct(band.growthStudentRatio)}`}
      </span>
      {band.meanPulledByExtremes ? (
        <span className="la-starting-gse-cell__warn">平均被少數人拉動</span>
      ) : null}
    </div>
  );
}

function StartingGsePanel({ groups }) {
  const rows = useMemo(() => {
    const bandMap = new Map();
    for (const group of groups || []) {
      for (const band of group.bands || []) {
        if (!bandMap.has(band.bandKey)) {
          bandMap.set(band.bandKey, {
            bandKey: band.bandKey,
            label: band.label,
            gseMin: band.gseMin,
            gseMax: band.gseMax,
            cells: {},
          });
        }
        bandMap.get(band.bandKey).cells[group.skill] = band;
      }
    }
    return [...bandMap.values()].sort((a, b) => a.gseMin - b.gseMin);
  }, [groups]);

  return (
    <div className="la-panel">
      <div className="la-panel-title">不同起點，後來差多少</div>
      <p className="small text-muted mb-2">
        每一格都是「這一科、前測落在這個區間」的人。區間名稱像 B1、B1+，只是前測分數的稱呼。
        {`少於 ${MIN_INTERPRETABLE_SAMPLE} 人只顯示人數。這是描述，不代表課程造成進步。`}
      </p>
      <ul className="la-starting-gse-legend mb-3">
        <li><strong>平均</strong>：這組所有人加起來再平均。一兩個特別高或特別低的人會把數字拉走。</li>
        <li><strong>中間的人</strong>：由低到高排好，正中間那位的成長。要下結論時先看這個。</li>
        <li><strong>中間一半</strong>：由低到高排好後，中間那一半人的範圍。兩端特別高或特別低的人不算在這裡。</li>
      </ul>
      {!rows.length ? (
        <p className="small text-muted mb-0">目前沒有可依前測 GSE 分組的前後測。</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 la-starting-gse-table">
            <thead>
              <tr>
                <th><ColumnHead {...HEAD.pretestBand} /></th>
                <th><ColumnHead {...HEAD.bandRange} /></th>
                {SKILL_ORDER.map((skill) => (
                  <th key={skill}>{SKILL_LABELS[skill]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.bandKey}>
                  <td>{row.label}</td>
                  <td className="text-muted">{formatBandRange(row)}</td>
                  {SKILL_ORDER.map((skill) => (
                    <td key={skill}><StartingGseCell band={row.cells[skill]} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SkillInsightCard({ row, startingBands, onGrowthRatioClick }) {
  const startingHint = describeStartingBands(startingBands);
  return (
    <div className={`la-panel la-skill-growth-card la-skill-growth-card--${row.judgement.tone}`}>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div className="la-skill-growth-card__title">{row.skill}</div>
          <div className="la-skill-growth-card__meta">能算進步的筆數 {formatCount(row.sampleSize)}</div>
        </div>
        <span className="la-skill-growth-card__status">{row.judgement.status}</span>
      </div>

      <div className="la-skill-growth-card__metrics">
        <div>
          <span title={HEAD.actualGse.hint}>平均：後測減前測</span>
          <strong>{formatGse(row.actual)}</strong>
        </div>
        <button
          type="button"
          className="la-skill-growth-card__metric-action"
          onClick={() => onGrowthRatioClick?.(row.key, row.skill)}
          title={`查看${row.skill}裡 GSE 有進步的學生，並可把這批人帶到 KPI 或匯出`}
        >
          <span>有進步學生</span>
          <strong>{pct(row.growthRatio)}</strong>
          <em>點擊查看明細</em>
        </button>
      </div>

      <div className="la-skill-growth-card__peers">
        {startingHint.lines.map((line) => <div key={line}>{line}</div>)}
        <div className="la-skill-growth-card__peers-note">跟這一科的前測比，不是跟入學時的總程度比。</div>
        {startingHint.bandCount > 1 ? (
          <div className="la-skill-growth-card__peers-note">這裡只對照最低和最高的兩個區間，其餘區間在下方表格。</div>
        ) : null}
        {startingHint.pulled ? <div className="la-skill-growth-card__peers-note">有一組的平均被少數人拉動，看「中間的人」。</div> : null}
      </div>
      <p className="la-skill-growth-card__summary mb-0">{row.judgement.summary}</p>
    </div>
  );
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
    withWorkingSet,
    token,
  } = useLearningAnalyticsBootstrap({ scopeKeys: SKILL_GROWTH_FILTER_KEYS });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [episodeFocus, setEpisodeFocus] = useState(null);
  const [visibleScope, setVisibleScope] = useState(null);
  const episodeSectionRef = useRef(null);

  const handleGrowthRatioClick = useCallback((skillKey, skillLabel) => {
    setEpisodeFocus({
      skill: skillKey,
      skillLabel,
      improvedOnly: true,
      sortKey: 'rawGrowth',
      sortDir: 'desc',
      token: Date.now(),
    });
  }, []);

  const handleVisibleScope = useCallback((scope) => {
    setVisibleScope(scope);
  }, []);

  useEffect(() => {
    if (!episodeFocus?.token) return undefined;
    const timer = window.setTimeout(() => {
      episodeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [episodeFocus]);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      setData(await getLearningAnalyticsSkills(token, withWorkingSet(apiParams())));
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

  const growth = data?.growth;

  const chartData = useMemo(() => {
    const bySkill = growth?.bySkill || data?.growthEpisodes?.bySkill || [];
    const adjusted = data?.adjustedGrowth?.bySkill || [];
    const adjMap = new Map(adjusted.map((r) => [r.skill, r.adjustedGseGrowthAverage]));

    return bySkill
      .filter((r) => SKILL_LABELS[r.skill])
      .map((r) => {
        const row = {
          key: r.skill,
          skill: r.label || SKILL_LABELS[r.skill],
          actual: numberOrNull(r.actualGseGrowthAverage),
          adjusted: numberOrNull(adjMap.get(r.skill) ?? r.adjustedGseGrowthAverage),
          rawInstrument: numberOrNull(r.rawGrowthAverage),
          sampleSize: Number(r.sampleSize || 0),
          improvedCount: Number(r.improvedCount || 0),
          growthRatio: numberOrNull(r.growthStudentRatio),
        };
        return { ...row, judgement: buildSkillJudgement(row) };
      });
  }, [data, growth]);

  const sortedChartData = useMemo(() => {
    return [...chartData].sort(compareSkillPriority);
  }, [chartData]);

  const pageSummary = useMemo(() => buildPageSummary(chartData), [chartData]);

  const nextSet = useMemo(() => {
    const pack = episodeFocus?.improvedOnly && episodeFocus.skill
      ? growth?.improvedStudentsBySkill?.[episodeFocus.skill]
      : null;
    const tableMatches = visibleScope
      && visibleScope.skill === episodeFocus?.skill
      && visibleScope.improvedOnly;
    if (pack?.studentIds?.length && !(tableMatches && visibleScope.narrowed)) {
      const label = `${episodeFocus.skillLabel || episodeFocus.skill}有進步的學生`;
      return {
        label,
        studentIds: pack.studentIds,
        total: pack.total,
        truncated: pack.truncated,
        note: '同一人多筆前後測只算一次。這是全部 GSE 有成長的人，不是下方表格的抽樣。',
        source: 'skills-improved',
      };
    }
    if (visibleScope?.studentIds?.length && (visibleScope.skill || visibleScope.narrowed || visibleScope.improvedOnly)) {
      return {
        label: '畫面上這些明細的學生',
        studentIds: visibleScope.studentIds,
        note: '明細最多約 100 筆前後測。要帶某一科全部有進步的人，請點卡片上的「有進步學生」。',
        source: 'skills-visible',
      };
    }
    return null;
  }, [episodeFocus, growth, visibleScope]);

  return (
    <div>
      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />

      <LearningAnalyticsPageFrame
        title="技能成長"
        showWorkingSet
        workingSetHere="skills"
        question="看聽、讀、說、寫有沒有夠多人可以判讀的成長。"
        scope="分析快照裡、有前後測的學生。這頁用來觀察四技能，不用來排名老師或課程。"
        howToRead={(
          <>
            <ol className="small mb-3 ps-3">
              <li>先看人數夠不夠。不到 5 人的組，先不要比誰快誰慢。</li>
              <li>再看平均。如果畫面上寫「平均被少數人拉動」，改看正中間的人。</li>
              <li>要看某一個人算快還是慢，到下方明細的「跟同樣起點比」。</li>
              <li>起點已經很高的人，後來進步較少，是常見情形。</li>
            </ol>
            <GrowthMetricsExplainer />
          </>
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
        visibleKeys={SKILL_GROWTH_FILTER_KEYS}
        showAdvanced={false}
        groupSnapshots
        intro={LA_FILTER_INTRO_SKILLS}
      />

      <LearningAnalyticsActiveFilters filters={appliedFilters} visibleKeys={SKILL_GROWTH_FILTER_KEYS} />
      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}

      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}

      {!loading && data ? (
        <>
          <Row className="g-3 mt-1">
            <Col lg={8}>
              <div className="la-panel la-skill-growth-summary">
                <div className="la-panel-title">本頁結論</div>
                <p className="la-skill-growth-summary__headline mb-2">{pageSummary.headline}</p>
                <p className="la-panel-lead mb-3">{pageSummary.action}</p>
                <div className="la-skill-growth-summary__facts">
                  <span>可判讀：{pageSummary.interpretable.map((row) => row.skill).join('、') || '無'}</span>
                  <span>樣本不足：{pageSummary.insufficient.map((row) => row.skill).join('、') || '無'}</span>
                  <span>判讀門檻：至少 {MIN_INTERPRETABLE_SAMPLE} 筆前後測</span>
                </div>
                {Number(growth?.summary?.excludedPlaceholderScoreRows) > 0 ? (
                  <p className="small mb-0 mt-3">
                    已排除 {formatCount(growth.summary.excludedPlaceholderScoreRows)} 筆前後測：原始分為 0 或 1（缺考或無效分數），不計入上方成長。
                  </p>
                ) : null}
              </div>
            </Col>
            <Col sm={6} lg={2}>
              <MetricCard
                label="有前後測人數"
                value={growth?.summary?.retestCount ?? data.growthEpisodes?.retestStudentCount ?? 0}
                hint="同一人只計一次；至少一項技能有前測與後測分差"
              />
            </Col>
            <Col sm={6} lg={2}>
              <MetricCard
                label="可判讀技能"
                value={`${pageSummary.interpretable.length}/4`}
                hint="樣本不足不解讀"
              />
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            {chartData.map((row) => (
              <Col md={6} xl={3} key={row.key}>
                <SkillInsightCard
                  row={row}
                  startingBands={(growth?.byStartingGse || []).find((group) => group.skill === row.key)?.bands}
                  onGrowthRatioClick={handleGrowthRatioClick}
                />
              </Col>
            ))}
          </Row>

          <Row className="g-3 mt-1">
            <Col xs={12}>
              <div className="la-panel">
                <div className="la-panel-title">技能成長排序</div>
                <p className="small text-muted mb-2">
                  這張圖只依平均 GSE 成長排序。起點高低的差別在下方表格，不要把長條較短讀成課程比較沒效。
                </p>

                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={sortedChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="skill" width={48} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === 'actual') return [formatGse(value), '平均 GSE 成長'];
                          return [value, name];
                        }}
                        labelFormatter={(label) => `${label}`}
                      />
                      <ReferenceLine x={0} stroke="#8b8b8b" />
                      <Bar dataKey="actual" name="actual" radius={[0, 4, 4, 0]}>
                        {sortedChartData.map((row) => (
                          <Cell key={row.key} fill={row.judgement.tone === 'risk' ? '#b45309' : '#2c5282'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            <Col xs={12}>
              <StartingGsePanel groups={growth?.byStartingGse} />
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            <Col xs={12}>
              <div className="la-panel" ref={episodeSectionRef} id="la-skill-episode-list">
                <div className="la-panel-title">學生前後測明細：用於追查個別案例</div>
                <p className="small text-muted">
                  「跟同樣起點比」是把這個人放回同一科、前測落在同一區間的那一群。比過的人愈多，代表在起點相近的人裡面進步較快。不到 5 人的組不排名。
                  時數只算考試前的課程／活動。點上方卡片的「有進步學生」，會鎖定該科全部有進步的人，再帶到 B2 達標或匯出。
                </p>
                {nextSet ? (
                  <LearningAnalyticsNextSteps
                    label={nextSet.label}
                    studentIds={nextSet.studentIds}
                    total={nextSet.total}
                    truncated={nextSet.truncated}
                    note={nextSet.note}
                    source={nextSet.source}
                    sourcePath="/admin/learning-analytics/skills"
                  />
                ) : null}
                <GrowthEpisodeTable
                  episodes={growth?.episodes || data.growthEpisodes?.sampleEpisodes || []}
                  focusRequest={episodeFocus}
                  onScopeChange={handleVisibleScope}
                />
              </div>
            </Col>
          </Row>
        </>
      ) : null}
      </LearningAnalyticsPageFrame>
    </div>
  );
}
