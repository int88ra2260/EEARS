import React from 'react';

const TYPE_LABELS = {
  text: '簡答',
  email: 'Email',
  textarea: '詳答',
  select: '下拉式選單',
  radio: '單選題',
  checkbox: '核取方塊',
  checkbox_single: '同意勾選',
  checkbox_confirm: '確認打勾',
  content_block: '圖文說明',
  date: '日期',
  file: '檔案上傳',
  score_pair: '成績（類別+分數）',
  number: '數字',
};

function optionLabel(opt) {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt;
  return opt.label || opt.value || '';
}

function optionValue(opt) {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt;
  return opt.value || opt.label || '';
}

/** Google Forms 風格題目預覽卡片 */
export default function FormQuestionCard({
  question,
  index,
  canManage,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onHide,
  onRestore,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}) {
  const opts = Array.isArray(question.options) ? question.options : [];
  const hidden = question.visible === false;

  return (
    <article
      className={`et-form-qcard ${selected ? 'is-selected' : ''} ${hidden ? 'is-hidden' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      <div className="et-form-qcard__accent" aria-hidden />
      <div className="et-form-qcard__body">
        <div className="et-form-qcard__top">
          <div className="et-form-qcard__title-row">
            <span className="et-form-qcard__index">{index}.</span>
            <h3 className="et-form-qcard__title">
              {question.label || '（未命名題目）'}
              {question.required ? <span className="et-form-qcard__req">*</span> : null}
            </h3>
          </div>
          <div className="et-form-qcard__meta">
            <span className="et-form-qcard__type">{TYPE_LABELS[question.type] || question.type}</span>
            {question.system ? <span className="et-form-chip et-form-chip--system">預設</span> : (
              <span className="et-form-chip et-form-chip--custom">自訂</span>
            )}
            {hidden ? <span className="et-form-chip et-form-chip--hidden">已隱藏</span> : null}
          </div>
        </div>

        {question.helpText ? (
          <p className="et-form-qcard__help">{question.helpText}</p>
        ) : null}

        <div className="et-form-qcard__preview" aria-hidden>
          {previewControl(question, opts)}
        </div>

        {canManage && (
          <div className="et-form-qcard__actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onMoveUp} title="上移">
              ↑
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onMoveDown} title="下移">
              ↓
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={onEdit}>
              編輯
            </button>
            {onDuplicate ? (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onDuplicate}>
                複製
              </button>
            ) : null}
            {hidden ? (
              <button type="button" className="btn btn-sm btn-outline-success" onClick={onRestore}>
                恢復顯示
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-outline-warning"
                onClick={onHide}
                title="隱藏此題（學生端不顯示）"
              >
                隱藏
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete}>
              刪除
            </button>
          </div>
        )}

        {!canManage && (
          <div className="et-form-qcard__actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={onEdit}>
              檢視
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function previewControl(question, opts) {
  switch (question.type) {
    case 'radio':
      return (
        <div className="et-form-preview-options">
          {(opts.length ? opts : [{ label: '選項 1' }, { label: '選項 2' }]).map((opt, i) => (
            <label key={optionValue(opt) || i} className="et-form-preview-option">
              <span className="et-form-preview-radio" />
              {optionLabel(opt) || `選項 ${i + 1}`}
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="et-form-preview-options">
          {(opts.length ? opts : [{ label: '選項 1' }, { label: '選項 2' }]).slice(0, 6).map((opt, i) => (
            <label key={optionValue(opt) || i} className="et-form-preview-option">
              <span className="et-form-preview-check" />
              {optionLabel(opt) || `選項 ${i + 1}`}
            </label>
          ))}
          {opts.length > 6 ? <div className="small text-muted">…共 {opts.length} 個選項</div> : null}
        </div>
      );
    case 'select':
      return (
        <div className="et-form-preview-select">
          請選擇
          <span aria-hidden>▾</span>
        </div>
      );
    case 'textarea':
      return <div className="et-form-preview-input et-form-preview-input--tall">您的回答</div>;
    case 'file':
      return <div className="et-form-preview-file">選擇檔案 / 尚未選擇任何檔案</div>;
    case 'score_pair':
      return (
        <div className="et-form-preview-score">
          <div className="et-form-preview-select">測驗類別 ▾</div>
          <div className="et-form-preview-input">成績</div>
        </div>
      );
    case 'checkbox_single':
      return (
        <label className="et-form-preview-option">
          <span className="et-form-preview-check" />
          我已閱讀並同意
        </label>
      );
    case 'checkbox_confirm':
      return (
        <label className="et-form-preview-option" style={{ alignItems: 'flex-start' }}>
          <span className="et-form-preview-check" style={{ marginTop: 3 }} />
          <span>{question.label || '確認說明文字…'}</span>
        </label>
      );
    case 'content_block': {
      const c = question.content || {};
      const items = Array.isArray(c.listItems) ? c.listItems : [];
      const imgs = Array.isArray(c.images) ? c.images : [];
      return (
        <div className="et-form-preview-content">
          {c.warning ? <div className="et-form-preview-warn">{c.warning}</div> : null}
          {items.length > 0 ? (
            <ol className="mb-0 ps-3 small">
              {items.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {items.length > 3 ? <li>…共 {items.length} 點</li> : null}
            </ol>
          ) : null}
          {c.imageUrl ? <div className="et-form-preview-file mt-2">主圖：{c.imageUrl}</div> : null}
          {imgs.length > 0 ? (
            <div className="small text-muted mt-1">範例圖 {imgs.length} 張</div>
          ) : null}
          {!c.warning && items.length === 0 && !c.imageUrl && imgs.length === 0 ? (
            <div className="text-muted small">（圖文區塊，請編輯內容）</div>
          ) : null}
        </div>
      );
    }
    case 'date':
      return <div className="et-form-preview-input">年 / 月 / 日</div>;
    case 'email':
      return <div className="et-form-preview-input">name@example.com</div>;
    default:
      return <div className="et-form-preview-input">您的回答</div>;
  }
}

export { TYPE_LABELS };
