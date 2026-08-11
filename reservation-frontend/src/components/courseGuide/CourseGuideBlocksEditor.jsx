import React, { useEffect, useState } from 'react';
import CourseGuideMediaField from './CourseGuideMediaField';
import { COURSE_GUIDE_MEDIA_CATALOG } from '../../constants/courseGuideMediaCatalog';

const BLOCK_TYPES = [
  { type: 'paragraph', label: '段落' },
  { type: 'heading', label: '小標題' },
  { type: 'list', label: '清單' },
  { type: 'callout', label: '提醒框' },
  { type: 'figure', label: '圖片' },
];

function emptyBlock(type) {
  switch (type) {
    case 'heading':
      return { type: 'heading', level: 4, textZh: '', textEn: '' };
    case 'list':
      return {
        type: 'list',
        style: 'ul',
        items: [{ textZh: '', textEn: '' }],
      };
    case 'callout':
      return {
        type: 'callout',
        titleZh: '',
        titleEn: '',
        items: [{ textZh: '', textEn: '' }],
      };
    case 'figure': {
      const first = COURSE_GUIDE_MEDIA_CATALOG[0];
      return {
        type: 'figure',
        src: first?.url || '',
        mediaId: first?.id || null,
        altZh: '',
        altEn: '',
        captionZh: '',
        captionEn: '',
      };
    }
    case 'paragraph':
    default:
      return { type: 'paragraph', textZh: '', textEn: '', muted: false };
  }
}

function moveItem(list, index, dir) {
  const next = [...list];
  const ni = index + dir;
  if (ni < 0 || ni >= next.length) return list;
  const tmp = next[index];
  next[index] = next[ni];
  next[ni] = tmp;
  return next;
}

function Field({ label, children }) {
  return (
    <label className="d-block mb-2">
      <div className="sch-block-field-label">{label}</div>
      {children}
    </label>
  );
}

function ListItemsEditor({ items, onChange }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="sch-block-list-items">
      {list.map((item, idx) => (
        <div key={idx} className="sch-block-list-item row g-2 align-items-end mb-2">
          <div className="col-md-5">
            <Field label={`項目 ${idx + 1}（中文）`}>
              <input
                className="form-control form-control-sm"
                value={item.textZh || ''}
                onChange={(e) => {
                  const next = list.map((x, i) => (i === idx ? { ...x, textZh: e.target.value } : x));
                  onChange(next);
                }}
              />
            </Field>
          </div>
          <div className="col-md-5">
            <Field label="English">
              <input
                className="form-control form-control-sm"
                value={item.textEn || ''}
                onChange={(e) => {
                  const next = list.map((x, i) => (i === idx ? { ...x, textEn: e.target.value } : x));
                  onChange(next);
                }}
              />
            </Field>
          </div>
          <div className="col-md-2 d-flex gap-1 pb-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={idx === 0}
              onClick={() => onChange(moveItem(list, idx, -1))}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={idx >= list.length - 1}
              onClick={() => onChange(moveItem(list, idx, 1))}
            >
              ↓
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => onChange(list.filter((_, i) => i !== idx))}
            >
              刪
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-sm btn-outline-dark"
        onClick={() => onChange([...list, { textZh: '', textEn: '' }])}
      >
        新增一列
      </button>
    </div>
  );
}

function BlockCard({ block, index, total, onChange, onMove, onRemove }) {
  const typeLabel = BLOCK_TYPES.find((t) => t.type === block.type)?.label || block.type;

  return (
    <div className="sch-block-card">
      <div className="sch-block-card__head">
        <div>
          <span className="sch-block-card__badge">{typeLabel}</span>
          <span className="sch-block-card__index">第 {index + 1} 塊</span>
        </div>
        <div className="d-flex gap-1 flex-wrap">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={index === 0} onClick={() => onMove(-1)}>
            上移
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={index >= total - 1}
            onClick={() => onMove(1)}
          >
            下移
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRemove}>
            刪除
          </button>
        </div>
      </div>

      {block.type === 'paragraph' ? (
        <div className="row g-2">
          <div className="col-md-6">
            <Field label="中文">
              <textarea
                className="form-control form-control-sm"
                rows={3}
                value={block.textZh || ''}
                onChange={(e) => onChange({ ...block, textZh: e.target.value })}
              />
            </Field>
          </div>
          <div className="col-md-6">
            <Field label="English">
              <textarea
                className="form-control form-control-sm"
                rows={3}
                value={block.textEn || ''}
                onChange={(e) => onChange({ ...block, textEn: e.target.value })}
              />
            </Field>
          </div>
          <div className="col-12 d-flex align-items-center gap-2">
            <input
              id={`muted-${index}`}
              type="checkbox"
              className="form-check-input"
              checked={!!block.muted}
              onChange={(e) => onChange({ ...block, muted: e.target.checked })}
            />
            <label htmlFor={`muted-${index}`} className="small text-muted mb-0">
              顯示為次要說明（較淡）
            </label>
          </div>
        </div>
      ) : null}

      {block.type === 'heading' ? (
        <div className="row g-2">
          <div className="col-md-2">
            <Field label="層級">
              <select
                className="form-select form-select-sm"
                value={block.level === 3 ? 3 : 4}
                onChange={(e) => onChange({ ...block, level: Number(e.target.value) })}
              >
                <option value={3}>大標題</option>
                <option value={4}>小標題</option>
              </select>
            </Field>
          </div>
          <div className="col-md-5">
            <Field label="中文">
              <input
                className="form-control form-control-sm"
                value={block.textZh || ''}
                onChange={(e) => onChange({ ...block, textZh: e.target.value })}
              />
            </Field>
          </div>
          <div className="col-md-5">
            <Field label="English">
              <input
                className="form-control form-control-sm"
                value={block.textEn || ''}
                onChange={(e) => onChange({ ...block, textEn: e.target.value })}
              />
            </Field>
          </div>
        </div>
      ) : null}

      {block.type === 'list' ? (
        <div>
          <Field label="清單樣式">
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 220 }}
              value={block.style || 'ul'}
              onChange={(e) => onChange({ ...block, style: e.target.value })}
            >
              <option value="ul">項目符號</option>
              <option value="ol">編號</option>
              <option value="tight">緊湊項目</option>
            </select>
          </Field>
          <ListItemsEditor items={block.items} onChange={(items) => onChange({ ...block, items })} />
        </div>
      ) : null}

      {block.type === 'callout' ? (
        <div>
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <Field label="提醒標題（中文）">
                <input
                  className="form-control form-control-sm"
                  value={block.titleZh || ''}
                  onChange={(e) => onChange({ ...block, titleZh: e.target.value })}
                />
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Title (EN)">
                <input
                  className="form-control form-control-sm"
                  value={block.titleEn || ''}
                  onChange={(e) => onChange({ ...block, titleEn: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <ListItemsEditor items={block.items} onChange={(items) => onChange({ ...block, items })} />
        </div>
      ) : null}

      {block.type === 'figure' ? (
        <div className="row g-2">
          <div className="col-12">
            <CourseGuideMediaField
              value={block}
              onChange={(next) => onChange({ ...block, ...next })}
            />
          </div>
          <div className="col-md-6">
            <Field label="圖片說明（中文）">
              <input
                className="form-control form-control-sm"
                value={block.captionZh || ''}
                onChange={(e) =>
                  onChange({
                    ...block,
                    captionZh: e.target.value,
                    altZh: e.target.value,
                  })
                }
              />
            </Field>
          </div>
          <div className="col-md-6">
            <Field label="Caption (EN)">
              <input
                className="form-control form-control-sm"
                value={block.captionEn || ''}
                onChange={(e) =>
                  onChange({
                    ...block,
                    captionEn: e.target.value,
                    altEn: e.target.value,
                  })
                }
              />
            </Field>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 修課說明圖文區塊表單編輯器（非開發者友善，輸出標準 blocks 陣列）
 */
export default function CourseGuideBlocksEditor({ value, onChange }) {
  const [blocks, setBlocks] = useState(() => (Array.isArray(value) ? value : []));
  const [addType, setAddType] = useState('paragraph');

  useEffect(() => {
    setBlocks(Array.isArray(value) ? value : []);
  }, [value]);

  const commit = (next) => {
    setBlocks(next);
    onChange?.(next);
  };

  return (
    <div className="sch-blocks-editor">
      <div className="sch-blocks-editor__toolbar">
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 160 }}
          value={addType}
          onChange={(e) => setAddType(e.target.value)}
        >
          {BLOCK_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-sm btn-dark"
          onClick={() => commit([...blocks, emptyBlock(addType)])}
        >
          新增內容塊
        </button>
        <span className="small text-muted">可加段落、標題、清單、提醒或圖片，再按主題的「儲存」。</span>
      </div>

      {blocks.length === 0 ? (
        <div className="sch-blocks-editor__empty">
          尚未加入任何內容。請選擇類型後按「新增內容塊」。
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {blocks.map((block, index) => (
            <BlockCard
              key={`${block.type}-${index}`}
              block={block}
              index={index}
              total={blocks.length}
              onChange={(nextBlock) => {
                const next = blocks.map((b, i) => (i === index ? nextBlock : b));
                commit(next);
              }}
              onMove={(dir) => commit(moveItem(blocks, index, dir))}
              onRemove={() => commit(blocks.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
