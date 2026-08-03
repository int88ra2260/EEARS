// components/english-test/EnhancedTable.js
import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ColumnSelector from './ColumnSelector';
import QuickActionButtons from './QuickActionButtons';
import SortableTableRow from './SortableTableRow';
import EnhancedTableRowContent from './EnhancedTableRowContent';
import useMediaQuery from '../../hooks/useMediaQuery';
import useConfirm from '../ui/useConfirm';
import { getStatusBadge, highlightText } from './englishTestTableHelpers';

// 注意：如果 useMediaQuery 不存在，可以使用以下簡單實作
// const useMediaQuery = (query) => {
//   const [matches, setMatches] = useState(false);
//   useEffect(() => {
//     const media = window.matchMedia(query);
//     if (media.matches !== matches) {
//       setMatches(media.matches);
//     }
//     const listener = () => setMatches(media.matches);
//     media.addEventListener('change', listener);
//     return () => media.removeEventListener('change', listener);
//   }, [matches, query]);
//   return matches;
// };

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
  onDragEnd = null
}) {
  const { confirm } = useConfirm();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [localSortConfig, setLocalSortConfig] = useState(sortConfig || { key: 'id', direction: 'ASC' });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('englishTestTableColumns');
    if (saved) {
      return JSON.parse(saved);
    }
    // 預設欄位：包含 successSequence（會在報名成功狀態下顯示）
    return ['id', 'successSequence', 'studentId', 'name', 'email', 'status', 'createdAt'];
  });
  const [items, setItems] = useState(data.map(row => row.id));

  // DnD Kit 感應器設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖曳8px後才啟動，避免與點擊衝突
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 當資料變更時更新 items
  useEffect(() => {
    setItems(data.map(row => row.id));
  }, [data]);

  // 處理拖曳結束
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    if (enableDragSort && onDragEnd) {
      // 調用父組件的處理函數
      onDragEnd(active.id, over.id);
    } else if (enableDragSort) {
      // 如果沒有提供 onDragEnd，僅更新本地順序（不推薦，但提供備用）
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      setItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  // 所有可用欄位定義
  const allColumns = [
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
    { key: 'photo', label: '證件照', sortable: false, image: true }
  ];

  useEffect(() => {
    if (sortConfig) {
      setLocalSortConfig(sortConfig);
    }
  }, [sortConfig]);

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

  // 排序後的資料
  const sortedData = useMemo(() => {
    // 由後端排序為準，前端不再二次排序
    if (sortConfig) return data;

    const effectiveConfig = localSortConfig;
    if (!effectiveConfig.key) return data;
    
    return [...data].sort((a, b) => {
      let aVal = a[effectiveConfig.key];
      let bVal = b[effectiveConfig.key];
      
      // 處理日期
      if (effectiveConfig.key === 'createdAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      // 僅字串才做小寫比較
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return effectiveConfig.direction === 'ASC' ? -1 : 1;
      if (aVal > bVal) return effectiveConfig.direction === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig, localSortConfig]);

  // 移動裝置：卡片式佈局
  if (isMobile) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-end mb-3">
            <ColumnSelector
              allColumns={allColumns}
              visibleColumns={visibleColumns}
              onColumnsChange={handleColumnChange}
            />
          </div>
          
          <div className="row g-3">
            {sortedData.map(row => (
              <div key={row.id} className="col-12">
                <div className="card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className="mb-1">
                          {highlightText(row.name, searchTerm)} ({row.studentId})
                        </h6>
                        <small className="text-muted">
                          {getStatusBadge(row.status)}
                        </small>
                      </div>
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
                    </div>
                    
                    {visibleColumns.includes('email') && (
                      <div className="mb-1">
                        <small><strong>Email:</strong> {highlightText(row.email, searchTerm)}</small>
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
                          style={{
                            width: '60px',
                            height: '60px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            cursor: 'pointer'
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

  // 桌面版：表格佈局
  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-end mb-3">
          <ColumnSelector
            allColumns={allColumns}
            visibleColumns={visibleColumns}
            onColumnsChange={handleColumnChange}
          />
        </div>

        <div className="table-responsive">
          <table className="table table-hover" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr>
                {/* 拖曳手柄（僅在啟用拖曳時顯示，必須在選擇框之前以保持對齊） */}
                {enableDragSort && <th style={{ width: '30px', textAlign: 'center', verticalAlign: 'middle' }} title="拖曳調整順序"><i className="fas fa-grip-vertical text-muted"></i></th>}
                
                {/* 選擇框 */}
                <th style={{ width: '40px', textAlign: 'center', verticalAlign: 'middle' }}>
                  <input
                    type="checkbox"
                    checked={selectedRows.length === data.length && data.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onRowSelect && onRowSelect(data.map(row => row.id));
                      } else {
                        onRowSelect && onRowSelect([]);
                      }
                    }}
                  />
                </th>
                
                {/* 欄位標題 - 按照 visibleColumns 的順序顯示 */}
                {visibleColumns
                  .map(key => allColumns.find(col => col.key === key))
                  .filter(col => col !== undefined)
                  .map(col => (
                    <th
                      key={col.key}
                      style={{ 
                        cursor: col.sortable ? 'pointer' : 'default',
                        userSelect: 'none',
                        textAlign: 'left',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap'
                      }}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      {col.label}
                      {col.sortable && (
                        <span className="ms-2">
                          {(sortConfig || localSortConfig).key === col.key && (
                            <i className={`fas fa-sort-${(sortConfig || localSortConfig).direction === 'ASC' ? 'up' : 'down'}`}></i>
                          )}
                          {(sortConfig || localSortConfig).key !== col.key && (
                            <i className="fas fa-sort text-muted" style={{ opacity: 0.3 }}></i>
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
                  <SortableContext
                    items={items}
                    strategy={verticalListSortingStrategy}
                  >
                    {sortedData.map(row => (
                      <SortableTableRow 
                        key={row.id} 
                        id={row.id}
                      >
                        <EnhancedTableRowContent
                          row={row}
                          visibleColumns={visibleColumns}
                          allColumns={allColumns}
                          selectedRows={selectedRows}
                          onRowSelect={onRowSelect}
                          searchTerm={searchTerm}
                          onViewDetail={onViewDetail}
                          onQuickStatusUpdate={onQuickStatusUpdate}
                          onDelete={onDelete}
                          onClassBestep={onClassBestep}
                          enableDragSort={true}
                        />
                      </SortableTableRow>
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                sortedData.map(row => (
                  <tr 
                    key={row.id}
                    style={{
                      backgroundColor: row.status === 'pending' ? '#fff9e6' : 'transparent'
                    }}
                  >
                    <EnhancedTableRowContent
                      row={row}
                      visibleColumns={visibleColumns}
                      allColumns={allColumns}
                      selectedRows={selectedRows}
                      onRowSelect={onRowSelect}
                      searchTerm={searchTerm}
                      onViewDetail={onViewDetail}
                      onQuickStatusUpdate={onQuickStatusUpdate}
                      onDelete={onDelete}
                      onClassBestep={onClassBestep}
                      enableDragSort={false}
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
