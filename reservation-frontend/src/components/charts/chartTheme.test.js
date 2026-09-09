import { chartColor, withChartFills, CHART_PALETTE, CHART_SERIES } from './chartTheme';

describe('chartTheme', () => {
  test('chartColor cycles palette', () => {
    expect(chartColor(0)).toBe(CHART_PALETTE[0]);
    expect(chartColor(CHART_PALETTE.length)).toBe(CHART_PALETTE[0]);
  });

  test('withChartFills adds name, fullName, fill', () => {
    const rows = withChartFills([
      { label: '短標籤', count: 3 },
      { label: '這是一個超過十四個字的超長系所名稱', count: 1 },
    ]);
    expect(rows[0].name).toBe('短標籤');
    expect(rows[0].fullName).toBe('短標籤');
    expect(rows[0].fill).toBe(CHART_SERIES.primary);
    expect(rows[1].name.endsWith('…')).toBe(true);
    expect(rows[1].fullName.startsWith('這是一個超過')).toBe(true);
  });
});
