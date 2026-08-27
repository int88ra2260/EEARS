import React from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

export default function ParticipationGrowthScatter({ points = [] }) {
  if (!points.length) {
    return <p className="small text-muted mb-0">尚無足夠的前後測與資源時數資料。</p>;
  }

  const data = points.map((p) => ({
    ...p,
    x: Number(p.resourceHours) || 0,
    y: Number(p.adjustedGrowth) || 0,
  }));

  return (
    <div className="la-chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#eaeaea" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="考前資源時數"
            unit="h"
            tick={{ fontSize: 11, fill: '#787774' }}
            label={{ value: '考前資源時數', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#787774' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="修正後成長"
            tick={{ fontSize: 11, fill: '#787774' }}
            label={{ value: '校正後進步', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#787774' }}
          />
          <ZAxis range={[40, 120]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value, name) => [value, name === 'y' ? '修正後成長' : '資源時數']}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload;
              if (!row) return '';
              return `${row.studentId} · ${SKILL_LABELS[row.skill] || row.skill}`;
            }}
          />
          <Scatter data={data} fill="#2c5282" fillOpacity={0.65} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
