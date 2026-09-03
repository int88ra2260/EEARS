import React from 'react';

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

function formatPct(prob) {
  const n = Number(prob);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(0)}%`;
}

function outlookTagClass(label) {
  if (!label) return 'la-tag-pastel-muted';
  if (label.includes('較佳') || label.includes('高')) return 'la-tag-pastel-green';
  if (label.includes('努力') || label.includes('中')) return 'la-tag-pastel-yellow';
  return 'la-tag-pastel-blue';
}

export default function StudentRecommendationsPanel({ data }) {
  if (!data) return null;

  const { weakSkills = [], recommendations = [], certificationOutlook } = data;

  return (
    <div className="la-panel mb-3">
      <div className="la-panel-title">建議可加強的資源（實驗）</div>
      <p className="small text-muted la-panel-lead mb-3">
        依弱項技能對應資源設定，屬啟發式建議，非正式輔導優先序或成效保證。
      </p>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span className="small text-muted">弱項技能</span>
        {weakSkills.length ? weakSkills.map((skill) => (
          <span key={skill} className={`la-tag la-tag-pastel-blue`}>
            {SKILL_LABELS[skill] || skill}
          </span>
        )) : (
          <span className="small text-muted">尚無足夠分技能成績</span>
        )}
      </div>

      {certificationOutlook ? (
        <div className="la-outlook-card mb-3">
          <div className="small text-muted">估計通過 B2+ 的機會</div>
          <div className="d-flex flex-wrap align-items-baseline gap-2 mt-1">
            <span className="fs-4 fw-semibold">{formatPct(certificationOutlook.probability)}</span>
            <span className={`la-tag ${outlookTagClass(certificationOutlook.label)}`}>
              {certificationOutlook.label}
            </span>
          </div>
        </div>
      ) : null}

      {recommendations.length ? (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>建議資源</th>
                <th className="text-end">對齊度</th>
                <th>說明</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((row) => (
                <tr key={row.resourceKey}>
                  <td className="fw-semibold">
                    {row.label}
                    {row.alreadyParticipated ? (
                      <span className="la-tag la-tag-pastel-muted ms-2">已參與</span>
                    ) : null}
                  </td>
                  <td className="text-end">{row.alignmentIndex}</td>
                  <td className="small text-muted">{row.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small text-muted mb-0">目前沒有額外建議。</p>
      )}
    </div>
  );
}
