import React, { memo, useCallback } from 'react';
import QuickActionButtons from './QuickActionButtons';
import useConfirm from '../ui/useConfirm';
import { getStatusBadge, highlightText } from './englishTestTableHelpers';

function EnhancedTableRowContent({
  row,
  visibleColumns,
  allColumns,
  selectedRows,
  onRowSelect,
  searchTerm,
  onViewDetail,
  onQuickStatusUpdate,
  onDelete,
  onClassBestep,
  enableDragSort,
}) {
  const { confirm } = useConfirm();

  const handleDelete = useCallback(() => {
    confirm({
      title: '確認刪除報名資料？',
      description: '此操作無法復原。',
      confirmText: '刪除',
      cancelText: '取消',
      variant: 'danger',
    }).then((ok) => {
      if (!ok) return;
      onDelete && onDelete(row.id);
    });
  }, [confirm, onDelete, row.id]);

  return (
    <>
      {enableDragSort && (
        <td
          style={{
            width: '30px',
            cursor: 'grab',
            userSelect: 'none',
            textAlign: 'center',
            verticalAlign: 'middle',
            padding: '0.5rem',
          }}
          data-drag-handle="true"
        >
          <i className="fas fa-grip-vertical text-muted" style={{ fontSize: '0.875rem' }} title="拖曳調整順序" />
        </td>
      )}

      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
        <input
          type="checkbox"
          checked={selectedRows.includes(row.id)}
          onChange={(e) => {
            if (e.target.checked) {
              onRowSelect && onRowSelect([...selectedRows, row.id]);
            } else {
              onRowSelect && onRowSelect(selectedRows.filter(id => id !== row.id));
            }
          }}
        />
      </td>

      {visibleColumns
        .map(key => allColumns.find(col => col.key === key))
        .filter(col => col !== undefined)
        .map(col => (
          <td key={col.key} style={{ textAlign: 'left', verticalAlign: 'middle' }}>
            {col.key === 'status' ? (
              getStatusBadge(row[col.key])
            ) : col.key === 'photo' ? (
              row.idPhoto ? (
                <img
                  src={`/uploads/${row.idPhoto}`}
                  alt="證件照"
                  style={{
                    width: '50px',
                    height: '50px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: '1px solid #ddd',
                  }}
                  onClick={() => window.open(`/uploads/${row.idPhoto}`, '_blank')}
                  title="點擊放大"
                />
              ) : (
                <span className="text-muted">無</span>
              )
            ) : col.key === 'createdAt' ? (
              new Date(row[col.key]).toLocaleString('zh-TW')
            ) : col.key === 'id' ? (
              highlightText(
                row.semesterSequence || (row.status === 'success' && row.successSequence) || row.id,
                searchTerm
              )
            ) : (
              highlightText(row[col.key] || '-', searchTerm)
            )}
          </td>
        ))}

      <td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
        <QuickActionButtons
          registration={row}
          onView={() => onViewDetail && onViewDetail(row.id)}
          onQuickStatusUpdate={onQuickStatusUpdate}
          onClassBestep={onClassBestep}
          onDelete={handleDelete}
        />
      </td>
    </>
  );
}

export default memo(EnhancedTableRowContent);
