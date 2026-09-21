import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import MetricCard from '../../components/learningAnalytics/MetricCard';
import { LA_FILTER_INTRO_COHORT, SKILL_GROWTH_FILTER_KEYS } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { getLearningAnalyticsSkills } from '../../services/learningAnalyticsService';

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

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

function adjustedLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '無可估資料';
  if (Math.abs(n) < 1) return '接近預期';
  return n > 0 ? `高於預期 ${formatGse(n)}` : `低於預期 ${formatGse(n)}`;
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

function SkillInsightCard({ row }) {
  return (
    <div className={`la-panel la-skill-growth-card la-skill-growth-card--${row.judgement.tone}`}>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div className="la-skill-growth-card__title">{row.skill}</div>
          <div className="la-skill-growth-card__meta">前後測樣本 n={formatCount(row.sampleSize)}</div>
        </div>
        <span className="la-skill-growth-card__status">{row.judgement.status}</span>
      </div>

      <div className="la-skill-growth-card__metrics">
        <div>
          <span>平均 GSE 成長</span>
          <strong>{formatGse(row.actual)}</strong>
        </div>
        <div>
          <span>有進步學生</span>
          <strong>{pct(row.growthRatio)}</strong>
        </div>
      </div>

      <div className="la-skill-growth-card__adjusted">{adjustedLabel(row.adjusted)}</div>
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
    token,
  } = useLearningAnalyticsBootstrap({ scopeKeys: SKILL_GROWTH_FILTER_KEYS });

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
        visibleKeys={SKILL_GROWTH_FILTER_KEYS}
        showAdvanced={false}
        groupSnapshots
        intro={LA_FILTER_INTRO_COHORT}
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
              </div>
            </Col>
            <Col sm={6} lg={2}>
              <MetricCard
                label="有前後測人數"
                value={growth?.summary?.retestCount ?? data.growthEpisodes?.retestRows ?? 0}
                hint="才能計算個人進步"
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
                <SkillInsightCard row={row} />
              </Col>
            ))}
          </Row>

          <Row className="g-3 mt-1">
            <Col lg={7}>
              <div className="la-panel">
                <div className="la-panel-title">技能成長排序</div>
                <p className="small text-muted mb-2">
                  只用平均 GSE 實際成長排序；高於/低於預期改放在技能卡作為輔助判讀，避免和實際成長混淆。
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

            <Col lg={5}>
              <div className="la-panel">
                <div className="la-panel-title">怎麼讀這頁</div>
                <p className="small text-muted mb-2">
                  這頁不是用來排名老師或課程，而是看四技能是否出現可判讀的成長訊號。
                </p>
                <ol className="la-skill-growth-guide mb-3">
                  <li>先看樣本是否足夠，樣本不足就不解讀成效。</li>
                  <li>再看平均 GSE 成長與有進步學生比例是否同向。</li>
                  <li>最後才看高於/低於預期，作為背景差異的輔助提醒。</li>
                </ol>
                <GrowthMetricsExplainer />
              </div>
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            <Col xs={12}>
              <div className="la-panel">
                <div className="la-panel-title">學生前後測明細：用於追查個別案例</div>
                <p className="small text-muted">
                  當某個技能樣本不足、低於預期或進步比例偏低時，再往下看學生時間線與考前參與紀錄。時數只算考試前的課程／活動。
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
