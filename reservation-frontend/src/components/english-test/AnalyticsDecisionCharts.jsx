import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatEnglishTestSemesterLabel } from '../../utils/englishTestSemesterDisplay';
import {
  CHART_AXIS_LABEL,
  CHART_AXIS_TICK,
  CHART_CURSOR_FILL,
  CHART_MARGIN,
  ChartGrid,
  ChartTooltip,
} from '../charts';

const ATTENDANCE_SKILLS = [
  { code: 'L', label: '聽力' },
  { code: 'R', label: '閱讀' },
  { code: 'S', label: '口說' },
  { code: 'W', label: '寫作' },
];

const SCORE_SKILLS = [
  { key: 'listening', label: '聽力', fill: '#2a5d9f' },
  { key: 'reading', label: '閱讀', fill: '#4a8bc2' },
  { key: 'speaking', label: '口說', fill: '#5b8f7a' },
  { key: 'writing', label: '寫作', fill: '#c4a35a' },
];

const ATTENDANCE_SERIES = [
  { key: 'markedPresent', label: '匯入標示出席', fill: '#5b8f7a' },
  { key: 'markedAbsent', label: '匯入標示缺席', fill: '#c0725a' },
  { key: 'missingRecord', label: '沒有匯入紀錄', fill: '#c4a35a' },
];

const UNREADABLE_SERIES = {
  key: 'unreadableMark',
  label: '匯入標記無法判讀',
  fill: '#8a847c',
};

const CEFR_SERIES = [
  { key: 'A1', label: 'A1', fill: '#d6e2f0' },
  { key: 'A1+', label: 'A1+', fill: '#c5d4e8', optional: true },
  { key: 'A2', label: 'A2', fill: '#a9c6e2' },
  { key: 'A2+', label: 'A2+', fill: '#8eb4d8', optional: true },
  { key: 'B1', label: 'B1', fill: '#6aa3d4' },
  { key: 'B1+', label: 'B1+', fill: '#4d8ec8', optional: true },
  { key: 'B2', label: 'B2', fill: '#2a5d9f' },
  { key: 'B2+', label: 'B2+', fill: '#1e4678', optional: true },
  { key: 'C1', label: 'C1', fill: '#5b8f7a' },
  { key: 'C1+', label: 'C1+', fill: '#3f6d5c', optional: true },
  { key: 'C2', label: 'C2', fill: '#2f6a52' },
  { key: 'C2+', label: 'C2+', fill: '#1d4636', optional: true },
  { key: 'missing', label: '有成績但沒有等級', fill: '#c4a35a' },
  { key: 'unrecognized', label: '無法辨識的等級', fill: '#8a6a62', optional: true },
];

function finiteCount(value) {
  if (value == null || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function formatPeople(value) {
  const count = finiteCount(value);
  if (count == null) return '未提供';
  return count.toLocaleString('zh-Hant');
}

function formatShare(count, total) {
  if (count == null) return '未提供';
  if (!total) return '0.0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

function formatB2Ratio(count, total) {
  const numerator = finiteCount(count);
  const denominator = finiteCount(total);
  if (numerator == null || denominator == null) return '未提供';
  if (denominator === 0) return '沒有有成績的人';
  return `${formatPeople(numerator)}／${formatPeople(denominator)} 人（${formatShare(numerator, denominator)}）`;
}

function ratePercent(skill) {
  const numerator = finiteCount(skill?.b2OrAboveCount);
  const denominator = finiteCount(skill?.denominator);
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function semesterLabel(semester) {
  return formatEnglishTestSemesterLabel(semester) || semester;
}

function LegendList({ items }) {
  return (
    <ul className="et-analytics-legend">
      {items.map((item) => (
        <li key={item.key}>
          <i style={{ background: item.fill }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function GradeChart({ rows, total }) {
  const chartData = rows.filter((row) => row.count != null).map((row) => ({
    name: row.label,
    fullName: row.label,
    count: row.count,
  }));
  return (
    <div className="et-analytics-plot" style={{ height: 240 }} data-testid="grade-composition-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ ...CHART_MARGIN.bar, bottom: 48 }} barCategoryGap="22%">
          <ChartGrid vertical={false} />
          <XAxis dataKey="name" tick={CHART_AXIS_LABEL} interval={0} axisLine={false} tickLine={false} height={36} />
          <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={CHART_CURSOR_FILL}
            content={(tipProps) => (
              <ChartTooltip
                {...tipProps}
                preferFullName
                formatName={() => '筆數'}
                formatValue={(value) => `${formatPeople(value)} 筆（${formatShare(finiteCount(value), total)}）`}
              />
            )}
          />
          <Bar dataKey="count" name="筆數" fill="#2a5d9f" radius={[8, 8, 0, 0]} maxBarSize={42} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StackedSkillChart({
  rows,
  series,
  testId,
  totalKey,
  expand = false,
}) {
  return (
    <div className="et-analytics-plot" style={{ height: 280 }} data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ ...CHART_MARGIN.bar, bottom: 28 }}
          barCategoryGap="28%"
          stackOffset={expand ? 'expand' : 'none'}
        >
          <ChartGrid vertical={false} />
          <XAxis dataKey="name" tick={CHART_AXIS_LABEL} interval={0} axisLine={false} tickLine={false} />
          <YAxis
            allowDecimals={expand}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={expand ? 48 : 40}
            tickFormatter={expand ? (value) => `${Math.round(Number(value) * 100)}%` : undefined}
          />
          <Tooltip
            cursor={CHART_CURSOR_FILL}
            content={(tipProps) => (
              <ChartTooltip
                {...tipProps}
                preferFullName
                formatValue={(value, name, item) => {
                  const count = finiteCount(item?.payload?.[item.dataKey]);
                  const total = finiteCount(item?.payload?.[totalKey]);
                  return `${formatPeople(count)} 人（${formatShare(count, total)}）`;
                }}
              />
            )}
          />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stackId="skill"
              fill={item.fill}
              maxBarSize={48}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SittingChart({ rows }) {
  return (
    <div
      className="et-analytics-plot"
      style={{ height: 300 }}
      data-testid="sitting-b2-chart"
      data-chart="bar"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ ...CHART_MARGIN.bar, bottom: 28 }}>
          <ChartGrid vertical={false} />
          <XAxis dataKey="name" tick={CHART_AXIS_LABEL} interval={0} axisLine={false} tickLine={false} height={36} />
          <YAxis
            domain={[0, 100]}
            allowDecimals={false}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            cursor={CHART_CURSOR_FILL}
            content={(tipProps) => (
              <ChartTooltip
                {...tipProps}
                preferFullName
                formatValue={(value, name, item) => {
                  const count = item?.payload?.[`${item.dataKey}Count`];
                  const denominator = item?.payload?.[`${item.dataKey}Denom`];
                  if (value == null) return '沒有有成績的人';
                  return formatB2Ratio(count, denominator);
                }}
              />
            )}
          />
          {SCORE_SKILLS.map((skill) => (
            <Bar
              key={skill.key}
              dataKey={skill.key}
              name={skill.label}
              fill={skill.fill}
              radius={[6, 6, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AnalyticsDecisionCharts({
  semester = '',
  registrationCount = 0,
  grade = { data: [], total: 0 },
  attendance = null,
  scores = null,
  sittingB2Rates = null,
}) {
  const singleSitting = semester && semester !== 'all';
  const gradeRows = useMemo(
    () => (grade.data || []).map((row) => ({
      label: row.label || '未填寫',
      count: finiteCount(row.count),
    })),
    [grade],
  );
  const gradeTotal = finiteCount(grade.total) || 0;
  const omitted = Math.max(0, registrationCount - gradeTotal);
  const attendanceBlocked = !singleSitting || attendance?.importStatus === 'not_for_all_semesters';
  const attendanceImported = singleSitting && attendance?.importStatus === 'imported';
  const scoreBlocked = !singleSitting || scores?.importStatus === 'not_for_all_semesters';
  const scoresImported = singleSitting && scores?.importStatus === 'imported';

  const attendanceSeries = useMemo(() => {
    const hasUnreadable = ATTENDANCE_SKILLS.some(
      (skill) => (finiteCount(attendance?.skills?.[skill.code]?.unreadableMark) || 0) > 0,
    );
    return hasUnreadable ? [...ATTENDANCE_SERIES, UNREADABLE_SERIES] : ATTENDANCE_SERIES;
  }, [attendance]);

  const attendanceRows = attendanceImported
    ? ATTENDANCE_SKILLS.map((skill) => {
        const source = attendance.skills?.[skill.code] || {};
        return {
          name: skill.label,
          fullName: skill.label,
          markedPresent: finiteCount(source.markedPresent) || 0,
          markedAbsent: finiteCount(source.markedAbsent) || 0,
          missingRecord: finiteCount(source.missingRecord) || 0,
          unreadableMark: finiteCount(source.unreadableMark) || 0,
          eligible: finiteCount(source.eligible) || 0,
        };
      })
    : [];

  const cefrSeries = useMemo(() => {
    const skills = scores?.skills || {};
    return CEFR_SERIES.filter((segment) => {
      if (!segment.optional) return true;
      return SCORE_SKILLS.some((skill) => (finiteCount(skills[skill.key]?.cefr?.[segment.key]) || 0) > 0);
    });
  }, [scores]);

  const scoreRows = scoresImported
    ? SCORE_SKILLS.map((skill) => {
        const source = scores.skills?.[skill.key];
        const cefr = source?.cefr || {};
        return {
          name: skill.label,
          fullName: skill.label,
          ...Object.fromEntries(CEFR_SERIES.map((segment) => [
            segment.key,
            finiteCount(cefr[segment.key]) || 0,
          ])),
          denominator: finiteCount(source?.denominator) || 0,
          b2OrAboveCount: finiteCount(source?.b2OrAboveCount),
          b2LevelCount: finiteCount(source?.b2LevelCount),
        };
      }).filter((row) => row.denominator > 0)
    : [];

  const sittingRows = useMemo(() => {
    const sittings = sittingB2Rates?.sumsPeople === false ? (sittingB2Rates.sittings || []) : [];
    return sittings
      .filter((sitting) => sitting.importStatus === 'imported')
      .map((sitting) => {
        const row = {
          name: sitting.semester,
          fullName: semesterLabel(sitting.semester),
        };
        let drawable = false;
        SCORE_SKILLS.forEach((skill) => {
          const source = sitting.skills?.[skill.key];
          const percent = ratePercent(source);
          row[skill.key] = percent;
          row[`${skill.key}Count`] = finiteCount(source?.b2OrAboveCount);
          row[`${skill.key}Denom`] = finiteCount(source?.denominator);
          if (percent != null) drawable = true;
        });
        row.population = sitting.population === 'scores_only' ? 'scores_only' : 'registered';
        if (row.population === 'scores_only') {
          row.fullName = `${row.fullName}（成績匯入）`;
        }
        return drawable ? row : null;
      })
      .filter(Boolean);
  }, [sittingB2Rates]);

  return (
    <div className="et-analytics-decision" role="tabpanel">
      {!singleSitting ? (
        <p className="et-analytics-status" role="status">
          年級組成、四技能匯入狀態和四技能等級是單一次考試。請改選單一學期。各次達標率仍可往下看。
        </p>
      ) : (
        <>
          <section className="et-analytics-panel" aria-labelledby="decision-grade-title">
            <div className="et-analytics-panel-head">
              <div>
                <h3 id="decision-grade-title">這次考試的年級組成</h3>
                <p>只計算有填年級的報名。這是報名表列數，不是不重複學生數，也不是到考人數。</p>
              </div>
            </div>
            {registrationCount === 0 ? (
              <p className="et-analytics-status" role="status">這個學期沒有報名資料。</p>
            ) : null}
            {registrationCount > 0 && gradeRows.length === 0 ? (
              <p className="et-analytics-status" role="status">這個範圍有報名，但沒有可彙整的年級。</p>
            ) : null}
            {gradeRows.length > 0 ? (
              <>
                {omitted > 0 ? (
                  <p className="et-analytics-omitted">
                    報名 {formatPeople(registrationCount)} 筆裡，有 {formatPeople(gradeTotal)} 筆填了年級，另外 {formatPeople(omitted)} 筆空白，沒有畫進圖裡，也不會被補成 0。
                  </p>
                ) : null}
                <p className="et-analytics-unit">單位：筆。占比以有填年級的筆數為分母。</p>
                <GradeChart rows={gradeRows} total={gradeTotal} />
                <div className="table-responsive et-analytics-table-wrap">
                  <table className="table table-sm align-middle mb-0 et-analytics-table">
                    <caption className="et-analytics-caption">占比以有填年級的報名筆數為分母。</caption>
                    <thead>
                      <tr>
                        <th scope="col">年級</th>
                        <th scope="col">筆數</th>
                        <th scope="col">占比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeRows.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          <td>{formatPeople(row.count)}</td>
                          <td>{formatShare(row.count, gradeTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>

          <section className="et-analytics-panel" aria-labelledby="decision-attendance-title">
            <div className="et-analytics-panel-head">
              <div>
                <h3 id="decision-attendance-title">這次考試的四技能匯入狀態</h3>
                <p>
                  {attendance?.presentLabel || '匯入紀錄標示出席，來源尚待確認'}
                  。長條長度是應考人數。這不是到考率。
                </p>
              </div>
            </div>
            {attendanceBlocked ? (
              <p className="et-analytics-status" role="status">不能把不同考試的出席紀錄加總。</p>
            ) : null}
            {!attendanceBlocked && !attendance ? (
              <p className="et-analytics-status" role="status">出席統計尚未由這次查詢提供。</p>
            ) : null}
            {!attendanceBlocked && attendance?.importStatus === 'none' ? (
              <p className="et-analytics-status" role="status">這個學期沒有出席匯入。缺少匯入列不是缺席。</p>
            ) : null}
            {attendanceImported ? (
              <>
                <p className="et-analytics-unit">
                  圖上各段加總等於該技能應考人數。沒有匯入紀錄不是缺席。
                </p>
                <StackedSkillChart
                  rows={attendanceRows}
                  series={attendanceSeries}
                  testId="attendance-overview-chart"
                  totalKey="eligible"
                />
                <LegendList items={attendanceSeries} />
                <div className="table-responsive et-analytics-table-wrap">
                  <table className="table table-sm align-middle mb-0 et-analytics-table">
                    <caption className="et-analytics-caption">占比以該技能成功報名的應考人數為分母。匯入標示出席尚未確認來源。</caption>
                    <thead>
                      <tr>
                        <th scope="col">技能</th>
                        {attendanceSeries.map((item) => (
                          <th key={item.key} scope="col">{item.label}</th>
                        ))}
                        <th scope="col">應考</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRows.map((row) => (
                        <tr key={row.name}>
                          <th scope="row">{row.name}</th>
                          {attendanceSeries.map((item) => (
                            <td key={item.key}>{formatPeople(row[item.key])}</td>
                          ))}
                          <td>{formatPeople(row.eligible)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>

          <section className="et-analytics-panel" aria-labelledby="decision-score-title">
            <div className="et-analytics-panel-head">
              <div>
                <h3 id="decision-score-title">這次考試的四技能等級與達 B2 以上</h3>
                <p>{scores?.cefrResolutionNote || '圖上是匯入後保存的等級。新匯入保留加號。更早已經拿掉加號的列不能還原。'}</p>
              </div>
            </div>
            {scoreBlocked ? (
              <p className="et-analytics-status" role="status">不能把不同考試的成績加總。</p>
            ) : null}
            {!scoreBlocked && !scores ? (
              <p className="et-analytics-status" role="status">成績統計尚未由這次查詢提供。</p>
            ) : null}
            {!scoreBlocked && scores?.importStatus === 'none' ? (
              <p className="et-analytics-status" role="status">這個學期沒有成績匯入。成績缺漏不會被補成 0 分。</p>
            ) : null}
            {scoresImported ? (
              <>
                <p className="et-analytics-unit">
                  每一條是 100%，分母是該技能有成績的人。達 B2 以上是 B2、B2+、C1、C1+、C2、C2+。有成績但沒有等級的人留在分母。
                </p>
                {scoreRows.length > 0 ? (
                  <>
                    <StackedSkillChart
                      rows={scoreRows}
                      series={cefrSeries}
                      testId="score-overview-chart"
                      totalKey="denominator"
                      expand
                    />
                    <LegendList items={cefrSeries} />
                  </>
                ) : (
                  <p className="et-analytics-status" role="status">這次考試沒有可以畫成等級分布的技能。</p>
                )}
                <ul className="et-analytics-callouts">
                  {SCORE_SKILLS.map((skill) => {
                    const source = scores.skills?.[skill.key];
                    return (
                      <li key={skill.key}>
                        <span>{skill.label}達 B2 以上</span>
                        <strong>{formatB2Ratio(source?.b2OrAboveCount, source?.denominator)}</strong>
                        <span>等級正好是 B2 的有 {formatPeople(source?.b2LevelCount)} 人</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </section>
        </>
      )}

      <section className="et-analytics-panel" aria-labelledby="decision-sitting-title">
        <div className="et-analytics-panel-head">
          <div>
            <h3 id="decision-sitting-title">歷年四項成績技能達成率</h3>
            <p>
              {sittingB2Rates?.note || '各次考試各自計算。人數不加總。同一位學生可以出現在多次考試。'}
              {' '}這張圖不跟著「全部學期」停用，因為每一次都用自己的分母。
            </p>
          </div>
        </div>
        {sittingB2Rates == null ? (
          <p className="et-analytics-status" role="status">各次達標率尚未由這次查詢提供。</p>
        ) : null}
        {sittingB2Rates?.sumsPeople === true ? (
          <p className="et-analytics-status" role="status">這份各次比較會把人數加總，所以沒有畫。</p>
        ) : null}
        {sittingB2Rates?.sumsPeople === false && (sittingB2Rates.sittings || []).length === 0 ? (
          <p className="et-analytics-status" role="status">目前沒有可以並排的考試。</p>
        ) : null}
        {sittingB2Rates?.sumsPeople === false && (sittingB2Rates.sittings || []).length > 0 ? (
          <>
            <p className="et-analytics-unit">
              單位：該次、該技能有成績人數中的百分比。長條圖的每一次各自計算，人數不加總。沒有成績匯入，或該技能沒有有成績的人，不會畫成 0%。
            </p>
            {sittingRows.length > 0 ? (
              <>
                <SittingChart rows={sittingRows} />
                <LegendList items={SCORE_SKILLS} />
              </>
            ) : (
              <p className="et-analytics-status" role="status">目前沒有可以畫進圖裡的達標率。</p>
            )}
            <div className="table-responsive et-analytics-table-wrap">
              <table className="table table-sm align-middle mb-0 et-analytics-table">
                <caption className="et-analytics-caption">每一格都是該次考試、該技能自己的分子和分母。不要把欄位相加。</caption>
                <thead>
                  <tr>
                    <th scope="col">考試</th>
                    {SCORE_SKILLS.map((skill) => (
                      <th key={skill.key} scope="col">{skill.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sittingB2Rates.sittings.map((sitting) => (
                    <tr key={sitting.semester}>
                      <th scope="row">
                        {semesterLabel(sitting.semester)}
                        {sitting.population === 'scores_only' ? '（成績匯入）' : ''}
                      </th>
                      {SCORE_SKILLS.map((skill) => (
                        <td key={skill.key}>
                          {sitting.importStatus === 'none'
                            ? '沒有成績匯入'
                            : formatB2Ratio(sitting.skills?.[skill.key]?.b2OrAboveCount, sitting.skills?.[skill.key]?.denominator)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
