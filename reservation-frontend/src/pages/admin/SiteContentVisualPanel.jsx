import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Form } from 'react-bootstrap';

import PublicPreviewChrome from '../../components/layout/PublicPreviewChrome';
import SiteContentPreviewShell from '../../context/SiteContentPreviewShell';
import SiteContentPreviewLanguageProvider, {
  catalogRowsToOverrides,
  mergeDraftOverride,
} from '../../context/SiteContentPreviewLanguageProvider';
import { SiteContentVisualEditProvider } from '../../context/SiteContentVisualEditContext';
import { LANG_EN, LANG_ZH } from '../../context/LanguageContext';
import { getTranslation } from '../../constants/translations';
import {
  labelForContentKey,
  mergeTextCatalog,
} from '../../utils/siteContentCatalog';
import { VISUAL_SECTION_CONFIG } from './siteContentVisualConfig';

function emptyDraft() {
  return {
    id: null,
    contentKey: '',
    label: '',
    valueZh: '',
    valueEn: '',
    isActive: true,
  };
}

function rowToDraft(row) {
  if (!row) return emptyDraft();
  return {
    id: row.id ?? null,
    contentKey: row.contentKey || '',
    label: row.label || labelForContentKey(row.contentKey),
    valueZh: row.valueZh ?? '',
    valueEn: row.valueEn ?? '',
    isActive: row.isActive !== false,
  };
}

function TextEditSidebar({
  draft,
  setDraft,
  saving,
  dirty,
  onSave,
  onClear,
}) {
  if (!draft.contentKey) {
    return (
      <aside className="scm-visual__sidebar scm-visual__sidebar--empty">
        <p className="scm-visual__sidebar-title">編輯面板</p>
        <p className="scm-visual__sidebar-hint">
          在左側畫面上點擊任一段文字，即可在此修改中文與英文內容。
        </p>
      </aside>
    );
  }

  return (
    <aside className="scm-visual__sidebar">
      <div className="scm-visual__sidebar-head">
        <p className="scm-visual__sidebar-title">正在編輯</p>
        <button
          type="button"
          className="scm-btn-ghost scm-visual__sidebar-close"
          onClick={onClear}
          disabled={saving}
        >
          關閉
        </button>
      </div>
      <p className="scm-visual__sidebar-key">{draft.label || draft.contentKey}</p>
      <p className="scm-visual__sidebar-meta">{draft.contentKey}</p>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <Form.Group className="mb-3">
          <Form.Label>中文</Form.Label>
          <Form.Control
            as="textarea"
            rows={5}
            value={draft.valueZh}
            onChange={(e) => setDraft((d) => ({ ...d, valueZh: e.target.value }))}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>English</Form.Label>
          <Form.Control
            as="textarea"
            rows={5}
            value={draft.valueEn}
            onChange={(e) => setDraft((d) => ({ ...d, valueEn: e.target.value }))}
          />
        </Form.Group>
        <Form.Check
          type="switch"
          className="mb-3"
          label="啟用（停用後學生端恢復預設文案）"
          checked={draft.isActive}
          onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
        />
        <div className="scm-visual__sidebar-actions">
          <button type="submit" className="scm-btn-primary" disabled={saving || !dirty}>
            {saving ? '儲存中…' : '儲存變更'}
          </button>
        </div>
      </Form>
    </aside>
  );
}

export default function SiteContentVisualPanel({
  section,
  items,
  loading,
  saving,
  onSave,
  onSwitchToList,
}) {
  const config = VISUAL_SECTION_CONFIG[section];
  const [previewLang, setPreviewLang] = useState('zh');
  const [selectedKey, setSelectedKey] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [initialDraft, setInitialDraft] = useState(emptyDraft());

  const catalogRows = useMemo(
    () => mergeTextCatalog(section, items),
    [section, items]
  );

  const rowByKey = useMemo(
    () => new Map(catalogRows.map((row) => [row.contentKey, row])),
    [catalogRows]
  );

  const selectKey = useCallback((key) => {
    const row = rowByKey.get(key);
    const next = row
      ? rowToDraft(row)
      : {
          ...emptyDraft(),
          contentKey: key,
          label: labelForContentKey(key),
          valueZh: getTranslation(LANG_ZH, key),
          valueEn: getTranslation(LANG_EN, key),
        };
    setSelectedKey(key);
    setDraft(next);
    setInitialDraft(next);
  }, [rowByKey]);

  const clearSelection = useCallback(() => {
    setSelectedKey(null);
    setDraft(emptyDraft());
    setInitialDraft(emptyDraft());
  }, []);

  useEffect(() => {
    clearSelection();
  }, [section, clearSelection]);

  useEffect(() => {
    if (!selectedKey) return;
    const el = document.querySelector(`[data-content-key="${CSS.escape(selectedKey)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedKey, previewLang]);

  const previewOverrides = useMemo(() => {
    const base = catalogRowsToOverrides(catalogRows);
    return mergeDraftOverride(base, draft);
  }, [catalogRows, draft]);

  const dirty = useMemo(() => {
    if (!draft.contentKey) return false;
    return (
      draft.valueZh !== initialDraft.valueZh
      || draft.valueEn !== initialDraft.valueEn
      || draft.isActive !== initialDraft.isActive
    );
  }, [draft, initialDraft]);

  const handleSave = async () => {
    if (!draft.contentKey) return;
    await onSave({
      id: draft.id,
      contentKey: draft.contentKey,
      label: draft.label || labelForContentKey(draft.contentKey),
      valueZh: draft.valueZh,
      valueEn: draft.valueEn,
      isActive: draft.isActive,
    });
    setInitialDraft(draft);
  };

  if (!config) {
    return (
      <div className="scm-empty">
        <p className="scm-empty__title">此區塊尚不支援視覺編輯</p>
        <button type="button" className="scm-btn-ghost" onClick={onSwitchToList}>
          改用列表編輯
        </button>
      </div>
    );
  }

  const PreviewComponent = config.Component;
  const useChrome = config.layout !== 'minimal';

  return (
    <div className="scm-visual">
      <div className="scm-visual__toolbar">
        <p className="scm-visual__toolbar-hint">{config.hint}</p>
        <div className="scm-visual__toolbar-actions">
          <div className="scm-preview__lang" role="group" aria-label="預覽語言">
            <button
              type="button"
              className={`scm-preview__lang-btn${previewLang === 'zh' ? ' is-active' : ''}`}
              onClick={() => setPreviewLang('zh')}
            >
              中文預覽
            </button>
            <button
              type="button"
              className={`scm-preview__lang-btn${previewLang === 'en' ? ' is-active' : ''}`}
              onClick={() => setPreviewLang('en')}
            >
              EN
            </button>
          </div>
          <button type="button" className="scm-btn-ghost" onClick={onSwitchToList}>
            進階列表編輯
          </button>
        </div>
      </div>

      <div className="scm-visual__workspace">
        <div className="scm-visual__preview-wrap">
          {loading ? (
            <div className="scm-loading scm-visual__loading">載入預覽中…</div>
          ) : (
            <div className="scm-visual__preview-scroll">
              <SiteContentPreviewShell previewPath={config.path}>
                <SiteContentPreviewLanguageProvider
                  extraOverrides={previewOverrides}
                  previewLang={previewLang}
                >
                  <SiteContentVisualEditProvider
                    section={section}
                    activeKey={selectedKey}
                    onSelectKey={selectKey}
                  >
                    {useChrome ? (
                      <PublicPreviewChrome variant={config.layout}>
                        <PreviewComponent />
                      </PublicPreviewChrome>
                    ) : (
                      <PreviewComponent />
                    )}
                  </SiteContentVisualEditProvider>
                </SiteContentPreviewLanguageProvider>
              </SiteContentPreviewShell>
            </div>
          )}
        </div>

        <TextEditSidebar
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          dirty={dirty}
          onSave={handleSave}
          onClear={clearSelection}
        />
      </div>
    </div>
  );
}
