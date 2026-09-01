import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminEnglishTestFormSchema,
  resetAdminEnglishTestFormSchema,
  saveAdminEnglishTestFormSchema,
} from '../../../services/englishTestFormSchemaApi';
import { ensureEnglishTestFormSystemParts } from '../../../utils/englishTestFormSchemaEnsure';
import FormQuestionEditorModal from './FormQuestionEditorModal';
import FormSectionEditorModal from './FormSectionEditorModal';
import FormQuestionCard from './FormQuestionCard';
import FormStudentPreviewModal from './FormStudentPreviewModal';
import './EnglishTestFormBuilder.css';

/** 舊資料沒有 navLabel 時的後備顯示 */
const STEP_META = {
  announcement: { step: '步驟 0' },
  privacy: { step: '步驟 1' },
  verify: { step: '步驟 2' },
  eligibility: { step: '步驟 3' },
  contact: { step: '步驟 4 · A' },
  academic: { step: '步驟 4 · B' },
  special: { step: '步驟 4 · C' },
  photo: { step: '步驟 4 · D' },
  info: { step: '步驟 4 · E' },
  custom: { step: '其他' },
};

function sectionDisplayLabel(section) {
  if (section?.navLabel) return section.navLabel;
  return STEP_META[section?.id]?.step || '階段';
}

function newCustomQuestion(sectionId, order) {
  const stamp = Date.now().toString(36);
  return {
    id: `q_custom_${stamp}`,
    fieldKey: `extra_${stamp}`,
    sectionId: sectionId || 'custom',
    order,
    label: '新題目',
    type: 'text',
    required: false,
    system: false,
    helpText: '',
    visible: true,
    options: [],
    content: {
      intro: '',
      imageUrl: '',
      imageAlt: '',
      warning: '',
      listItems: [],
      images: [],
    },
  };
}

export default function EnglishTestFormBuilderTab({ token, canManage }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [schema, setSchema] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [backfillNotice, setBackfillNotice] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isNewQuestion, setIsNewQuestion] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [isNewSection, setIsNewSection] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(true);
  const [showStudentPreview, setShowStudentPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminEnglishTestFormSchema(token);
      const { schema: ensured, changed } = ensureEnglishTestFormSystemParts(data.schema);
      const nextSchema = JSON.parse(JSON.stringify(ensured));
      setSchema(nextSchema);
      setVersion(data.version);
      setUpdatedAt(data.updatedAt);
      setDirty(changed);
      if (changed) {
        setBackfillNotice('已補齊「報名須知」階段或預設題目，請確認內容後按「儲存變更」。');
      } else if (data.systemPartsBackfilled) {
        setBackfillNotice('後端已自動補齊缺漏的表單階段（含報名須知）。請確認後儲存。');
      } else {
        setBackfillNotice('');
      }
      const firstSection = [...(nextSchema.sections || [])].sort((a, b) => a.order - b.order)[0];
      setActiveSectionId(firstSection?.id || 'announcement');
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(
    () => [...(schema?.sections || [])].sort((a, b) => a.order - b.order),
    [schema]
  );

  useEffect(() => {
    if (!activeSectionId && sections[0]) {
      setActiveSectionId(sections[0].id);
    }
  }, [activeSectionId, sections]);

  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  const sectionCounts = useMemo(() => {
    const counts = {};
    for (const s of sections) counts[s.id] = { total: 0, visible: 0 };
    for (const q of schema?.questions || []) {
      if (!counts[q.sectionId]) counts[q.sectionId] = { total: 0, visible: 0 };
      counts[q.sectionId].total += 1;
      if (q.visible !== false) counts[q.sectionId].visible += 1;
    }
    return counts;
  }, [schema, sections]);

  const sectionQuestions = useMemo(() => {
    if (!activeSection) return [];
    let list = (schema?.questions || []).filter((q) => q.sectionId === activeSection.id);
    if (!showHidden) list = list.filter((q) => q.visible !== false);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.fieldKey.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.order - b.order);
  }, [schema, activeSection, search, showHidden]);

  const updateQuestions = (nextQuestions) => {
    setSchema((prev) => ({ ...prev, questions: nextQuestions }));
    setDirty(true);
  };

  const patchQuestion = (id, partial) => {
    updateQuestions(
      (schema.questions || []).map((q) => (q.id === id ? { ...q, ...partial } : q))
    );
  };

  const handleSave = async () => {
    if (!canManage) return;
    setSaving(true);
    setError('');
    try {
      const saved = await saveAdminEnglishTestFormSchema(token, {
        schema,
        changeSummary: '後台表單編輯器儲存',
      });
      setSchema(JSON.parse(JSON.stringify(saved.schema)));
      setVersion(saved.version);
      setUpdatedAt(saved.updatedAt);
      setDirty(false);
      if (Array.isArray(saved.warnings) && saved.warnings.length > 0) {
        setBackfillNotice(saved.warnings.join(' '));
        window.alert(`已儲存。\n\n提醒：\n${saved.warnings.join('\n')}`);
      } else {
        setBackfillNotice('');
      }
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!canManage) return;
    if (!window.confirm('確定重設為系統預設題目？自訂題將會消失。')) return;
    setSaving(true);
    setError('');
    try {
      const saved = await resetAdminEnglishTestFormSchema(token);
      setSchema(JSON.parse(JSON.stringify(saved.schema)));
      setVersion(saved.version);
      setUpdatedAt(saved.updatedAt);
      setDirty(false);
      const first = [...(saved.schema?.sections || [])].sort((a, b) => a.order - b.order)[0];
      if (first) setActiveSectionId(first.id);
    } catch (err) {
      setError(err.message || '重設失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const sectionId = activeSection?.id || 'custom';
    const maxOrder = Math.max(
      0,
      ...(schema.questions || []).filter((q) => q.sectionId === sectionId).map((q) => q.order || 0)
    );
    const q = newCustomQuestion(sectionId, maxOrder + 1);
    setIsNewQuestion(true);
    setEditingQuestion(q);
  };

  const handleDelete = (question) => {
    if (!window.confirm(`確定永久刪除「${question.label}」？此操作儲存後才會套用到學生端。`)) return;
    updateQuestions((schema.questions || []).filter((q) => q.id !== question.id));
    if (selectedQuestionId === question.id) setSelectedQuestionId(null);
  };

  const handleHide = (question) => {
    if (!window.confirm(`確定從學生表單隱藏「${question.label}」？`)) {
      return;
    }
    patchQuestion(question.id, { visible: false });
  };

  const handleRestore = (question) => {
    patchQuestion(question.id, { visible: true });
  };

  const handleDuplicate = (question) => {
    const stamp = Date.now().toString(36);
    const copy = {
      ...JSON.parse(JSON.stringify(question)),
      id: `q_copy_${stamp}`,
      fieldKey: `${question.fieldKey || 'extra'}_copy_${stamp}`,
      label: `${question.label || '題目'}（副本）`,
      system: false,
      order: (Number(question.order) || 1) + 1,
    };
    updateQuestions([...(schema.questions || []), copy]);
    setSelectedQuestionId(copy.id);
  };

  const handleMove = (question, direction) => {
    const list = [...(schema.questions || [])]
      .filter((q) => q.sectionId === question.sectionId)
      .sort((a, b) => a.order - b.order);
    const idx = list.findIndex((q) => q.id === question.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    const orderA = a.order;
    const next = (schema.questions || []).map((q) => {
      if (q.id === a.id) return { ...q, order: b.order };
      if (q.id === b.id) return { ...q, order: orderA };
      return q;
    });
    updateQuestions(next);
  };

  const handleEditorSave = (edited) => {
    const exists = (schema.questions || []).some((q) => q.id === edited.id);
    if (exists) {
      updateQuestions((schema.questions || []).map((q) => (q.id === edited.id ? edited : q)));
    } else {
      updateQuestions([...(schema.questions || []), edited]);
    }
    setSelectedQuestionId(edited.id);
    if (edited.sectionId) setActiveSectionId(edited.sectionId);
    setEditingQuestion(null);
    setIsNewQuestion(false);
  };

  const updateSectionTitle = (sectionId, title) => {
    setSchema((prev) => ({
      ...prev,
      sections: (prev.sections || []).map((s) =>
        s.id === sectionId ? { ...s, title: title.trim() || s.title } : s
      ),
    }));
    setDirty(true);
  };

  const updateSections = (nextSections) => {
    setSchema((prev) => ({ ...prev, sections: nextSections }));
    setDirty(true);
  };

  const handleAddSection = () => {
    const maxOrder = Math.max(0, ...(schema.sections || []).map((s) => s.order || 0));
    const stamp = Date.now().toString(36);
    setIsNewSection(true);
    setEditingSection({
      id: `section_${stamp}`,
      title: '新區塊',
      navLabel: `步驟 · 新區塊`,
      order: maxOrder + 1,
    });
  };

  const handleEditSection = (section) => {
    setIsNewSection(false);
    setEditingSection({ ...section });
  };

  const handleSectionEditorSave = (edited) => {
    if (isNewSection) {
      updateSections([...(schema.sections || []), edited].sort((a, b) => a.order - b.order));
      setActiveSectionId(edited.id);
    } else {
      updateSections(
        (schema.sections || [])
          .map((s) => (s.id === edited.id ? { ...s, ...edited } : s))
          .sort((a, b) => a.order - b.order)
      );
    }
    setEditingSection(null);
    setIsNewSection(false);
  };

  const handleDeleteSection = (section) => {
    if (!section) return;
    if ((schema.sections || []).length <= 1) {
      window.alert('至少需保留一個階段／區塊。');
      return;
    }
    const qCount = (schema.questions || []).filter((q) => q.sectionId === section.id).length;
    const msg =
      qCount > 0
        ? `確定刪除「${sectionDisplayLabel(section)} · ${section.title}」？\n其中 ${qCount} 題也會一併刪除。`
        : `確定刪除「${sectionDisplayLabel(section)} · ${section.title}」？`;
    if (!window.confirm(msg)) return;

    const nextSections = (schema.sections || []).filter((s) => s.id !== section.id);
    const nextQuestions = (schema.questions || []).filter((q) => q.sectionId !== section.id);
    setSchema((prev) => ({ ...prev, sections: nextSections, questions: nextQuestions }));
    setDirty(true);
    if (activeSectionId === section.id) {
      const nextActive = [...nextSections].sort((a, b) => a.order - b.order)[0];
      setActiveSectionId(nextActive?.id || null);
    }
    setSelectedQuestionId(null);
  };

  const handleMoveSection = (section, direction) => {
    const list = [...(schema.sections || [])].sort((a, b) => a.order - b.order);
    const idx = list.findIndex((s) => s.id === section.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    const orderA = a.order;
    updateSections(
      (schema.sections || []).map((s) => {
        if (s.id === a.id) return { ...s, order: b.order };
        if (s.id === b.id) return { ...s, order: orderA };
        return s;
      })
    );
  };

  if (loading) {
    return <div className="p-4 text-muted">載入報名表單…</div>;
  }

  if (!schema) {
    return (
      <div className="alert alert-danger">
        {error || '無法載入報名表單'}
        <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={load}>
          重試
        </button>
      </div>
    );
  }

  const stepInfo = { step: sectionDisplayLabel(activeSection), short: activeSection?.title };

  return (
    <div className="et-form-builder">
      <div className="et-form-builder__toolbar">
        <div>
          <h5 className="mb-1">報名表單（階段預覽）</h5>
          <div className="small text-muted">
            版本 v{version}
            {updatedAt ? ` · 更新於 ${new Date(updatedAt).toLocaleString('zh-TW')}` : ''}
            {dirty ? ' · 尚未儲存' : ''}
          </div>
          <div className="small text-muted mt-1">
            左側可新增／編輯／刪除／排序「步驟與區塊」；右側編輯題目。與 Google Forms 相同，階段與題目皆可自由 CRUD。
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <input
            className="form-control form-control-sm et-form-builder__search"
            placeholder="搜尋此階段題目…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="form-check mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              id="et-show-hidden"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="et-show-hidden">
              顯示已隱藏
            </label>
          </div>
          <button
            type="button"
            className="btn btn-outline-info btn-sm"
            onClick={() => setShowStudentPreview(true)}
          >
            學生端預覽
          </button>
          {canManage ? (
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleReset} disabled={saving}>
                重設預設
              </button>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={load} disabled={saving}>
                重新載入
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !dirty}>
                {saving ? '儲存中…' : '儲存變更'}
              </button>
            </>
          ) : (
            <span className="badge text-bg-secondary">僅檢視</span>
          )}
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}
      {backfillNotice ? (
        <div className={`alert py-2 mb-0 ${backfillNotice.includes('尚未') ? 'alert-warning' : 'alert-info'}`}>
          {backfillNotice}
        </div>
      ) : null}

      <div className="et-form-builder__layout">
        <aside className="et-form-builder__steps" aria-label="表單階段">
          <div className="et-form-builder__steps-title">表單階段</div>
          {sections.map((s) => {
            const count = sectionCounts[s.id] || { total: 0, visible: 0 };
            return (
              <div
                key={s.id}
                className={`et-form-step ${activeSection?.id === s.id ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  className="et-form-step__main"
                  onClick={() => {
                    setActiveSectionId(s.id);
                    setSelectedQuestionId(null);
                  }}
                >
                  <span className="et-form-step__label">
                    {sectionDisplayLabel(s)} · {s.title}
                  </span>
                  <span className="et-form-step__count">
                    {count.visible} 題顯示
                    {count.total > count.visible ? `（隱藏 ${count.total - count.visible}）` : ''}
                  </span>
                </button>
                {canManage ? (
                  <div className="et-form-step__actions">
                    <button type="button" className="btn btn-sm btn-link p-0" title="上移" onClick={() => handleMoveSection(s, 'up')}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-sm btn-link p-0" title="下移" onClick={() => handleMoveSection(s, 'down')}>
                      ↓
                    </button>
                    <button type="button" className="btn btn-sm btn-link p-0" title="編輯" onClick={() => handleEditSection(s)}>
                      編輯
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-danger p-0"
                      title="刪除"
                      onClick={() => handleDeleteSection(s)}
                    >
                      刪
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {canManage ? (
            <button type="button" className="btn btn-outline-success btn-sm w-100 mt-2" onClick={handleAddSection}>
              ＋ 新增階段／區塊
            </button>
          ) : null}
        </aside>

        <div className="et-form-builder__canvas">
          <header className="et-form-builder__form-header">
            <h2>{schema.title || '培力英檢報名表單'}</h2>
            <p>
              正在檢視：{stepInfo.step} — {activeSection?.title}
              。儲存後學生端會依 schema 顯示對應題目；步驟流程若綁定固定 ID（privacy／verify 等）請留意。
            </p>
          </header>

          <div className="et-form-builder__section-bar">
            {canManage ? (
              <div className="et-form-builder__section-edit">
                <input
                  className="form-control form-control-sm"
                  style={{ maxWidth: 280 }}
                  value={activeSection?.title || ''}
                  onChange={(e) => updateSectionTitle(activeSection.id, e.target.value)}
                  aria-label="區塊標題"
                  placeholder="區塊標題"
                />
                <input
                  className="form-control form-control-sm"
                  style={{ maxWidth: 160 }}
                  value={activeSection?.navLabel || ''}
                  onChange={(e) => {
                    const navLabel = e.target.value;
                    updateSections(
                      (schema.sections || []).map((s) =>
                        s.id === activeSection.id ? { ...s, navLabel } : s
                      )
                    );
                  }}
                  aria-label="導覽標籤"
                  placeholder="步驟標籤"
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => handleEditSection(activeSection)}
                >
                  編輯階段
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => handleDeleteSection(activeSection)}
                >
                  刪除階段
                </button>
              </div>
            ) : (
              <h3>{activeSection?.title}</h3>
            )}
            {canManage && (
              <button type="button" className="btn btn-success btn-sm" onClick={handleAdd}>
                ＋ 在此階段新增題目
              </button>
            )}
          </div>

          <div className="et-form-builder__cards">
            {sectionQuestions.length === 0 && (
              <div className="et-form-builder__empty">
                此階段目前沒有題目
                {search ? '（或不符合搜尋條件）' : ''}
                {canManage ? '，可點上方「新增題目」。' : '。'}
              </div>
            )}
            {sectionQuestions.map((q, idx) => (
              <FormQuestionCard
                key={q.id}
                question={q}
                index={idx + 1}
                canManage={canManage}
                selected={selectedQuestionId === q.id}
                onSelect={() => setSelectedQuestionId(q.id)}
                onEdit={() => {
                  setIsNewQuestion(false);
                  setEditingQuestion({ ...q, options: [...(q.options || [])] });
                }}
                onDelete={() => handleDelete(q)}
                onHide={() => handleHide(q)}
                onRestore={() => handleRestore(q)}
                onDuplicate={() => handleDuplicate(q)}
                onMoveUp={() => handleMove(q, 'up')}
                onMoveDown={() => handleMove(q, 'down')}
              />
            ))}
          </div>

          {canManage && sectionQuestions.length > 0 && (
            <div className="et-form-builder__add text-center">
              <button type="button" className="btn btn-outline-success" onClick={handleAdd}>
                ＋ 新增題目到「{activeSection?.title}」
              </button>
            </div>
          )}
        </div>
      </div>

      {editingQuestion && (
        <FormQuestionEditorModal
          question={editingQuestion}
          sections={sections}
          readOnly={!canManage}
          isNew={isNewQuestion}
          onClose={() => {
            setEditingQuestion(null);
            setIsNewQuestion(false);
          }}
          onSave={handleEditorSave}
          onDelete={
            canManage
              ? () => {
                  handleDelete(editingQuestion);
                  setEditingQuestion(null);
                  setIsNewQuestion(false);
                }
              : undefined
          }
        />
      )}

      {editingSection && (
        <FormSectionEditorModal
          section={editingSection}
          isNew={isNewSection}
          readOnly={!canManage}
          existingIds={(schema.sections || []).map((s) => s.id)}
          onClose={() => {
            setEditingSection(null);
            setIsNewSection(false);
          }}
          onSave={handleSectionEditorSave}
        />
      )}

      {showStudentPreview && (
        <FormStudentPreviewModal schema={schema} onClose={() => setShowStudentPreview(false)} />
      )}
    </div>
  );
}
