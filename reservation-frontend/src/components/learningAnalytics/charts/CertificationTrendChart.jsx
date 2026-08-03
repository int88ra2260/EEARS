import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export default function CertificationTrendChart({ points = [] }) {
  if (!points.length) {
    return <p className="small text-muted mb-0">尚無跨學期 B2+ 認證率資料。</p>;
  }

  const data = points.map((row) => ({
    semester: row.semester,
    rate: Number(row.b2plusRate) || 0,
    students: row.students,
  }));

  return (
    <div className="la-chart-wrap">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eaeaea" strokeDasharray="3 3" />
          <XAxis dataKey="semester" tick={{ fontSize: 11, fill: '#787774' }} />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            domain={[0, 1]}
            tick={{ fontSize: 11, fill: '#787774' }}
          />
          <Tooltip
            formatter={(value) => [formatPct(value), 'B2+ 率']}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload;
              return row ? `${label}（${row.students ?? '—'} 人）` : label;
            }}
          />
          <Line type="monotone" dataKey="rate" stroke="#346538" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
