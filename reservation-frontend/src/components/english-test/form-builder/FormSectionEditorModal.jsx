import React, { useState } from 'react';

/**
 * 新增／編輯表單階段（步驟／區塊 A·B·C…）
 */
export default function FormSectionEditorModal({
  section,
  isNew,
  readOnly,
  existingIds = [],
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() => ({
    id: section?.id || '',
    title: section?.title || '',
    navLabel: section?.navLabel || '',
    order: section?.order || 1,
  }));

  const patch = (partial) => setDraft((prev) => ({ ...prev, ...partial }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) {
      onClose();
      return;
    }
    const title = String(draft.title || '').trim();
    const id = String(draft.id || '').trim();
    if (!title) {
      window.alert('請填寫階段／區塊標題');
      return;
    }
    if (!id) {
      window.alert('請填寫階段 ID');
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(id)) {
      window.alert('階段 ID 須為英數與底線，且以字母開頭（例如 contact、block_a）');
      return;
    }
    if (isNew && existingIds.includes(id)) {
      window.alert('此階段 ID 已存在');
      return;
    }
    onSave({
      id: isNew ? id : section.id,
      title,
      navLabel: String(draft.navLabel || '').trim(),
      order: Number(draft.order) || 1,
    });
  };

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      role="dialog"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h5 className="modal-title">{readOnly ? '檢視階段' : isNew ? '新增階段／區塊' : '編輯階段／區塊'}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">標題（畫布上方與學生端區塊名）</label>
              <input
                className="form-control"
                value={draft.title}
                disabled={readOnly}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="例如：A. 基本聯絡資訊"
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">左側導覽標籤</label>
              <input
                className="form-control"
                value={draft.navLabel}
                disabled={readOnly}
                onChange={(e) => patch({ navLabel: e.target.value })}
                placeholder="例如：步驟 4 · A"
              />
              <div className="form-text">顯示在左側「表單階段」清單，可自訂步驟編號與區塊代號。</div>
            </div>
            <div className="row g-3">
              <div className="col-md-8">
                <label className="form-label">階段 ID</label>
                <input
                  className="form-control"
                  value={draft.id}
                  disabled={readOnly || !isNew}
                  onChange={(e) => patch({ id: e.target.value })}
                  placeholder="例如 block_g"
                  required
                />
                {!isNew ? (
                  <div className="form-text">既有階段 ID 不可改（題目以此關聯）；若需更換請新增後搬移題目。</div>
                ) : (
                  <div className="form-text">建立後不可改。學生端既有流程若依 ID 綁定（如 privacy、verify），請沿用或自行接線。</div>
                )}
              </div>
              <div className="col-md-4">
                <label className="form-label">排序</label>
                <input
                  type="number"
                  className="form-control"
                  value={draft.order}
                  disabled={readOnly}
                  onChange={(e) => patch({ order: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              取消
            </button>
            {!readOnly ? (
              <button type="submit" className="btn btn-primary">
                {isNew ? '新增' : '套用'}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
