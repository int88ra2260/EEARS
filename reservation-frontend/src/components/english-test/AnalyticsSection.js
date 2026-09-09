// 數據分析：學期篩選 + 共用 chart kit（Recharts / Bklit 質感）
import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Label,
} from 'recharts';
import { formatEnglishTestSemesterLabel } from '../../utils/englishTestSemesterDisplay';
import {
  CHART_ANIM,
  CHART_AXIS_TICK,
  CHART_AXIS_LABEL,
  CHART_CURSOR_FILL,
  CHART_MARGIN,
  chartColor,
  withChartFills,
  ChartCard,
  ChartGrid,
  ChartTooltip,
} from '../charts';
import './AnalyticsSection.css';

function exportCsv({ filePrefix, data, total, semester }) {
  if (!data || data.length === 0) return;
  const header = '選項,人數,占比%\n';
  const rows = data
    .map((row) => {
      const pct = total ? ((row.count / total) * 100).toFixed(1) : '0';
      return `"${String(row.label || '').replace(/"/g, '""')}",${row.count ?? 0},${pct}`;
    })
    .join('\n');
  const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const semTag = semester && semester !== 'all' ? `_${semester}` : '_全部';
  a.download = `培力英檢_${filePrefix}${semTag}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ChartCardShell({
  title,
  description,
  emptyHint,
  filePrefix,
  loading,
  data,
  total,
  semester,
  children,
}) {
  const empty = !loading && (!data || data.length === 0);

  if (loading || empty) {
    return (
      <div className="mb-4">
        <ChartCard
          title={title}
          loading={loading}
          empty={empty}
          emptyHint={emptyHint}
          emptyIcon="fa-chart-pie"
        />
      </div>
    );
  }

  return (
    <div className="mb-4">
      <ChartCard
        title={title}
        description={
          <>
            {description}總計 <strong>{total}</strong> 筆
          </>
        }
        actions={(
          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            onClick={() => exportCsv({ filePrefix, data, total, semester })}
          >
            <i className="fas fa-file-csv me-1" /> 匯出 CSV
          </button>
        )}
      >
        {children}
        <div className="table-responsive mt-3">
          <table className="table table-sm table-hover align-middle mb-0 et-analytics-table">
            <thead>
              <tr>
                <th>選項</th>
                <th style={{ width: '5rem' }}>人數</th>
                <th style={{ width: '5rem' }}>占比</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={`${row.label}-${i}`}>
                  <td>
                    <span
                      className="eears-chart-dot"
                      style={{ backgroundColor: chartColor(i) }}
                      aria-hidden
                    />
                    {row.label || ''}
                  </td>
                  <td>{row.count ?? 0}</td>
                  <td>{total ? ((row.count / total) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function DonutCenterLabel({ viewBox, total, activeLabel, activeCount }) {
  const { cx, cy } = viewBox || {};
  if (cx == null || cy == null) return null;
  const main = activeCount != null ? activeCount : total;
  const sub = activeLabel || '合計';
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" className="et-analytics-donut-value">
        {main}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="et-analytics-donut-label">
        {sub.length > 10 ? `${sub.slice(0, 10)}…` : sub}
      </text>
    </g>
  );
}

function PieStatCard(props) {
  const chartData = withChartFills(props.data);
  const [activeIndex, setActiveIndex] = useState(null);
  const active = activeIndex != null ? chartData[activeIndex] : null;

  return (
    <ChartCardShell {...props}>
      <div className="row g-3 align-items-center">
        <div className="col-lg-6" style={{ minHeight: 320 }}>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={72}
                outerRadius={108}
                paddingAngle={2.5}
                cornerRadius={6}
                stroke="#fff"
                strokeWidth={3}
                isAnimationActive
                animationBegin={0}
                animationDuration={CHART_ANIM.duration}
                animationEasing={CHART_ANIM.easing}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`pie-${index}`}
                    fill={entry.fill}
                    fillOpacity={
                      activeIndex == null || activeIndex === index ? 1 : 0.28
                    }
                    style={{
                      transform: activeIndex === index ? 'scale(1.03)' : 'scale(1)',
                      transformOrigin: 'center',
                      transition: 'fill-opacity 180ms ease, transform 180ms ease',
                      filter: activeIndex === index
                        ? 'drop-shadow(0 4px 10px rgba(42, 93, 159, 0.28))'
                        : 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
                <Label
                  content={(labelProps) => (
                    <DonutCenterLabel
                      {...labelProps}
                      total={props.total}
                      activeLabel={active?.fullName}
                      activeCount={active?.count}
                    />
                  )}
                />
              </Pie>
              <Tooltip
                content={(tipProps) => (
                  <ChartTooltip
                    {...tipProps}
                    preferFullName
                    formatName={() => ''}
                    formatValue={(v) => `${v} 人`}
                  />
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="col-lg-6">
          <div className="et-analytics-legend">
            {chartData.map((row, index) => {
              const pct = props.total ? (row.count / props.total) * 100 : 0;
              const isActive = activeIndex === index;
              const isDimmed = activeIndex != null && !isActive;
              return (
                <button
                  type="button"
                  key={row.fullName}
                  className={`et-analytics-legend__item${isActive ? ' is-active' : ''}${isDimmed ? ' is-dimmed' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                >
                  <span className="et-analytics-legend__meta">
                    <span className="eears-chart-dot" style={{ backgroundColor: row.fill }} aria-hidden />
                    <span className="et-analytics-legend__name" title={row.fullName}>{row.fullName}</span>
                  </span>
                  <span className="et-analytics-legend__stats">
                    <strong>{row.count}</strong>
                    <span className="text-muted">{pct.toFixed(1)}%</span>
                  </span>
                  <span className="et-analytics-legend__bar" aria-hidden>
                    <span style={{ width: `${pct}%`, backgroundColor: row.fill }} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ChartCardShell>
  );
}

function BarStatCard({ layout = 'vertical', ...props }) {
  const chartData = withChartFills(props.data);
  const [activeIndex, setActiveIndex] = useState(null);
  const isHorizontal = layout === 'horizontal';
  const chartHeight = isHorizontal
    ? Math.max(280, Math.min(720, (chartData.length || 1) * 36 + 56))
    : 340;

  return (
    <ChartCardShell {...props}>
      <div style={{ height: `${chartHeight}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout={isHorizontal ? 'vertical' : 'horizontal'}
            margin={isHorizontal ? CHART_MARGIN.barHorizontal : { ...CHART_MARGIN.bar, bottom: 56 }}
            barCategoryGap="22%"
            onMouseLeave={() => setActiveIndex(null)}
          >
            <ChartGrid vertical={!isHorizontal} horizontal />
            {isHorizontal ? (
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
                  width={132}
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
                  angle={-28}
                  textAnchor="end"
                  height={64}
                  tick={CHART_AXIS_LABEL}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
              </>
            )}
            <Tooltip
              cursor={CHART_CURSOR_FILL}
              content={(tipProps) => (
                <ChartTooltip
                  {...tipProps}
                  preferFullName
                  formatName={() => ''}
                  formatValue={(v) => `${v} 人`}
                />
              )}
            />
            <Bar
              dataKey="count"
              name="人數"
              radius={isHorizontal ? [0, 10, 10, 0] : [10, 10, 0, 0]}
              maxBarSize={44}
              isAnimationActive
              animationBegin={0}
              animationDuration={CHART_ANIM.duration}
              animationEasing={CHART_ANIM.easing}
              onMouseEnter={(_, index) => setActiveIndex(index)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`bar-${index}`}
                  fill={entry.fill}
                  fillOpacity={activeIndex == null || activeIndex === index ? 1 : 0.32}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCardShell>
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
}) {
  const semesterOptions = useMemo(() => {
    const fromApi = (availableSemesters || []).filter(Boolean);
    const merged = [...fromApi];
    if (activeSemester && !merged.includes(activeSemester)) {
      merged.unshift(activeSemester);
    }
    if (semester && semester !== 'all' && !merged.includes(semester)) {
      merged.unshift(semester);
    }
    const allCount = Object.values(semesterCounts || {}).reduce(
      (sum, n) => sum + (Number(n) || 0),
      0
    );
    const formatCount = (n) => (Number.isFinite(n) && n > 0 ? `（${n}）` : '');
    return [
      {
        value: 'all',
        label: `全部學期${formatCount(allCount)}`,
      },
      ...merged.map((sem) => {
        const count = Number(semesterCounts?.[sem]) || 0;
        const currentTag = sem === activeSemester ? '（目前）' : '';
        return {
          value: sem,
          label: `${formatEnglishTestSemesterLabel(sem) || sem}${currentTag}${formatCount(count)}`,
        };
      }),
    ];
  }, [availableSemesters, semesterCounts, activeSemester, semester]);

  // 空字串尚未解析時先顯示目前學期，避免誤顯示成「全部學期」
  const selectValue = semester || activeSemester || (availableSemesters[0] || '');

  return (
    <div className="et-analytics">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h4 className="mb-1">數據分析</h4>
          <p className="text-muted small mb-0">
            依報名資料彙整宣傳來源、系所與年級分布。預設目前學期，可切換批次或全部學期。
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="form-label mb-0 small text-muted text-nowrap" htmlFor="english-test-analytics-semester">
            學期
          </label>
          <select
            id="english-test-analytics-semester"
            className="form-select form-select-sm"
            style={{ minWidth: '16rem' }}
            value={selectValue}
            onChange={(e) => onSemesterChange?.(e.target.value)}
            disabled={loading || !selectValue}
          >
            {semesterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger py-2 small" role="alert">
          載入統計失敗：{error}
        </div>
      ) : null}

      <PieStatCard
        title="宣傳來源（Q21：從何得知培力英檢）"
        description="圓環圖呈現各選項占比；滑過扇區可高亮。"
        emptyHint="此學期尚無「從何得知培力英檢」資料"
        filePrefix="Q21從何得知"
        loading={loading}
        data={infoSource.data}
        total={infoSource.total}
        semester={semester}
      />

      <BarStatCard
        title="系所分布"
        description="橫向長條圖呈現各系所報名人數。"
        emptyHint="此學期尚無系所統計資料"
        filePrefix="系所分布"
        loading={loading}
        data={department.data}
        total={department.total}
        semester={semester}
        layout="horizontal"
      />

      <BarStatCard
        title="年級分布"
        description="長條圖呈現各年級報名人數。"
        emptyHint="此學期尚無年級統計資料"
        filePrefix="年級分布"
        loading={loading}
        data={grade.data}
        total={grade.total}
        semester={semester}
      />
    </div>
  );
}
