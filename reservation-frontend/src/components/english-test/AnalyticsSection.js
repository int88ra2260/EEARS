// 數據分析區塊：Q21 宣傳來源、系所、年級（圖表、空狀態、匯出）
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0', '#fd7e14'];

function toChartData(data) {
  return (data || []).map((row, i) => {
    const label = row.label || '';
    return {
      name: label.slice(0, 12) + (label.length > 12 ? '…' : ''),
      fullName: label,
      count: row.count ?? 0,
      fill: COLORS[i % COLORS.length],
    };
  });
}

function exportCsv({ title, filePrefix, data, total }) {
  if (!data || data.length === 0) return;
  const header = '選項,人數,占比%\n';
  const rows = data
    .map((row) => {
      const pct = total ? ((row.count / total) * 100).toFixed(1) : '0';
      return `"${(row.label || '').replace(/"/g, '""')}",${row.count ?? 0},${pct}`;
    })
    .join('\n');
  const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `培力英檢_${filePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatChartCard({
  title,
  description,
  emptyHint,
  filePrefix,
  loading,
  data,
  total,
  layout = 'vertical',
}) {
  const chartData = toChartData(data);
  const isHorizontal = layout === 'horizontal';
  const chartHeight = isHorizontal
    ? Math.max(280, Math.min(720, (chartData.length || 1) * 28 + 40))
    : 320;

  if (loading) {
    return (
      <div className="card mb-4">
        <div className="card-body text-center py-5">
          <div className="spinner-border text-primary" role="status" aria-label="載入中">
            <span className="visually-hidden">載入中...</span>
          </div>
          <p className="mt-2 text-muted small">載入統計資料中...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card mb-4 border-light">
        <div className="card-header">
          <h5 className="mb-0">{title}</h5>
        </div>
        <div className="card-body text-center py-5">
          <i className="fas fa-chart-pie fa-3x text-muted mb-3" aria-hidden />
          <p className="text-muted mb-0">尚無統計資料</p>
          <p className="small text-muted">{emptyHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 className="mb-0">{title}</h5>
        <button
          type="button"
          className="btn btn-sm btn-outline-success"
          onClick={() => exportCsv({ title, filePrefix, data, total })}
        >
          <i className="fas fa-file-csv me-1" /> 匯出 CSV
        </button>
      </div>
      <div className="card-body">
        <p className="text-muted small">
          {description}總計：{total} 筆
        </p>
        <div className="mb-4" style={{ height: `${chartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout={isHorizontal ? 'vertical' : 'horizontal'}
              margin={
                isHorizontal
                  ? { top: 8, right: 16, left: 8, bottom: 8 }
                  : { top: 8, right: 8, left: 8, bottom: 60 }
              }
            >
              {isHorizontal ? (
                <>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                </>
              )}
              <Tooltip
                formatter={(value) => [value, '人數']}
                labelFormatter={(label, payload) =>
                  (payload && payload[0] && payload[0].payload && payload[0].payload.fullName) || label
                }
              />
              <Bar dataKey="count" name="人數" radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-sm">
            <thead>
              <tr>
                <th>選項</th>
                <th>人數</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td>{row.label || ''}</td>
                  <td>{row.count ?? 0}</td>
                  <td>{total ? ((row.count / total) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsSection({
  loading,
  error = '',
  infoSource = { data: [], total: 0 },
  department = { data: [], total: 0 },
  grade = { data: [], total: 0 },
}) {
  return (
    <div>
      <div className="mb-3">
        <h4 className="mb-1">數據分析</h4>
        <p className="text-muted small mb-0">依報名資料彙整宣傳來源、系所與年級分布。</p>
      </div>

      {error ? (
        <div className="alert alert-danger py-2 small" role="alert">
          載入統計失敗：{error}
        </div>
      ) : null}

      <StatChartCard
        title="宣傳來源（Q21：從何得知培力英檢）"
        description="統計各選項的人數與占比。"
        emptyHint="待有報名資料後會顯示「從何得知培力英檢」統計"
        filePrefix="Q21從何得知"
        loading={loading}
        data={infoSource.data}
        total={infoSource.total}
      />

      <StatChartCard
        title="系所分布"
        description="統計各系所報名人數與占比。"
        emptyHint="待有報名資料後會顯示系所統計"
        filePrefix="系所分布"
        loading={loading}
        data={department.data}
        total={department.total}
        layout="horizontal"
      />

      <StatChartCard
        title="年級分布"
        description="統計各年級報名人數與占比。"
        emptyHint="待有報名資料後會顯示年級統計"
        filePrefix="年級分布"
        loading={loading}
        data={grade.data}
        total={grade.total}
      />
    </div>
  );
}
