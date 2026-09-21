import React from 'react';

function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const totalSec = Math.round(value / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `${sec} 秒`;
  return `${min} 分 ${sec} 秒`;
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function formatItemMeta(row) {
  return [row.level, row.itemType, row.componentProcess].filter(Boolean).join(' · ') || '未標記';
}

function healthBadgeClass(health) {
  if (health?.severity === 'warning') return 'text-bg-warning';
  if (health?.severity === 'ok') return 'text-bg-success';
  return 'text-bg-light border text-secondary';
}

function formatAbilityGroups(groups = []) {
  if (!groups.length) return '—';
  return groups
    .map((group) => `${group.level}: ${formatPercent(group.correctRate)} (${group.exposureCount})`)
    .join(' / ');
}

function formatDiscrimination(discrimination) {
  if (!discrimination || discrimination.spread == null) return discrimination?.label || '分組不足';
  return `${discrimination.label} · 差距 ${formatPercent(discrimination.spread)}`;
}

export default function VocabularyDepthItemAnalyticsPanel({ itemStats = [] }) {
  return (
    <div className="la-chart-card mt-3">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h3 className="h6 mb-1">題目基礎分析</h3>
          <p className="small text-muted mb-0">
            依 Vocabulary Depth 作答紀錄彙整，用於題庫維護與未來適性選題；非正式難度校準。
          </p>
        </div>
        <span className="badge text-bg-light border">
          {itemStats.length} 題
        </span>
      </div>

      {itemStats.length ? (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">題目</th>
                <th scope="col">標記</th>
                <th scope="col">狀態</th>
                <th scope="col">估計程度分組</th>
                <th scope="col">AI metadata</th>
                <th scope="col" className="text-end">曝光</th>
                <th scope="col" className="text-end">答對率</th>
                <th scope="col" className="text-end">平均反應</th>
              </tr>
            </thead>
            <tbody>
              {itemStats.slice(0, 20).map((row) => (
                <tr key={row.itemId}>
                  <td>
                    <div className="fw-semibold">{row.word || row.itemId}</div>
                    <div className="text-muted small">{row.itemId}</div>
                  </td>
                  <td>
                    <div>{formatItemMeta(row)}</div>
                    <div className="text-muted small">{row.source || 'unknown'}</div>
                  </td>
                  <td>
                    <span className={`badge ${healthBadgeClass(row.health)}`}>
                      {row.health?.label || '未判定'}
                    </span>
                    {row.health?.reasons?.length ? (
                      <div className="text-muted small mt-1">
                        {row.health.reasons[0]}
                      </div>
                    ) : null}
                    <div className="text-muted small mt-1">
                      {formatDiscrimination(row.discrimination)}
                    </div>
                  </td>
                  <td className="small">
                    {formatAbilityGroups(row.abilityGroupStats)}
                  </td>
                  <td>
                    <span className={`badge ${row.metadataSuggestion?.needsHumanReview ? 'text-bg-info' : 'text-bg-light border text-secondary'}`}>
                      {row.metadataSuggestion?.label || '未判定'}
                    </span>
                    {row.metadataSuggestion?.suggestions?.length ? (
                      <div className="text-muted small mt-1">
                        {row.metadataSuggestion.suggestions[0].reason}
                      </div>
                    ) : null}
                  </td>
                  <td className="text-end">{row.exposureCount ?? 0}</td>
                  <td className="text-end">{formatPercent(row.correctRate)}</td>
                  <td className="text-end">{formatDuration(row.avgResponseMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small text-muted mb-0">
          尚未累積可彙整的題目層級作答紀錄。新版 trace 上線後，完成場次會逐步出現在這裡。
        </p>
      )}
    </div>
  );
}
