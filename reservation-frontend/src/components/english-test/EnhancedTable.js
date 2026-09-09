// components/english-test/EnhancedTable.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ColumnSelector from './ColumnSelector';
import QuickActionButtons from './QuickActionButtons';
import SortableTableRow from './SortableTableRow';
import EnhancedTableRowContent from './EnhancedTableRowContent';
import useMediaQuery from '../../hooks/useMediaQuery';
import useConfirm from '../ui/useConfirm';
import { getStatusBadge, highlightText } from './englishTestTableHelpers';
import './EnglishTestIndividualTable.css';

const ALL_COLUMNS = [
  { key: 'id', label: '報名編號', sortable: true },
  { key: 'successSequence', label: '報名成功序號', sortable: true },
  { key: 'studentId', label: '學號', sortable: true },
  { key: 'name', label: '姓名', sortable: true },
  { key: 'email', label: 'Email', sortable: false },
  { key: 'phone', label: '電話', sortable: false },
  { key: 'college', label: '學院', sortable: true },
  { key: 'department', label: '科系', sortable: false },
  { key: 'status', label: '狀態', sortable: true },
  { key: 'createdAt', label: '報名時間', sortable: true },
  { key: 'photo', label: '證件照', sortable: false, image: true },
];

export default function EnhancedTable({
  data,
  onSort,
  sortConfig,
  onRowSelect,
  selectedRows = [],
  onViewDetail,
  onQuickStatusUpdate,
  onDelete,
  onClassBestep,
  searchTerm = '',
  enableDragSort = false,
  onDragEnd = null,
}) {
  const { confirm } = useConfirm();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [localSortConfig, setLocalSortConfig] = useState(sortConfig || { key: 'id', direction: 'ASC' });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('englishTestTableColumns');
    if (saved) {
      return JSON.parse(saved);
    }
    return ['id', 'successSequence', 'studentId', 'name', 'email', 'status', 'createdAt'];
  });
  const [items, setItems] = useState(() => data.map((row) => row.id));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setItems(data.map((row) => row.id));
  }, [data]);

  useEffect(() => {
    if (sortConfig) setLocalSortConfig(sortConfig);
  }, [sortConfig]);

  const selectedIdSet = useMemo(() => new Set(selectedRows), [selectedRows]);

  const visibleColumnDefs = useMemo(
    () => visibleColumns
      .map((key) => ALL_COLUMNS.find((col) => col.key === key))
      .filter(Boolean),
    [visibleColumns]
  );

  const handleToggleSelect = useCallback((rowId, checked) => {
    if (!onRowSelect) return;
    if (checked) {
      onRowSelect(selectedRows.includes(rowId) ? selectedRows : [...selectedRows, rowId]);
    } else {
      onRowSelect(selectedRows.filter((id) => id !== rowId));
    }
  }, [onRowSelect, selectedRows]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (enableDragSort && onDragEnd) {
      onDragEnd(active.id, over.id);
    } else if (enableDragSort) {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      setItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleSort = (key) => {
    const effectiveConfig = sortConfig || localSortConfig;
    const direction = effectiveConfig.key === key && effectiveConfig.direction === 'ASC' ? 'DESC' : 'ASC';
    const newSortConfig = { key, direction };
    setLocalSortConfig(newSortConfig);
    onSort && onSort(key, direction);
  };

  const handleColumnChange = (newColumns) => {
    setVisibleColumns(newColumns);
  };

  const sortedData = useMemo(() => {
    if (sortConfig) return data;
    const effectiveConfig = localSortConfig;
    if (!effectiveConfig.key) return data;

    return [...data].sort((a, b) => {
      let aVal = a[effectiveConfig.key];
      let bVal = b[effectiveConfig.key];
      if (effectiveConfig.key === 'createdAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = typeof bVal === 'string' ? bVal.toLowerCase() : bVal;
      }
      if (aVal < bVal) return effectiveConfig.direction === 'ASC' ? -1 : 1;
      if (aVal > bVal) return effectiveConfig.direction === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig, localSortConfig]);

  if (isMobile) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-end mb-3">
            <ColumnSelector
              allColumns={ALL_COLUMNS}
              visibleColumns={visibleColumns}
              onColumnsChange={handleColumnChange}
            />
          </div>

          <div className="row g-3">
            {sortedData.map((row) => (
              <div key={row.id} className="col-12">
                <div className="card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className="mb-1">
                          {searchTerm ? highlightText(row.name, searchTerm) : row.name}
                          {' '}
                          ({row.studentId})
                        </h6>
                        <small className="text-muted">{getStatusBadge(row.status)}</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(row.id)}
                        onChange={(e) => handleToggleSelect(row.id, e.target.checked)}
                      />
                    </div>

                    {visibleColumns.includes('email') && (
                      <div className="mb-1">
                        <small>
                          <strong>Email:</strong>
                          {' '}
                          {searchTerm ? highlightText(row.email, searchTerm) : row.email}
                        </small>
                      </div>
                    )}
                    {visibleColumns.includes('phone') && row.phone && (
                      <div className="mb-1">
                        <small><strong>電話:</strong> {row.phone}</small>
                      </div>
                    )}
                    {visibleColumns.includes('photo') && row.idPhoto && (
                      <div className="mb-2">
                        <img
                          src={`/uploads/${row.idPhoto}`}
                          alt="證件照"
                          loading="lazy"
                          style={{
                            width: '60px',
                            height: '60px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          onClick={() => window.open(`/uploads/${row.idPhoto}`, '_blank')}
                        />
                      </div>
                    )}

                    <div className="mt-2">
                      <QuickActionButtons
                        registration={row}
                        onView={() => onViewDetail && onViewDetail(row.id)}
                        onQuickStatusUpdate={onQuickStatusUpdate}
                        onClassBestep={onClassBestep}
                        onDelete={() => {
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
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-end mb-3">
          <ColumnSelector
            allColumns={ALL_COLUMNS}
            visibleColumns={visibleColumns}
            onColumnsChange={handleColumnChange}
          />
        </div>

        <div className="et-enhanced-table-x">
          <table className="table table-hover mb-0" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr>
                {enableDragSort && (
                  <th style={{ width: '30px', textAlign: 'center', verticalAlign: 'middle' }} title="拖曳調整順序">
                    <i className="fas fa-grip-vertical text-muted" />
                  </th>
                )}

                <th style={{ width: '40px', textAlign: 'center', verticalAlign: 'middle' }}>
                  <input
                    type="checkbox"
                    checked={selectedRows.length === data.length && data.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onRowSelect && onRowSelect(data.map((row) => row.id));
                      } else {
                        onRowSelect && onRowSelect([]);
                      }
                    }}
                  />
                </th>

                {visibleColumnDefs.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      textAlign: 'left',
                      verticalAlign: 'middle',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    {col.label}
                    {col.sortable && (
                      <span className="ms-2">
                        {(sortConfig || localSortConfig).key === col.key && (
                          <i className={`fas fa-sort-${(sortConfig || localSortConfig).direction === 'ASC' ? 'up' : 'down'}`} />
                        )}
                        {(sortConfig || localSortConfig).key !== col.key && (
                          <i className="fas fa-sort text-muted" style={{ opacity: 0.3 }} />
                        )}
                      </span>
                    )}
                  </th>
                ))}
                <th style={{ textAlign: 'left', verticalAlign: 'middle' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {enableDragSort ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={items} strategy={verticalListSortingStrategy}>
                    {sortedData.map((row) => (
                      <SortableTableRow key={row.id} id={row.id}>
                        <EnhancedTableRowContent
                          row={row}
                          visibleColumnDefs={visibleColumnDefs}
                          isSelected={selectedIdSet.has(row.id)}
                          onToggleSelect={handleToggleSelect}
                          searchTerm={searchTerm}
                          onViewDetail={onViewDetail}
                          onQuickStatusUpdate={onQuickStatusUpdate}
                          onDelete={onDelete}
                          onClassBestep={onClassBestep}
                          enableDragSort
                          confirm={confirm}
                        />
                      </SortableTableRow>
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                sortedData.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      backgroundColor: row.status === 'pending' ? '#fff9e6' : 'transparent',
                    }}
                  >
                    <EnhancedTableRowContent
                      row={row}
                      visibleColumnDefs={visibleColumnDefs}
                      isSelected={selectedIdSet.has(row.id)}
                      onToggleSelect={handleToggleSelect}
                      searchTerm={searchTerm}
                      onViewDetail={onViewDetail}
                      onQuickStatusUpdate={onQuickStatusUpdate}
                      onDelete={onDelete}
                      onClassBestep={onClassBestep}
                      enableDragSort={false}
                      confirm={confirm}
                    />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
