import React from 'react';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Form from 'react-bootstrap/Form';
import {
  formatPreviewCell,
  getDatasetMeta,
  getPreviewColumns,
} from './learningAnalyticsRawDataColumns';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function formatRange(offset, count, total) {
  if (!total || count === 0) return '0 筆';
  const start = offset + 1;
  const end = offset + count;
  return `第 ${start.toLocaleString('zh-TW')}–${end.toLocaleString('zh-TW')} 筆`;
}

export default function LearningAnalyticsRawDataPreview({
  dataset,
  data,
  rows,
  loading,
  offset,
  pageSize,
  onOffsetChange,
  onPageSizeChange,
}) {
  const columns = getPreviewColumns(dataset);
  const meta = getDatasetMeta(dataset);
  const total = data?.total ?? 0;
  const count = rows.length;
  const canPrev = offset > 0;
  const canNext = offset + count < total;
  const lastPageOffset = total > 0 ? Math.max(0, Math.floor((total - 1) / pageSize) * pageSize) : 0;

  return (
    <div className="la-panel la-raw-preview">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div className="la-panel-title mb-1">資料預覽</div>
          <p className="la-panel-lead mb-0">
            {meta.hint}
            {' '}
            預覽僅供抽查樣本；若要完整欄位與大量資料，請使用「匯出 XLSX」。
          </p>
        </div>
        <Badge bg="light" text="dark" className="border fw-normal align-self-start">
          {meta.label}
        </Badge>
      </div>

      <div className="la-raw-preview-stats d-flex flex-wrap align-items-center gap-3 mb-2">
        <div>
          <span className="la-raw-preview-stat-value">{total.toLocaleString('zh-TW')}</span>
          <span className="la-raw-preview-stat-label ms-1">筆符合條件</span>
        </div>
        <div className="text-muted small">
          {formatRange(offset, count, total)}
          {data?.snapshotVersion ? (
            <>
              {' · '}
              資料批次：
              <span className="text-body">{String(data.snapshotVersion).split('|')[0]}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="small text-muted">每頁</span>
          <Form.Select
            size="sm"
            className="la-raw-preview-pagesize"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={loading}
            aria-label="每頁筆數"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} 筆</option>
            ))}
          </Form.Select>
        </div>
        <ButtonGroup size="sm">
          <Button
            variant="outline-secondary"
            disabled={loading || !canPrev}
            onClick={() => onOffsetChange(0)}
          >
            第一頁
          </Button>
          <Button
            variant="outline-secondary"
            disabled={loading || !canPrev}
            onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
          >
            上一頁
          </Button>
          <Button
            variant="outline-secondary"
            disabled={loading || !canNext}
            onClick={() => onOffsetChange(offset + pageSize)}
          >
            下一頁
          </Button>
          <Button
            variant="outline-secondary"
            disabled={loading || !canNext}
            onClick={() => onOffsetChange(lastPageOffset)}
          >
            最後一頁
          </Button>
        </ButtonGroup>
      </div>

      <p className="small text-muted mb-2">{meta.exportNote}</p>

      <div className="la-raw-preview-scroll table-responsive">
        <table className="table table-sm table-hover la-raw-preview-table mb-0">
          <thead>
            <tr>
              <th className="la-raw-preview-rownum" scope="col">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    col.sticky ? 'la-raw-preview-sticky-col' : '',
                    col.align === 'end' ? 'text-end' : '',
                  ].filter(Boolean).join(' ') || undefined}
                  style={{ minWidth: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, idx) => (
              <tr key={row.id || `${row.studentId}-${row.skill}-${row.examDate}-${idx}`}>
                <td className="la-raw-preview-rownum text-muted">
                  {offset + idx + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      col.sticky ? 'la-raw-preview-sticky-col' : '',
                      col.align === 'end' ? 'text-end' : '',
                      'la-raw-preview-cell',
                    ].filter(Boolean).join(' ') || undefined}
                    title={row[col.key] != null ? String(row[col.key]) : undefined}
                  >
                    {formatPreviewCell(row, col)}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length + 1} className="text-center text-muted py-5">
                  {total > 0 ? '此頁無資料，請返回上一頁。' : '目前篩選條件下沒有資料。'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > count ? (
        <p className="small text-muted mt-2 mb-0">
          尚有
          {' '}
          {(total - offset - count).toLocaleString('zh-TW')}
          {' '}
          筆未顯示於本頁；匯出 XLSX 可取得最多
          {' '}
          {dataset === 'exams' ? '20,000' : '5,000'}
          {' '}
          筆。
        </p>
      ) : null}
    </div>
  );
}
