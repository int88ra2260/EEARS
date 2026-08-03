import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from 'react-bootstrap';
import { BLOCK_TYPE_META } from '../../../constants/weeklyBlocks';

export default function SortableBlockItem({
  block,
  selected,
  isFirst,
  isLast,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const meta = BLOCK_TYPE_META[block.type] || { label: block.type, icon: 'fa-cube' };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`weekly-block-item${selected ? ' is-selected' : ''}`}
    >
      <button
        type="button"
        className="weekly-block-item__drag"
        aria-label="拖曳排序"
        {...attributes}
        {...listeners}
      >
        <i className="fas fa-grip-vertical" aria-hidden="true" />
      </button>
      <button type="button" className="weekly-block-item__main" onClick={() => onSelect(block.id)}>
        <i className={`fas ${meta.icon} weekly-block-item__icon`} aria-hidden="true" />
        <span>{meta.label}</span>
      </button>
      <div className="weekly-block-item__actions">
        <Button
          size="sm"
          variant="outline-secondary"
          type="button"
          className="weekly-block-item__move"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp(block.id);
          }}
          title="上移"
          aria-label="上移區塊"
        >
          ↑
        </Button>
        <Button
          size="sm"
          variant="outline-secondary"
          type="button"
          className="weekly-block-item__move"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(block.id);
          }}
          title="下移"
          aria-label="下移區塊"
        >
          ↓
        </Button>
        <Button
          size="sm"
          variant="outline-secondary"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(block.id);
          }}
          title="複製區塊"
          aria-label="複製區塊"
        >
          複製
        </Button>
        <Button
          size="sm"
          variant="outline-danger"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(block.id);
          }}
          title="刪除區塊"
          aria-label="刪除區塊"
        >
          刪除
        </Button>
      </div>
    </div>
  );
}
