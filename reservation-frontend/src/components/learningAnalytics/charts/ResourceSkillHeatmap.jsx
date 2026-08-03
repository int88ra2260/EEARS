import React from 'react';

const SKILL_LABELS = {
  listening: '聽',
  reading: '讀',
  speaking: '說',
  writing: '寫',
};

function cellTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'la-heat-empty';
  if (n >= 15) return 'la-heat-high';
  if (n >= 5) return 'la-heat-mid';
  if (n > 0) return 'la-heat-low';
  return 'la-heat-empty';
}

export default function ResourceSkillHeatmap({ rows = [], skills = ['listening', 'reading', 'speaking', 'writing'] }) {
  if (!rows.length) {
    return <p className="small text-muted mb-0">尚無資源效益資料可繪製熱圖。</p>;
  }

  return (
    <div className="la-heatmap-scroll">
      <table className="table table-sm la-heatmap mb-0">
        <thead>
          <tr>
            <th>資源</th>
            {skills.map((skill) => (
              <th key={skill} className="text-center">{SKILL_LABELS[skill] || skill}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.resourceType}>
              <td className="fw-semibold">{row.label}</td>
              {skills.map((skill) => {
                const value = row.cells?.[skill];
                return (
                  <td key={skill} className={`text-center la-heat-cell ${cellTone(value)}`}>
                    {value == null ? '—' : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
