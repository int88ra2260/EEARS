import React from 'react';
import Alert from 'react-bootstrap/Alert';
import Table from 'react-bootstrap/Table';

function normalizeErrorItem(item, index) {
  if (typeof item === 'string') {
    return {
      key: `text-${index}`,
      row: '-',
      field: '-',
      message: item,
      value: '-',
      raw: null,
    };
  }

  if (item && typeof item === 'object') {
    const row = item.row ?? item.rowNumber ?? item.line ?? item.index ?? '-';
    const field = item.field ?? item.column ?? item.key ?? '-';
    const message = item.message ?? item.error ?? item.reason ?? '未知錯誤';
    const value = item.value ?? item.input ?? item.actual ?? '-';
    return {
      key: item.id || `obj-${index}`,
      row,
      field,
      message,
      value,
      raw: item,
    };
  }

  return {
    key: `unknown-${index}`,
    row: '-',
    field: '-',
    message: String(item),
    value: '-',
    raw: item,
  };
}

/**
 * 通用匯入錯誤清單（P12 骨架）。
 * 支援 row/field/message/value，其他格式 fallback 為 JSON 摘要。
 *
 * @param {{
 *   errors?: any[],
 *   title?: string,
 *   maxVisible?: number,
 *   variant?: 'danger' | 'warning' | 'info',
 *   className?: string
 * }} props
 */
export default function ImportErrorList({
  errors = [],
  title = '錯誤清單',
  maxVisible = 50,
  variant = 'danger',
  className = '',
}) {
  const list = Array.isArray(errors) ? errors : [];
  if (!list.length) return null;

  const normalized = list.map((item, index) => normalizeErrorItem(item, index));
  const visible = normalized.slice(0, Math.max(1, maxVisible));
  const hasMore = normalized.length > visible.length;

  return (
    <Alert variant={variant} className={`py-2 ${className}`.trim()}>
      <div className="fw-semibold mb-2">{title}</div>
      <div className="table-responsive">
        <Table size="sm" bordered hover className="mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th style={{ width: '80px' }}>row</th>
              <th style={{ width: '140px' }}>field</th>
              <th>message</th>
              <th style={{ width: '200px' }}>value</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.key}>
                <td>{String(item.row)}</td>
                <td style={{ wordBreak: 'break-word' }}>{String(item.field)}</td>
                <td style={{ wordBreak: 'break-word' }}>
                  {String(item.message)}
                  {item.raw && typeof item.raw === 'object' ? (
                    <details className="mt-1">
                      <summary className="small">raw</summary>
                      <pre className="small mb-0 mt-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify(item.raw, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </td>
                <td style={{ wordBreak: 'break-word' }}>{String(item.value)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {hasMore ? (
        <div className="small text-muted mt-2">
          共 {normalized.length} 筆錯誤，僅顯示前 {visible.length} 筆。
        </div>
      ) : null}
    </Alert>
  );
}
