/**
 * EEARS chart theme — Bklit-inspired academic palette for Recharts.
 * Prefer these tokens over Bootstrap defaults (#2a5d9f / #198754 / #dc3545).
 */

export const CHART_PALETTE = [
  '#2a5d9f',
  '#4a8bc2',
  '#6aa3d4',
  '#8bb8de',
  '#5b8f7a',
  '#c4a35a',
  '#c0725a',
  '#7a6bb0',
];

/** Named series colors for single-metric charts */
export const CHART_SERIES = {
  primary: CHART_PALETTE[0],
  secondary: CHART_PALETTE[1],
  success: CHART_PALETTE[4],
  warning: CHART_PALETTE[5],
  danger: CHART_PALETTE[6],
  accent: CHART_PALETTE[7],
};

export const CHART_ANIM = {
  duration: 900,
  easing: 'ease-out',
};

export const CHART_AXIS_TICK = {
  fontSize: 12,
  fill: '#6a7176',
};

export const CHART_AXIS_LABEL = {
  fontSize: 12,
  fill: '#2f3437',
};

export const CHART_GRID_PROPS = {
  strokeDasharray: '4 6',
  stroke: 'rgba(47, 52, 55, 0.08)',
};

export const CHART_CURSOR_FILL = {
  fill: 'rgba(42, 93, 159, 0.06)',
  radius: 8,
};

export const CHART_MARGIN = {
  line: { top: 12, right: 16, left: 4, bottom: 8 },
  bar: { top: 16, right: 12, left: 4, bottom: 28 },
  barHorizontal: { top: 12, right: 28, left: 4, bottom: 8 },
};

export function chartColor(index = 0) {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

export function withChartFills(rows, { labelKey = 'label', valueKey = 'count', maxLabel = 14 } = {}) {
  return (rows || []).map((row, i) => {
    const label = String(row[labelKey] ?? row.name ?? '');
    return {
      ...row,
      name: label.length > maxLabel ? `${label.slice(0, maxLabel)}…` : label,
      fullName: label,
      count: Number(row[valueKey] ?? row.count) || 0,
      fill: chartColor(i),
    };
  });
}
