// 培力英檢數據分析：沿用既有報名統計 API，一次只呈現一個分析主題。
import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatEnglishTestSemesterLabel } from '../../utils/englishTestSemesterDisplay';
import {
  CHART_AXIS_TICK,
  CHART_AXIS_LABEL,
  CHART_CURSOR_FILL,
  CHART_MARGIN,
  CHART_SERIES,
  withChartFills,
  ChartGrid,
  ChartTooltip,
} from '../charts';
import './AnalyticsSection.css';

const TOPICS = [
  { id: 'registration', label: '報名概況' },
  { id: 'attendance', label: '出席紀錄' },
  { id: 'skills', label: '四技能成績' },
];

const ATTENDANCE_SKILLS = [
  { code: 'L', label: '聽力' },
  { code: 'R', label: '閱讀' },
  { code: 'S', label: '口說' },
  { code: 'W', label: '寫作' },
];

const SCORE_SKILLS = [
  { key: 'listening', label: '聽力' },
  { key: 'reading', label: '閱讀' },
  { key: 'speaking', label: '口說' },
  { key: 'writing', label: '寫作' },
];

const CEFR_LABELS = [
  ['A1', 'A1'],
  ['A2', 'A2'],
  ['B1', 'B1'],
  ['B2', 'B2'],
  ['C1', 'C1'],
  ['C2', 'C2'],
];

const EXAM_TYPE_LABELS = [
  ['LRSW', '聽讀說寫'],
  ['LR', '聽讀'],
  ['SW', '說寫'],
  ['NON', '不報考'],
  ['other', '其他'],
];

function finiteCount(value) {
  if (value == null || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function sumCounts(semesterCounts) {
  return Object.values(semesterCounts || {}).reduce(
    (sum, value) => sum + (finiteCount(value) || 0),
    0,
  );
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

function exportCsv({ filePrefix, rows, total, semester }) {
  const exportable = rows.filter((row) => row.count != null);
  if (exportable.length === 0) return;
  const header = '選項,人數,占比%\n';
  const body = exportable
    .map((row) => {
      const share = total ? ((row.count / total) * 100).toFixed(1) : '0.0';
      return `"${String(row.label || '').replace(/"/g, '""')}",${row.count},${share}`;
    })
    .join('\n');
  const blob = new Blob([`\ufeff${header}${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const semTag = semester && semester !== 'all' ? `_${semester}` : '_全部';
  a.href = url;
  a.download = `培力英檢_${filePrefix}${semTag}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RegistrationChart({
  rows,
  total,
  horizontal = false,
  testId = 'registration-chart',
  unit = '人',
  axisWidth = 128,
}) {
  const chartData = withChartFills(rows.filter((row) => row.count != null));
  const [activeIndex, setActiveIndex] = useState(null);
  const height = horizontal
    ? Math.max(168, Math.min(520, chartData.length * 44 + 28))
    : 240;

  return (
    <div className="et-analytics-plot" style={{ height }} data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={horizontal ? CHART_MARGIN.barHorizontal : { ...CHART_MARGIN.bar, bottom: 48 }}
          barCategoryGap="22%"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <ChartGrid vertical={!horizontal} horizontal />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                allowDecimals={false}
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={axisWidth}
                tick={CHART_AXIS_LABEL}
                interval={0}
                axisLine={false}
                tickLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={CHART_AXIS_LABEL}
                interval={0}
                axisLine={false}
                tickLine={false}
                height={36}
              />
              <YAxis
                allowDecimals={false}
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={40}
              />
            </>
          )}
          <Tooltip
            cursor={CHART_CURSOR_FILL}
            content={(tipProps) => (
              <ChartTooltip
                {...tipProps}
                preferFullName
                formatName={() => (unit === '筆' ? '筆數' : '人數')}
                formatValue={(value) => `${formatPeople(value)} ${unit}（${formatShare(finiteCount(value), total)}）`}
              />
            )}
          />
          <Bar
            dataKey="count"
            name={unit === '筆' ? '筆數' : '人數'}
            radius={horizontal ? [0, 8, 8, 0] : [8, 8, 0, 0]}
            fill={CHART_SERIES.primary}
            maxBarSize={42}
            isAnimationActive={false}
            onMouseEnter={(_, index) => setActiveIndex(index)}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`${entry.fullName}-${index}`}
                fill={CHART_SERIES.primary}
                fillOpacity={activeIndex == null || activeIndex === index ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RegistrationTable({ rows, total, caption, countLabel = '人數' }) {
  return (
    <div className="table-responsive et-analytics-table-wrap">
      <table className="table table-sm align-middle mb-0 et-analytics-table">
        <caption className="et-analytics-caption">
          {caption || '人數是有填寫該欄的報名表列數。占比以這些有填寫的列為分母。'}
        </caption>
        <thead>
          <tr>
            <th scope="col">選項</th>
            <th scope="col">{countLabel}</th>
            <th scope="col">占比</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{formatPeople(row.count)}</td>
              <td>{formatShare(row.count, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsSection({
  loading,
  error = '',
  semester = '',
  onSemesterChange,
  availableSemesters = [],
  semesterCounts = {},
  activeSemester = '',
  infoSource = { data: [], total: 0 },
  department = { data: [], total: 0 },
  grade = { data: [], total: 0 },
  registrationSummary = null,
  attendance = null,
  scores = null,
}) {
  const [topic, setTopic] = useState('registration');
  const [slice, setSlice] = useState('grade');
  const [view, setView] = useState('chart');
  const [attendanceSkill, setAttendanceSkill] = useState('L');
  const [attendanceView, setAttendanceView] = useState('chart');
  const [scoreSkill, setScoreSkill] = useState('listening');
  const [scoreView, setScoreView] = useState('chart');

  const semesterOptions = useMemo(() => {
    const merged = [...(availableSemesters || []).filter(Boolean)];
    if (activeSemester && !merged.includes(activeSemester)) merged.unshift(activeSemester);
    if (semester && semester !== 'all' && !merged.includes(semester)) merged.unshift(semester);
    const allCount = sumCounts(semesterCounts);
    const withCount = (count) => (count > 0 ? `（${formatPeople(count)}）` : '');
    return [
      { value: 'all', label: `全部學期${withCount(allCount)}` },
      ...merged.map((sem) => ({
        value: sem,
        label: `${formatEnglishTestSemesterLabel(sem) || sem}${sem === activeSemester ? '（目前學期）' : ''}${withCount(finiteCount(semesterCounts?.[sem]) || 0)}`,
      })),
    ];
  }, [availableSemesters, semesterCounts, activeSemester, semester]);

  const selectValue = semester || activeSemester || availableSemesters[0] || '';
  const rangeLabel = !selectValue
    ? '尚未選定'
    : selectValue === 'all'
      ? '全部學期'
      : (formatEnglishTestSemesterLabel(selectValue) || selectValue);
  const registrationCount = selectValue
    ? (selectValue === 'all' ? sumCounts(semesterCounts) : (finiteCount(semesterCounts?.[selectValue]) || 0))
    : 0;

  const slices = useMemo(() => ({
    grade: {
      label: '年級分布',
      title: '哪些年級有報名',
      field: '年級',
      rows: grade.data || [],
      total: finiteCount(grade.total) || 0,
      horizontal: false,
      filePrefix: '年級分布',
      note: '只計算有填年級的報名。',
    },
    department: {
      label: '系所分布',
      title: '哪些系所有報名',
      field: '系所',
      rows: department.data || [],
      total: finiteCount(department.total) || 0,
      horizontal: true,
      filePrefix: '系所分布',
      note: '只計算有填系所的報名。',
    },
    source: {
      label: '從何得知',
      title: '學生從哪裡知道培力英檢',
      field: '宣傳來源',
      rows: infoSource.data || [],
      total: finiteCount(infoSource.total) || 0,
      horizontal: true,
      filePrefix: '從何得知',
      note: '只計算有填「從何得知」的報名。',
    },
    semesters: {
      label: '各學期報名',
      title: '各學期報名筆數',
      field: '學期',
      rows: Object.entries(semesterCounts || {}).map(([key, count]) => ({
        label: formatEnglishTestSemesterLabel(key) || key,
        count: finiteCount(count),
      })),
      total: sumCounts(semesterCounts),
      horizontal: false,
      filePrefix: '各學期報名',
      note: '每一點都是該學期的報名表列數，用來對照報名規模，不是技能表現，也不是到考人數。',
    },
    examType: {
      label: '報考項目',
      title: '報名表上的報考項目',
      field: '報考項目',
      rows: EXAM_TYPE_LABELS.map(([key, label]) => ({
        label,
        count: registrationSummary?.byExamType ? finiteCount(registrationSummary.byExamType[key]) : null,
      })),
      total: registrationSummary?.byExamType
        ? EXAM_TYPE_LABELS.reduce((sum, [key]) => sum + (finiteCount(registrationSummary.byExamType[key]) || 0), 0)
        : 0,
      horizontal: false,
      filePrefix: '報考項目',
      note: '不報考會留在報名分布裡，但不進入聽、讀、說、寫的應考母體。',
    },
  }), [grade, department, infoSource, semesterCounts, registrationSummary]);

  const current = slices[slice] || slices.grade;
  const rows = (current.rows || []).map((row) => ({
    label: row.label || '未填寫',
    count: finiteCount(row.count),
  }));
  const omitted = ['grade', 'department', 'source'].includes(slice)
    ? Math.max(0, registrationCount - current.total)
    : 0;
  const successCount = registrationSummary ? finiteCount(registrationSummary.successStudentCount) : null;
  const examPopulationCount = registrationSummary ? finiteCount(registrationSummary.examPopulationStudentCount) : null;
  const attendanceScopeBlocked = selectValue === 'all' || attendance?.importStatus === 'not_for_all_semesters';
  const attendanceImported = !attendanceScopeBlocked && attendance?.importStatus === 'imported';
  const selectedAttendance = attendance?.skills?.[attendanceSkill] || null;
  const attendanceRows = attendanceImported ? [
    { label: '匯入紀錄標示出席', count: finiteCount(selectedAttendance?.markedPresent) },
    { label: '匯入紀錄標示缺席', count: finiteCount(selectedAttendance?.markedAbsent) },
    { label: '沒有匯入紀錄', count: finiteCount(selectedAttendance?.missingRecord) },
  ] : [];
  const scoreScopeBlocked = selectValue === 'all' || scores?.importStatus === 'not_for_all_semesters';
  const scoresImported = !scoreScopeBlocked && scores?.importStatus === 'imported';
  const selectedScore = scores?.skills?.[scoreSkill] || null;
  const scoreRows = scoresImported && selectedScore?.cefr ? [
    ...CEFR_LABELS.map(([key, label]) => ({ label, count: finiteCount(selectedScore.cefr[key]) })),
    { label: '有成績但沒有等級', count: finiteCount(selectedScore.cefr.missing) },
    { label: '無法辨識的等級', count: finiteCount(selectedScore.cefr.unrecognized) },
  ] : [];
  const showWorkbench = !loading && !error && (
    registrationCount > 0 || (slice === 'semesters' && current.total > 0)
  );

  return (
    <section className="et-analytics" aria-labelledby="et-analytics-title">
      <header className="et-analytics-header">
        <div>
          <h2 id="et-analytics-title" className="et-analytics-title">培力英檢數據分析</h2>
          <p className="et-analytics-purpose">
            分開看報名組成、出席匯入與四技能成績。三份母體各自計算，不能混在一起。
          </p>
        </div>
        <div className="et-analytics-filter">
          <label htmlFor="english-test-analytics-semester">學期</label>
          <select
            id="english-test-analytics-semester"
            value={selectValue}
            onChange={(event) => onSemesterChange?.(event.target.value)}
            disabled={loading || !selectValue}
          >
            {semesterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </header>

      <p className="et-analytics-range">
        目前查看：{rangeLabel}。報名筆數不是到考人數。
      </p>

      <div className="et-analytics-topics" role="tablist" aria-label="分析主題">
        {TOPICS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={topic === item.id}
            onClick={() => setTopic(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="alert alert-danger et-analytics-alert" role="alert">{error}</div>
      ) : null}

      {loading ? (
        <p className="et-analytics-status" role="status">載入統計資料中...</p>
      ) : null}

      {topic === 'registration' && !loading && !error && !showWorkbench ? (
        <p className="et-analytics-status" role="status">這個範圍沒有報名資料。</p>
      ) : null}

      {topic === 'registration' && showWorkbench ? (
        <div className="et-analytics-workbench" role="tabpanel">
          <dl className="et-analytics-facts">
            <div>
              <dt>報名筆數</dt>
              <dd>{formatPeople(registrationCount)}</dd>
              <p>有填學期的報名表列數</p>
            </div>
            <div>
              <dt>有填年級</dt>
              <dd>{formatPeople(grade.total)}</dd>
              <p>空白年級不計入</p>
            </div>
            <div>
              <dt>報名成功</dt>
              <dd>{formatPeople(successCount)}</dd>
              <p>成功報名學生數，含不報考</p>
            </div>
          </dl>

          <div className="et-analytics-slices" role="group" aria-label="報名分析內容">
            {Object.entries(slices).map(([id, item]) => (
              <button
                key={id}
                type="button"
                aria-pressed={slice === id}
                onClick={() => {
                  setSlice(id);
                  setView('chart');
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="et-analytics-panel">
            <div className="et-analytics-panel-head">
              <div>
                <h3>{current.title}</h3>
                <p>{current.note}</p>
              </div>
              <div className="et-analytics-view" role="group" aria-label="呈現方式">
                <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>圖表</button>
                <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>明細</button>
                <button
                  type="button"
                  onClick={() => exportCsv({
                    filePrefix: current.filePrefix,
                    rows,
                    total: current.total,
                    semester: selectValue,
                  })}
                  disabled={!rows.some((row) => row.count != null)}
                >
                  匯出 CSV
                </button>
              </div>
            </div>

            {omitted > 0 ? (
              <p className="et-analytics-omitted">
                報名 {formatPeople(registrationCount)} 筆裡，有 {formatPeople(current.total)} 筆填了{current.field}，另外 {formatPeople(omitted)} 筆空白，沒有畫進圖裡，也不會被補成 0。
              </p>
            ) : null}

            {rows.length === 0 ? (
              <p className="et-analytics-status" role="status">這個範圍有報名，但沒有可彙整的{current.field}。</p>
            ) : null}

            {rows.length > 0 && view === 'chart' ? (
              <>
                <p className="et-analytics-unit">單位：筆。這是報名表列數，不是不重複學生數。占比在提示與明細表。</p>
                <RegistrationChart rows={rows} total={current.total} horizontal={current.horizontal} unit="筆" />
              </>
            ) : null}

            {rows.length > 0 && view === 'table' ? (
              <RegistrationTable
                rows={rows}
                total={current.total}
                countLabel="筆數"
                caption="每一列是一筆報名，不是不重複學生數。占比以有填該欄的筆數為分母。"
              />
            ) : null}

            <details className="et-analytics-definition">
              <summary>資料母體與統計口徑</summary>
              <ul>
                <li>報名筆數是選定範圍裡、有填學期的報名表列數。</li>
                <li>年級、系所、從何得知各自只計算有填該欄的列。空白不進入該圖的分母。</li>
                <li>報名成功是狀態為成功的學生數，和全部報名筆數分開。不報考仍算報名成功，但不算四技能應考。</li>
                <li>四技能應考學生數是 {formatPeople(examPopulationCount)}。學號空白，或同一張表裡大小寫不同卻折成同一個學號的列，不會併進這個母體。</li>
                <li>人數 0 代表該選項真的是 0；沒有回傳的欄位會標成未提供，不會顯示成 0。</li>
                <li>各學期報名只比較報名筆數。跨學期的出席與成績比較尚未提供，也不會把不同學期的成績加總。</li>
              </ul>
            </details>
            <p className="et-analytics-observation">
              這裡只說明報名規模與組成。出席匯入和成績在另外兩個主題，不會拿報名筆數去算到考或達 B2。
            </p>
          </div>
        </div>
      ) : null}

      {topic === 'attendance' && !loading && !error ? (
        <div className="et-analytics-workbench" role="tabpanel">
          <p className="et-analytics-caveat">
            {attendance?.presentLabel || '匯入紀錄標示出席，來源尚待確認'}。這不是確認到考，頁面也不計算到考率。
          </p>
          {attendanceScopeBlocked ? (
            <p className="et-analytics-status" role="status">全部學期不能把不同考試的出席紀錄加總。請改選單一學期。</p>
          ) : null}
          {!attendanceScopeBlocked && !attendance ? (
            <p className="et-analytics-status" role="status">出席統計尚未由這次查詢提供。</p>
          ) : null}
          {!attendanceScopeBlocked && attendance?.importStatus === 'none' ? (
            <>
              <p className="et-analytics-status" role="status">這個學期沒有出席匯入。缺少匯入列不是缺席。</p>
              <dl className="et-analytics-facts">
                {ATTENDANCE_SKILLS.map((skill) => (
                  <div key={skill.code}>
                    <dt>{skill.label}應考</dt>
                    <dd>{formatPeople(attendance.skills?.[skill.code]?.eligible)}</dd>
                    <p>成功報名且報考此技能</p>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          {attendanceImported ? (
            <>
              <div className="et-analytics-slices" role="group" aria-label="出席技能">
                {ATTENDANCE_SKILLS.map((skill) => (
                  <button
                    key={skill.code}
                    type="button"
                    aria-pressed={attendanceSkill === skill.code}
                    onClick={() => {
                      setAttendanceSkill(skill.code);
                      setAttendanceView('chart');
                    }}
                  >
                    {skill.label}
                  </button>
                ))}
              </div>
              <dl className="et-analytics-facts">
                <div>
                  <dt>應考人數</dt>
                  <dd>{formatPeople(selectedAttendance?.eligible)}</dd>
                  <p>成功報名且報考此技能</p>
                </div>
                <div>
                  <dt>匯入紀錄</dt>
                  <dd>{formatPeople(selectedAttendance?.imported)}</dd>
                  <p>有這一列，不代表已確認到考</p>
                </div>
                <div>
                  <dt>沒有匯入紀錄</dt>
                  <dd>{formatPeople(selectedAttendance?.missingRecord)}</dd>
                  <p>不是缺席</p>
                </div>
              </dl>
              <div className="et-analytics-panel">
                <div className="et-analytics-panel-head">
                  <div>
                    <h3>{ATTENDANCE_SKILLS.find((skill) => skill.code === attendanceSkill)?.label}出席匯入</h3>
                    <p>四技能都有匯入列，也不代表四技能都確認出席。</p>
                  </div>
                  <div className="et-analytics-view" role="group" aria-label="出席呈現方式">
                    <button type="button" aria-pressed={attendanceView === 'chart'} onClick={() => setAttendanceView('chart')}>圖表</button>
                    <button type="button" aria-pressed={attendanceView === 'table'} onClick={() => setAttendanceView('table')}>明細</button>
                  </div>
                </div>
                {attendanceRows.length > 0 && attendanceView === 'chart' ? (
                  <>
                    <p className="et-analytics-unit">單位：人。三個狀態加總等於這項技能的應考人數。</p>
                    <RegistrationChart
                      rows={attendanceRows}
                      total={finiteCount(selectedAttendance?.eligible) || 0}
                      testId="attendance-chart"
                      horizontal
                      axisWidth={156}
                    />
                  </>
                ) : null}
                {attendanceRows.length > 0 && attendanceView === 'table' ? (
                  <RegistrationTable
                    rows={attendanceRows}
                    total={finiteCount(selectedAttendance?.eligible) || 0}
                    caption="占比以這項技能的成功報名應考人數為分母。匯入標示出席尚未確認來源，不能讀成到考率。"
                  />
                ) : null}
                {attendance?.ignoredAggregateRows > 0 ? (
                  <p className="et-analytics-omitted">另有 {formatPeople(attendance.ignoredAggregateRows)} 列是聽讀或說寫的彙總列，已排除，避免和單科重複計算。</p>
                ) : null}
                {attendance?.unmatchedImportRows > 0 ? (
                  <p className="et-analytics-omitted">另有 {formatPeople(attendance.unmatchedImportRows)} 列對不到成功報名的應考技能，沒有算進上面的人數。</p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {topic === 'skills' && !loading && !error ? (
        <div className="et-analytics-workbench" role="tabpanel">
          {scoreScopeBlocked ? (
            <p className="et-analytics-status" role="status">全部學期不能把不同考試的成績加總。請改選單一學期。</p>
          ) : null}
          {!scoreScopeBlocked && !scores ? (
            <p className="et-analytics-status" role="status">成績統計尚未由這次查詢提供。</p>
          ) : null}
          {!scoreScopeBlocked && scores?.importStatus === 'none' ? (
            <p className="et-analytics-status" role="status">這個學期沒有成績匯入。成績缺漏不會被補成 0 分。</p>
          ) : null}
          {scoresImported ? (
            <>
              <div className="et-analytics-slices" role="group" aria-label="成績技能">
                {SCORE_SKILLS.map((skill) => (
                  <button
                    key={skill.key}
                    type="button"
                    aria-pressed={scoreSkill === skill.key}
                    onClick={() => {
                      setScoreSkill(skill.key);
                      setScoreView('chart');
                    }}
                  >
                    {skill.label}
                  </button>
                ))}
              </div>
              <dl className="et-analytics-facts">
                <div>
                  <dt>有成績</dt>
                  <dd>{formatPeople(selectedScore?.withScore)}</dd>
                  <p>0 分也算有成績</p>
                </div>
                <div>
                  <dt>成績缺漏</dt>
                  <dd>{formatPeople(selectedScore?.missingAmongEligible)}</dd>
                  <p>應考此技能但沒有分數</p>
                </div>
                <div>
                  <dt>達 B2 以上</dt>
                  <dd className="et-analytics-ratio">{formatB2Ratio(selectedScore?.b2OrAboveCount, selectedScore?.denominator)}</dd>
                  <p>分子是 B2、C1、C2。分母是這項技能有成績的人數，含有分數但沒有等級者。</p>
                </div>
              </dl>
              <div className="et-analytics-panel">
                <div className="et-analytics-panel-head">
                  <div>
                    <h3>{selectedScore?.label || '技能'} CEFR 分布</h3>
                    <p>{scores?.cefrResolutionNote}</p>
                  </div>
                  <div className="et-analytics-view" role="group" aria-label="成績呈現方式">
                    <button type="button" aria-pressed={scoreView === 'chart'} onClick={() => setScoreView('chart')}>圖表</button>
                    <button type="button" aria-pressed={scoreView === 'table'} onClick={() => setScoreView('table')}>明細</button>
                  </div>
                </div>
                <p className="et-analytics-unit">
                  單位：人。其中等級正好是 B2 的有 {formatPeople(selectedScore?.b2LevelCount)} 人。有成績但沒有等級的人留在分母，不會被挪去其他技能。
                </p>
                {scoreRows.length > 0 && scoreView === 'chart' ? (
                  <RegistrationChart
                    rows={scoreRows}
                    total={finiteCount(selectedScore?.denominator) || 0}
                    testId="score-chart"
                    axisWidth={148}
                  />
                ) : null}
                {scoreRows.length > 0 && scoreView === 'table' ? (
                  <RegistrationTable
                    rows={scoreRows}
                    total={finiteCount(selectedScore?.denominator) || 0}
                    caption="占比以這項技能有成績的人數為分母，不是報名筆數，也不是其他技能的人數。"
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

    </section>
  );
}
