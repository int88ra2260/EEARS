import React from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function CohortGrowthBoxplot({ rows = [] }) {
  if (!rows.length) {
    return <p className="small text-muted mb-0">樣本數不足，無法繪製系所成長分布。</p>;
  }

  const data = rows.map((row) => ({
    name: row.groupKey.length > 8 ? `${row.groupKey.slice(0, 8)}…` : row.groupKey,
    fullName: row.groupKey,
    median: row.median,
    mean: row.mean,
    error: row.median != null && row.q1 != null && row.q3 != null
      ? [row.median - row.q1, row.q3 - row.median]
      : [0, 0],
    sampleSize: row.sampleSize,
  }));

  return (
    <div className="la-chart-wrap">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
          <CartesianGrid stroke="#eaeaea" strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#787774' }}
            interval={0}
            angle={-28}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fontSize: 11, fill: '#787774' }} />
          <Tooltip
            formatter={(value, key) => [value, key === 'median' ? '中位數' : '平均']}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload;
              return row ? `${row.fullName}（n=${row.sampleSize}）` : '';
            }}
          />
          <Bar dataKey="median" fill="#2c5282" radius={[4, 4, 0, 0]} barSize={28}>
            <ErrorBar dataKey="error" width={4} strokeWidth={1.5} stroke="#111" direction="y" />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
