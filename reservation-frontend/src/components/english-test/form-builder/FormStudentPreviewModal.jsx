import React, { useMemo, useState } from 'react';
import FormQuestionCard from './FormQuestionCard';

/**
 * 後台表單編輯器：以學生端大致結構預覽目前 schema（唯讀）。
 * 使用既有 FormQuestionCard，不模擬完整精靈流程。
 */
export default function FormStudentPreviewModal({ schema, onClose }) {
  const sections = useMemo(
    () => [...(schema?.sections || [])].sort((a, b) => a.order - b.order),
    [schema]
  );
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id || null);
  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  const questions = useMemo(() => {
    if (!activeSection) return [];
    return (schema?.questions || [])
      .filter((q) => q.sectionId === activeSection.id && q.visible !== false)
      .sort((a, b) => a.order - b.order);
  }, [schema, activeSection]);

  if (!schema) return null;

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="et-form-preview-title"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title" id="et-form-preview-title">
                學生端預覽（唯讀）
              </h5>
              <div className="small text-muted">
                依目前編輯中的 schema 顯示可見題目；未儲存的變更也會反映。實際學生精靈還有驗證／上傳等流程。
              </div>
            </div>
            <button type="button" className="btn-close" aria-label="關閉" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="d-flex flex-wrap gap-2 mb-3">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`btn btn-sm ${activeSection?.id === section.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setActiveSectionId(section.id)}
                >
                  {section.navLabel || section.title || section.id}
                </button>
              ))}
            </div>

            {activeSection && (
              <div className="mb-3">
                <h6 className="mb-1">{activeSection.title}</h6>
                {activeSection.description ? (
                  <p className="small text-muted mb-0">{activeSection.description}</p>
                ) : null}
              </div>
            )}

            {questions.length === 0 ? (
              <div className="text-muted small py-4 text-center">此階段沒有可見題目</div>
            ) : (
              <div className="et-form-builder" style={{ maxWidth: 720, margin: '0 auto' }}>
                {questions.map((q, i) => (
                  <FormQuestionCard
                    key={q.id}
                    question={q}
                    index={i + 1}
                    selected={false}
                    canManage={false}
                    onSelect={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
