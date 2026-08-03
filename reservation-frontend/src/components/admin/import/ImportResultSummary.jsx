import React from 'react';
import Alert from 'react-bootstrap/Alert';
import StatusBadge from '../../ui/StatusBadge';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickCount(result, keys, fallback = 0) {
  if (!result || typeof result !== 'object') return fallback;
  for (const key of keys) {
    if (result[key] !== undefined && result[key] !== null && result[key] !== '') {
      return toNumber(result[key], fallback);
    }
  }
  return fallback;
}

/**
 * 通用匯入結果摘要（P12 骨架）。
 * 不假設後端固定格式，提供 counts props 與 result fallback。
 */
export default function ImportResultSummary({
  result = null,
  successCount,
  failedCount,
  skippedCount,
  totalCount,
  message = '',
  showRawResult = false,
  className = '',
}) {
  if (!result && [successCount, failedCount, skippedCount, totalCount, message].every((v) => v == null || v === '')) {
    return null;
  }

  const success = successCount ?? pickCount(result, ['successCount', 'inserted', 'imported', 'created'], 0);
  const failed = failedCount ?? pickCount(result, ['failedCount', 'errorsCount', 'errorCount', 'failed'], 0);
  const skipped = skippedCount ?? pickCount(result, ['skippedCount', 'skipped', 'ignored'], 0);
  const total = totalCount ?? pickCount(result, ['totalCount', 'totalRows', 'totalImported', 'total'], success + failed + skipped);
  const extraMessage = message || result?.message || '';

  return (
    <Alert variant="success" className={`py-2 ${className}`.trim()}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <strong>匯入結果摘要</strong>
        <StatusBadge variant="success" size="md">成功 {success}</StatusBadge>
        <StatusBadge variant="danger" size="md">失敗 {failed}</StatusBadge>
        <StatusBadge variant="neutral" size="md">略過 {skipped}</StatusBadge>
        <StatusBadge variant="info" size="md">總計 {total}</StatusBadge>
      </div>
      {extraMessage ? <div className="small mb-2">{extraMessage}</div> : null}
      {showRawResult && result ? (
        <details className="small">
          <summary>原始結果資料</summary>
          <pre className="mt-2 mb-0" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      ) : null}
    </Alert>
  );
}
