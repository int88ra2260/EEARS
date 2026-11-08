import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import ColumnHead, { HEAD } from '../../components/learningAnalytics/ColumnHead';
import { LA_FILTER_INTRO_SKILLS, SKILL_GROWTH_FILTER_KEYS } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';
import ComparisonModeSwitch from '../../components/learningAnalytics/ComparisonModeSwitch';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { getLearningAnalyticsSkills } from '../../services/learningAnalyticsService';
import { P } from '../../constants/permissions';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import AnalyticsHubReturn from './AnalyticsHubReturn';
import { formatObservedDelta, shouldApplyAnalyticsResult } from './learningParticipationReading';

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

const SKILL_ORDER = ['listening', 'reading', 'speaking', 'writing'];

const MIN_INTERPRETABLE_SAMPLE = 5;

function pct(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '—';
}

function useNarrowScreen() {
  const query = '(max-width: 767.98px)';
  const [narrow, setNarrow] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setNarrow(media.matches);
    onChange();
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);
  return narrow;
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
  if (row.missing) {
    return {
      tone: 'muted',
      status: '未提供可判讀資料',
      summary: '這份回應沒有這項技能的列。不能因此說完全沒有測驗紀錄，也不能解讀成沒有進步。',
    };
  }
  const sampleSize = Number(row.sampleSize);
  const actual = numberOrNull(row.actual);

  if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
    return {
      tone: 'muted',
      status: '無可比較樣本',
      summary: '沒有可比較的前後測。不能解讀成沒有進步。',
    };
  }

  if (sampleSize < MIN_INTERPRETABLE_SAMPLE || actual == null) {
    return {
      tone: 'muted',
      status: '資料不足',
      summary: '可比較筆數還少，或平均沒有算出來。先不要判讀高低。',
    };
  }

  if (actual === 0) {
    return {
      tone: 'watch',
      status: '平均沒有變化',
      summary: '可比較樣本的平均 GSE 變化是 0.0。這是觀察到的零，不是缺資料。',
    };
  }

  if (actual > 0) {
    return {
      tone: 'watch',
      status: '平均上升',
      summary: '可比較樣本的平均 GSE 變化是正的。請搭配樣本數與資料品質判讀，不能和其他技能排名。',
    };
  }

  return {
    tone: 'watch',
    status: '平均下降',
    summary: '可比較樣本的平均 GSE 變化是負的。這是描述，不是課程效果。',
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

function describeObservedSkill(row) {
  const name = row.skill;
  const actual = numberOrNull(row.actual);
  if (actual == null) return `${name}具有可比較的測驗紀錄，平均尚未提供，仍需搭配資料品質判讀。`;
  if (actual === 0) return `${name}具有可比較的測驗紀錄，平均變化是 0.0，仍需搭配資料品質判讀。`;
  if (actual > 0) return `${name}具有可觀察的前後測變化，請搭配樣本數與資料品質判讀。`;
  return `${name}的可比較樣本平均變化是負的。這是描述，不是課程效果。`;
}

function buildPageSummary(rows) {
  const interpretable = rows.filter((row) => row.judgement.tone !== 'muted');
  const insufficient = rows.filter((row) => row.judgement.tone === 'muted');
  const base = { interpretable, insufficient, strongest: null, risk: null };

  if (!rows.length) {
    return {
      ...base,
      headline: '目前沒有可呈現的技能成長資料。',
      action: '請先確認篩選條件、前後測匯入與快照版本。',
    };
  }

  if (!interpretable.length) {
    return {
      ...base,
      headline: '目前沒有足以判讀方向的技能資料。',
      action: '未回傳的技能是未提供可判讀資料，不能解讀成沒有測驗或沒有進步。',
    };
  }

  return {
    ...base,
    headline: interpretable.map(describeObservedSkill).join(''),
    action: '請搭配各技能自己的樣本數與資料品質判讀。',
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
          <div className="la-skill-growth-card__meta">
            {row.missing ? '未提供可判讀資料' : `可比較筆數 ${formatCount(row.sampleSize)}`}
          </div>
        </div>
        <span className="la-skill-growth-card__status">{row.judgement.status}</span>
      </div>

      <div className="la-skill-growth-card__metrics">
        <div>
          <span>平均 GSE 變化</span>
          <strong>{row.missing ? '—' : formatObservedDelta(row.actual, row.sampleSize)}</strong>
        </div>
        {Number(row.sampleSize) > 0 ? (
          <button
            type="button"
            className="la-skill-growth-card__metric-action"
            onClick={() => onGrowthRatioClick?.(row.key, row.skill)}
            title={`查看${row.skill}裡 GSE 有進步的學生，並可把這批人帶到 KPI 或原始資料頁`}
          >
            <span>有進步學生</span>
            <strong>{pct(row.growthRatio)}</strong>
            <em>點擊查看明細</em>
          </button>
        ) : (
          <div>
            <span>有進步學生</span>
            <strong>—</strong>
          </div>
        )}
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
    workingSetScope,
    token,
  } = useLearningAnalyticsBootstrap({ scopeKeys: SKILL_GROWTH_FILTER_KEYS });
  const outlet = useOutletContext() || {};
  const accessProfile = buildAccessProfile(outlet.token || token);
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_LEARNING_ANALYTICS);
  const narrow = useNarrowScreen();
  const runSeq = useRef(0);

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

  useEffect(() => {
    if (!ready) return undefined;
    const seq = runSeq.current + 1;
    runSeq.current = seq;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getLearningAnalyticsSkills(token, withWorkingSet(apiParams()), { signal: controller.signal })
      .then((payload) => {
        if (!shouldApplyAnalyticsResult(seq, runSeq.current)) return;
        setData(payload);
      })
      .catch((e) => {
        if (!shouldApplyAnalyticsResult(seq, runSeq.current) || e?.name === 'AbortError') return;
        setData(null);
        setError(e.message || '載入失敗');
      })
      .finally(() => {
        if (shouldApplyAnalyticsResult(seq, runSeq.current)) setLoading(false);
      });
    return () => controller.abort();
  }, [token, apiParams, withWorkingSet, ready]);

  const growth = data?.growth;

  const chartData = useMemo(() => {
    const bySkill = growth?.bySkill || data?.growthEpisodes?.bySkill || [];
    const adjusted = data?.adjustedGrowth?.bySkill || [];
    const adjMap = new Map(adjusted.map((r) => [r.skill, r.adjustedGseGrowthAverage]));

    const byKey = new Map(bySkill.filter((r) => SKILL_LABELS[r.skill]).map((r) => [r.skill, r]));
    return SKILL_ORDER.map((skill) => {
      const source = byKey.get(skill);
      if (!source) {
        const missing = {
          key: skill,
          skill: SKILL_LABELS[skill],
          missing: true,
          actual: null,
          adjusted: null,
          rawInstrument: null,
          sampleSize: null,
          improvedCount: null,
          growthRatio: null,
        };
        return { ...missing, judgement: buildSkillJudgement(missing) };
      }
      const row = {
        key: skill,
        skill: source.label || SKILL_LABELS[skill],
        missing: false,
        actual: numberOrNull(source.actualGseGrowthAverage),
        adjusted: numberOrNull(adjMap.get(skill) ?? source.adjustedGseGrowthAverage),
        rawInstrument: numberOrNull(source.rawGrowthAverage),
        sampleSize: Number(source.sampleSize || 0),
        improvedCount: Number(source.improvedCount || 0),
        growthRatio: numberOrNull(source.growthStudentRatio),
      };
      return { ...row, judgement: buildSkillJudgement(row) };
    });
  }, [data, growth]);

  const sortedChartData = useMemo(() => {
    return [...chartData].sort(compareSkillPriority);
  }, [chartData]);

  const plottedChartData = useMemo(
    () => sortedChartData.filter((row) => row.sampleSize > 0 && row.actual != null),
    [sortedChartData],
  );

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
        title="群體與技能比較"
        actions={<AnalyticsHubReturn accessProfile={accessProfile} />}
        showWorkingSet
        workingSetHere="skills"
        workingSetScope={workingSetScope}
        question="查看各技能可比較測驗資料及觀察到的能力變化。"
        scope="分析快照裡、有前後測的學生。四技能分開看，原始分數不能加總，也不用來排名老師或課程。"
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
      <ComparisonModeSwitch />
      <p className="la-scope-note" data-testid="la-scope-note">
        {`資料範圍：分析快照 ${data?.snapshotVersion || appliedFilters.snapshot_version || '尚未載入'}。目前模式是技能成長。聽力、閱讀、口說、寫作各自計算，不能把原始分數加在一起。`}
      </p>
      <LearningAnalyticsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={applyFilters}
        onReset={resetFilters}
        loading={!ready}
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

      {!loading && !error && !data ? (
        <p className="la-scope-note">這份回應沒有技能資料。不能解讀成沒有測驗。</p>
      ) : null}

      {!loading && data ? (
        <>
          <Row className="g-3 mt-1">
            <Col xs={12}>
              <div className="la-panel la-skill-growth-summary">
                <div className="la-panel-title">技能成長</div>
                <p className="la-skill-growth-summary__headline mb-2">{pageSummary.headline}</p>
                <p className="la-panel-lead mb-3">{pageSummary.action}</p>
                <div className="la-skill-growth-summary__facts">
                  <span>有前後測人數：{formatCount(growth?.summary?.retestCount ?? data.growthEpisodes?.retestStudentCount)}</span>
                  <span>可判讀：{pageSummary.interpretable.map((row) => row.skill).join('、') || '無'}</span>
                  <span>先不要判讀方向：{pageSummary.insufficient.map((row) => row.skill).join('、') || '無'}</span>
                  <span>判讀門檻：至少 {MIN_INTERPRETABLE_SAMPLE} 筆前後測</span>
                </div>
                {Number(growth?.summary?.excludedPlaceholderScoreRows) > 0 ? (
                  <p className="small mb-0 mt-3">
                    已排除 {formatCount(growth.summary.excludedPlaceholderScoreRows)} 筆前後測：原始分為 0 或 1（缺考或無效分數），不計入上方成長。
                  </p>
                ) : null}
              </div>
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

          {narrow ? null : (
          <Row className="g-3 mt-1">
            <Col xs={12}>
              <div className="la-panel">
                <div className="la-panel-title">各技能平均 GSE 變化</div>
                <p className="small text-muted mb-2">
                  這張圖只畫有可比較樣本、且平均已算出來的技能。長條較短是觀察到的 GSE 變化較小，不是課程比較沒效。不同技能的原始分數沒有畫在同一條軸上。
                </p>

                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={plottedChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
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
                        {plottedChartData.map((row) => (
                          <Cell key={row.key} fill={row.judgement.tone === 'risk' ? '#b45309' : '#2c5282'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>
          </Row>
          )}

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
                  時數只算考試前的課程／活動。點上方卡片的「有進步學生」，會鎖定該科全部有進步的人，再帶到 B2 達標或原始資料頁。有匯出權限才能在那一頁下載檔案。
                </p>
                {nextSet ? (
                  <LearningAnalyticsNextSteps
                    label={nextSet.label}
                    studentIds={nextSet.studentIds}
                    total={nextSet.total}
                    truncated={nextSet.truncated}
                    note={nextSet.note}
                    snapshotVersion={appliedFilters.snapshot_version || ''}
                    source={nextSet.source}
                    sourcePath="/admin/learning-analytics/skills"
                    canExport={canExport}
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
