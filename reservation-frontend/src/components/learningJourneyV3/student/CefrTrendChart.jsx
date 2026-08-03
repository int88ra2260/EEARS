import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getEmptyReasonText } from './emptyStateUtils';

const CEFR_LABEL = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' };

function mergeSeries(series) {
  const map = new Map();
  const skills = ['listening', 'reading', 'speaking', 'writing'];
  skills.forEach((skill) => {
    (series?.[skill] || []).forEach((row) => {
      const key = String(row.examDate || '');
      if (!key) return;
      if (!map.has(key)) map.set(key, { examDate: key });
      map.get(key)[skill] = Number(row.rank || 0) || null;
    });
  });
  return [...map.values()].sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
}

export default function CefrTrendChart({ trends, emptyReason }) {
  const data = useMemo(() => mergeSeries(trends?.series || {}), [trends]);
  if (!data.length) return <div className="alert alert-secondary mb-0">{getEmptyReasonText(emptyReason, '尚無 CEFR 趨勢資料。')}</div>;

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="examDate" />
          <YAxis
            domain={[1, 6]}
            ticks={[1, 2, 3, 4, 5, 6]}
            tickFormatter={(v) => CEFR_LABEL[v] || String(v)}
          />
          <Tooltip formatter={(value) => CEFR_LABEL[value] || value} />
          <Legend />
          <Line type="monotone" dataKey="listening" name="聽力" stroke="#0d6efd" connectNulls />
          <Line type="monotone" dataKey="reading" name="閱讀" stroke="#198754" connectNulls />
          <Line type="monotone" dataKey="speaking" name="口說" stroke="#fd7e14" connectNulls />
          <Line type="monotone" dataKey="writing" name="寫作" stroke="#6f42c1" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
