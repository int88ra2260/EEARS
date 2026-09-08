import React, { useMemo, useState } from 'react';

const QUESTION_TYPES = [
  { value: 'text', label: '單行文字' },
  { value: 'email', label: 'Email' },
  { value: 'textarea', label: '多行文字' },
  { value: 'number', label: '數字' },
  { value: 'date', label: '日期' },
  { value: 'select', label: '下拉選單' },
  { value: 'radio', label: '單選' },
  { value: 'checkbox', label: '多選' },
  { value: 'checkbox_single', label: '同意勾選' },
  { value: 'checkbox_confirm', label: '確認打勾（長文）' },
  { value: 'content_block', label: '圖文說明區塊' },
  { value: 'file', label: '檔案上傳' },
  { value: 'score_pair', label: '成績（類別+分數）' },
];

function optionsToText(options) {
  return (options || [])
    .map((o) => (typeof o === 'string' ? o : o.label || o.value || ''))
    .filter(Boolean)
    .join('\n');
}

function textToOptions(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ value: line, label: line }));
}

function imagesToText(images) {
  return (images || [])
    .map((img) => {
      const parts = [img.url || '', img.caption || '', img.variant || 'info', img.alt || ''];
      return parts.join(' | ');
    })
    .join('\n');
}

/** 每行：url | 標題 | variant(success|danger|info|warning) | alt */
function textToImages(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url = '', caption = '', variant = 'info', alt = ''] = line.split('|').map((s) => s.trim());
      return {
        url,
        caption,
        variant: ['success', 'danger', 'info', 'warning'].includes(variant) ? variant : 'info',
        alt: alt || caption,
      };
    });
}

export default function FormQuestionEditorModal({
  question,
  sections,
  allQuestions = [],
  readOnly,
  isNew,
  onClose,
  onSave,
  onDelete,
}) {
  const content = question.content || {};
  const [draft, setDraft] = useState(() => ({
    ...question,
    studentEditable: question.studentEditable !== false,
    optionsText: optionsToText(question.options),
    contentIntro: content.intro || '',
    contentImageUrl: content.imageUrl || '',
    contentImageAlt: content.imageAlt || '',
    contentWarning: content.warning || '',
    contentOfficialUrl: content.officialUrl || '',
    contentListText: Array.isArray(content.listItems) ? content.listItems.join('\n') : '',
    contentImagesText: imagesToText(content.images),
    linkageEnabled: Boolean(question.visibleWhen?.fieldKey),
    linkageFieldKey: question.visibleWhen?.fieldKey || '',
    linkageEquals:
      question.visibleWhen?.equals
      || (Array.isArray(question.visibleWhen?.in) ? question.visibleWhen.in[0] : '')
      || '是',
  }));

  const patch = (partial) => setDraft((prev) => ({ ...prev, ...partial }));

  const triggerCandidates = useMemo(
    () =>
      (allQuestions || [])
        .filter((q) => q && q.id !== question.id && q.fieldKey && q.fieldKey !== draft.fieldKey)
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [allQuestions, question.id, draft.fieldKey]
  );

  const triggerOptions = useMemo(() => {
    const trigger = triggerCandidates.find((q) => q.fieldKey === draft.linkageFieldKey);
    return Array.isArray(trigger?.options) ? trigger.options : [];
  }, [triggerCandidates, draft.linkageFieldKey]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) {
      onClose();
      return;
    }
    const label = String(draft.label || '').trim();
    const fieldKey = String(draft.fieldKey || '').trim();
    if (!label || !fieldKey) {
      window.alert('請填寫題目名稱與欄位鍵');
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldKey)) {
      window.alert('欄位鍵須為英數與底線，且以字母開頭');
      return;
    }

    const next = {
      id: draft.id,
      fieldKey,
      sectionId: draft.sectionId,
      order: Number(draft.order) || 1,
      label,
      type: draft.type,
      required: Boolean(draft.required),
      system: Boolean(draft.system),
      helpText: draft.helpText || '',
      visible: draft.visible !== false,
      defaultValue: draft.defaultValue != null ? String(draft.defaultValue) : '',
      studentEditable: draft.studentEditable !== false,
      visibleWhen:
        draft.linkageEnabled && draft.linkageFieldKey
          ? {
              fieldKey: String(draft.linkageFieldKey).trim(),
              equals: String(draft.linkageEquals || '').trim() || '是',
            }
          : null,
      options: textToOptions(draft.optionsText),
      content: {
        intro: draft.contentIntro || '',
        imageUrl: draft.contentImageUrl || '',
        imageAlt: draft.contentImageAlt || '',
        warning: draft.contentWarning || '',
        officialUrl: draft.contentOfficialUrl || '',
        listItems: String(draft.contentListText || '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        images: textToImages(draft.contentImagesText),
      },
    };
    onSave(next);
  };

  const needsOptions = ['select', 'radio', 'checkbox', 'score_pair'].includes(draft.type);
  const isContentBlock = draft.type === 'content_block';
  const isConfirm = draft.type === 'checkbox_confirm';

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      role="dialog"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h5 className="modal-title">
              {readOnly ? '檢視題目' : isNew ? '新增題目' : '編輯題目'}
              {draft.system ? '（預設範本）' : ''}
            </h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-md-8">
                <label className="form-label">
                  {isConfirm ? '打勾說明文字（完整顯示在勾選旁）' : isContentBlock ? '區塊標題' : '題目文字'}
                </label>
                <textarea
                  className="form-control"
                  rows={isConfirm ? 3 : 1}
                  value={draft.label}
                  disabled={readOnly}
                  onChange={(e) => patch({ label: e.target.value })}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">題型</label>
                <select
                  className="form-select"
                  value={draft.type}
                  disabled={readOnly}
                  onChange={(e) => patch({ type: e.target.value })}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">所屬階段</label>
                <select
                  className="form-select"
                  value={draft.sectionId}
                  disabled={readOnly}
                  onChange={(e) => patch({ sectionId: e.target.value })}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">排序</label>
                <input
                  type="number"
                  className="form-control"
                  value={draft.order}
                  disabled={readOnly}
                  onChange={(e) => patch({ order: Number(e.target.value) })}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">欄位鍵</label>
                <input
                  className="form-control"
                  value={draft.fieldKey}
                  disabled={readOnly}
                  onChange={(e) => patch({ fieldKey: e.target.value })}
                />
                <div className="form-text">對應報名資料欄位；改動後請確認學生端與匯出仍正確。</div>
              </div>

              <div className="col-12">
                <label className="form-label">說明文字（短）</label>
                <input
                  className="form-control"
                  value={draft.helpText || ''}
                  disabled={readOnly}
                  onChange={(e) => patch({ helpText: e.target.value })}
                />
              </div>

              {!isContentBlock && !isConfirm && (
                <div className="col-12">
                  <label className="form-label">預設答案（學生端初始值）</label>
                  <input
                    className="form-control"
                    value={draft.defaultValue || ''}
                    disabled={readOnly}
                    onChange={(e) => patch({ defaultValue: e.target.value })}
                    placeholder="例如：804"
                  />
                  <div className="form-text">
                    若下方取消勾選「學生可修改」，學生只能看到此預設／已帶入值，無法更改。
                  </div>
                </div>
              )}

              {needsOptions && (
                <div className="col-12">
                  <label className="form-label">選項（每行一個）</label>
                  <textarea
                    className="form-control"
                    rows={8}
                    value={draft.optionsText}
                    disabled={readOnly}
                    onChange={(e) => patch({ optionsText: e.target.value })}
                  />
                </div>
              )}

              {isContentBlock && (
                <>
                  <div className="col-12">
                    <label className="form-label">前言／引導文字</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={draft.contentIntro}
                      disabled={readOnly}
                      onChange={(e) => patch({ contentIntro: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">警示框文字（橘框）</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={draft.contentWarning}
                      disabled={readOnly}
                      onChange={(e) => patch({ contentWarning: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">條列說明（每行一點，會顯示為 1. 2. 3.…）</label>
                    <textarea
                      className="form-control"
                      rows={8}
                      value={draft.contentListText}
                      disabled={readOnly}
                      onChange={(e) => patch({ contentListText: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">官方完整公告連結（報名須知用）</label>
                    <input
                      className="form-control"
                      value={draft.contentOfficialUrl}
                      disabled={readOnly}
                      onChange={(e) => patch({ contentOfficialUrl: e.target.value })}
                      placeholder="https://siwan.nsysu.edu.tw/..."
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">主圖網址（如個資同意書整頁圖）</label>
                    <input
                      className="form-control"
                      value={draft.contentImageUrl}
                      disabled={readOnly}
                      onChange={(e) => patch({ contentImageUrl: e.target.value })}
                      placeholder="/個資使用同意書.jpg"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">主圖替代文字</label>
                    <input
                      className="form-control"
                      value={draft.contentImageAlt}
                      disabled={readOnly}
                      onChange={(e) => patch({ contentImageAlt: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">
                      範例圖（每行一張：網址 | 標題 | variant | alt）
                    </label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={draft.contentImagesText}
                      disabled={readOnly}
                      onChange={(e) => patch({ contentImagesText: e.target.value })}
                      placeholder={'/正確證件照範例.png | ✅ 合格範例 | success | 合格範例\n/不合格證件照範例.jpg | ❌ 不合格範例 | danger | 不合格範例'}
                    />
                    <div className="form-text">
                      variant 可用：success（綠）、danger（紅）、warning（橘）、info（藍）。圖片請放 public/ 或可用完整 URL。
                    </div>
                  </div>
                </>
              )}

              <div className="col-12">
                <div className="border rounded p-3" style={{ background: '#f8fafc' }}>
                  <div className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="q-linkage"
                      checked={Boolean(draft.linkageEnabled)}
                      disabled={readOnly}
                      onChange={(e) =>
                        patch({
                          linkageEnabled: e.target.checked,
                          linkageFieldKey:
                            draft.linkageFieldKey
                            || triggerCandidates.find((q) => q.fieldKey === 'hasDisabilityCard')?.fieldKey
                            || triggerCandidates[0]?.fieldKey
                            || '',
                          linkageEquals: draft.linkageEquals || '是',
                        })
                      }
                    />
                    <label className="form-check-label" htmlFor="q-linkage">
                      依其他題目答案顯示（連動收合）
                    </label>
                  </div>
                  {draft.linkageEnabled ? (
                    <div className="row g-2">
                      <div className="col-md-7">
                        <label className="form-label">當此題答案為…</label>
                        <select
                          className="form-select"
                          value={draft.linkageFieldKey || ''}
                          disabled={readOnly}
                          onChange={(e) => patch({ linkageFieldKey: e.target.value })}
                        >
                          <option value="">請選擇觸發題</option>
                          {triggerCandidates.map((q) => (
                            <option key={q.id} value={q.fieldKey}>
                              {q.label || q.fieldKey}（{q.fieldKey}）
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-5">
                        <label className="form-label">等於</label>
                        {triggerOptions.length > 0 ? (
                          <select
                            className="form-select"
                            value={draft.linkageEquals || ''}
                            disabled={readOnly}
                            onChange={(e) => patch({ linkageEquals: e.target.value })}
                          >
                            {triggerOptions.map((opt) => {
                              const value = typeof opt === 'string' ? opt : opt.value;
                              const label = typeof opt === 'string' ? opt : (opt.label || opt.value);
                              return (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <input
                            className="form-control"
                            value={draft.linkageEquals || ''}
                            disabled={readOnly}
                            onChange={(e) => patch({ linkageEquals: e.target.value })}
                            placeholder="是"
                          />
                        )}
                      </div>
                      <div className="col-12">
                        <div className="form-text mb-0">
                          例：Q16／Q18 設為「是否有身心障礙手冊 = 是」時才展開。
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="col-12 d-flex flex-wrap gap-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="q-required"
                    checked={Boolean(draft.required)}
                    disabled={readOnly}
                    onChange={(e) => patch({ required: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="q-required">
                    必填
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="q-visible"
                    checked={draft.visible !== false}
                    disabled={readOnly}
                    onChange={(e) => patch({ visible: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="q-visible">
                    顯示於學生表單
                  </label>
                </div>
                {!isContentBlock && (
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="q-student-editable"
                      checked={draft.studentEditable !== false}
                      disabled={readOnly}
                      onChange={(e) => patch({ studentEditable: e.target.checked })}
                    />
                    <label className="form-check-label" htmlFor="q-student-editable">
                      學生可修改
                    </label>
                  </div>
                )}
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="q-preset"
                    checked={Boolean(draft.system)}
                    disabled={readOnly}
                    onChange={(e) => patch({ system: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="q-preset">
                    預設範本標記（僅標籤，不限制編輯）
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            {!readOnly && onDelete && !isNew && (
              <button
                type="button"
                className="btn btn-outline-danger me-auto"
                onClick={() => {
                  if (window.confirm(`確定永久刪除「${draft.label || '此題'}」？`)) {
                    onDelete();
                  }
                }}
              >
                刪除題目
              </button>
            )}
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              取消
            </button>
            {!readOnly && (
              <button type="submit" className="btn btn-primary">
                套用
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
