// components/english-test/ColumnSelector.js
import React, { useEffect, useRef, useState } from 'react';

export default function ColumnSelector({
  allColumns,
  visibleColumns,
  onColumnsChange,
}) {
  const [localVisible, setLocalVisible] = useState(visibleColumns);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    setLocalVisible(visibleColumns);
  }, [visibleColumns]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleToggle = (columnKey) => {
    const newVisible = localVisible.includes(columnKey)
      ? localVisible.filter((key) => key !== columnKey)
      : [...localVisible, columnKey];
    setLocalVisible(newVisible);
    onColumnsChange && onColumnsChange(newVisible);

    localStorage.setItem('englishTestTableColumns', JSON.stringify(newVisible));
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (dropIndex) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const orderedVisibleColumnDefs = localVisible
      .map((key) => allColumns.find((col) => col.key === key))
      .filter((col) => col !== undefined);

    const draggedColumn = orderedVisibleColumnDefs[draggedIndex];
    const newOrderedDefs = [...orderedVisibleColumnDefs];
    newOrderedDefs.splice(draggedIndex, 1);
    newOrderedDefs.splice(dropIndex, 0, draggedColumn);

    const newVisible = newOrderedDefs.map((col) => col.key);

    setLocalVisible(newVisible);
    onColumnsChange && onColumnsChange(newVisible);
    localStorage.setItem('englishTestTableColumns', JSON.stringify(newVisible));
    setDraggedIndex(null);
  };

  const visibleColumnDefs = localVisible
    .map((key) => allColumns.find((col) => col.key === key))
    .filter((col) => col !== undefined);

  return (
    <div className={`dropdown${open ? ' show' : ''}`} ref={rootRef}>
      <button
        className="btn btn-sm btn-outline-secondary dropdown-toggle"
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
      >
        <i className="fas fa-cog me-1"></i>
        顯示欄位 ({localVisible.length}/{allColumns.length})
      </button>
      <ul
        className={`dropdown-menu${open ? ' show' : ''}`}
        style={{ minWidth: '250px', padding: '0.5rem' }}
      >
        <li>
          <div className="dropdown-item-text">
            <strong>選擇顯示欄位：</strong>
          </div>
        </li>
        <li>
          <hr className="dropdown-divider" />
        </li>

        {allColumns.map((col) => (
          <li key={col.key}>
            <div className="dropdown-item-text">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={localVisible.includes(col.key)}
                  onChange={() => handleToggle(col.key)}
                  id={`col-${col.key}`}
                />
                <label className="form-check-label" htmlFor={`col-${col.key}`}>
                  {col.label}
                </label>
              </div>
            </div>
          </li>
        ))}

        <li>
          <hr className="dropdown-divider" />
        </li>

        {visibleColumnDefs.length > 0 && (
          <>
            <li>
              <div className="dropdown-item-text">
                <strong>調整順序（拖曳）：</strong>
              </div>
            </li>
            {visibleColumnDefs.map((col, index) => (
              <li key={`sort-${col.key}`}>
                <div
                  className="dropdown-item-text"
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    handleDragStart(index);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    handleDragOver(e);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(index);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                  }}
                  style={{
                    cursor: 'move',
                    backgroundColor: draggedIndex === index ? '#e3f2fd' : 'transparent',
                    opacity: draggedIndex === index ? 0.6 : 1,
                    borderLeft: draggedIndex === index ? '3px solid #2196F3' : '3px solid transparent',
                    paddingLeft: '0.5rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <i className="fas fa-grip-vertical me-2 text-muted"></i>
                  {col.label}
                </div>
              </li>
            ))}
          </>
        )}
      </ul>
    </div>
  );
}
