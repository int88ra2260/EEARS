import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Form } from 'react-bootstrap';

import PublicPreviewChrome from '../../components/layout/PublicPreviewChrome';
import MediaPicker from '../../components/media/MediaPicker';
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
import {
  fetchMediaLibraryAdmin,
  uploadMediaLibraryAdmin,
} from '../../services/mediaLibraryAdminApi';
import useToast from '../../components/ui/useToast';
import { VISUAL_SECTION_CONFIG } from './siteContentVisualConfig';
import elpStudentGuideImage from '../../assets/elp-student-guide.png';

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

function isImageUrlKey(contentKey) {
  return typeof contentKey === 'string' && /ImageUrl$/i.test(contentKey);
}

function resolveSidebarImagePreview(contentKey, url) {
  const custom = String(url || '').trim();
  if (/^https?:\/\//i.test(custom) || custom.startsWith('/')) {
    return { src: custom, isDefault: false };
  }
  if (contentKey === 'elpPage.guideImageUrl') {
    return { src: elpStudentGuideImage, isDefault: true };
  }
  return { src: '', isDefault: true };
}

function TextEditSidebar({
  draft,
  setDraft,
  saving,
  dirty,
  onSave,
  onClear,
  mediaToken,
}) {
  const toast = useToast();
  const imageMode = isImageUrlKey(draft.contentKey);
  const [assets, setAssets] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!imageMode || !mediaToken) {
      setAssets([]);
      return undefined;
    }
    let cancelled = false;
    setMediaLoading(true);
    fetchMediaLibraryAdmin(mediaToken, { mimePrefix: 'image/' })
      .then((data) => {
        if (!cancelled) setAssets(Array.isArray(data?.assets) ? data.assets : []);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e?.message || '載入媒體庫失敗');
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imageMode, mediaToken, toast]);

  if (!draft.contentKey) {
    return (
      <aside className="scm-visual__sidebar scm-visual__sidebar--empty">
        <p className="scm-visual__sidebar-title">編輯面板</p>
        <p className="scm-visual__sidebar-hint">
          在左側畫面上點擊任一段文字或圖片，即可在此修改內容。
        </p>
      </aside>
    );
  }

  const preview = imageMode ? resolveSidebarImagePreview(draft.contentKey, draft.valueZh) : null;

  const applyImageUrl = (url) => {
    const next = String(url || '').trim();
    setDraft((d) => ({
      ...d,
      valueZh: next,
      valueEn: next,
      isActive: true,
    }));
  };

  const handleUpload = async (file) => {
    if (!mediaToken) throw new Error('未登入');
    setUploading(true);
    try {
      const asset = await uploadMediaLibraryAdmin(mediaToken, file, {
        scope: 'elp',
        label: file.name,
      });
      setAssets((cur) => [asset, ...cur.filter((x) => x.id !== asset.id)]);
      toast.success('圖片已上傳');
      return asset;
    } catch (e) {
      toast.error(e?.message || '上傳失敗');
      throw e;
    } finally {
      setUploading(false);
    }
  };

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
        {imageMode ? (
          <>
            <div className="scm-visual__image-preview">
              {preview.src ? (
                <img src={preview.src} alt="圖片預覽" />
              ) : (
                <div className="p-4 text-center text-muted small">尚未設定圖片</div>
              )}
            </div>
            {preview.isDefault ? (
              <p className="small text-muted mb-2">目前使用系統預設圖。選圖或上傳後會覆寫。</p>
            ) : null}
            {mediaToken ? (
              <>
                {mediaLoading ? (
                  <p className="small text-muted mb-2">載入媒體庫…</p>
                ) : null}
                <MediaPicker
                  value={{ url: draft.valueZh || '', mediaId: null }}
                  assets={assets}
                  onChange={(next) => applyImageUrl(next.url)}
                  onUploadFile={handleUpload}
                  uploading={uploading}
                  emptyHint="媒體庫尚無圖片。可直接上傳新圖，或貼上網址。"
                />
              </>
            ) : (
              <Form.Group className="mb-3">
                <Form.Label>圖片網址</Form.Label>
                <Form.Control
                  value={draft.valueZh}
                  onChange={(e) => applyImageUrl(e.target.value)}
                  placeholder="/uploads/media/… 或 https://…"
                />
              </Form.Group>
            )}
            <Form.Group className="mb-3 mt-3">
              <Form.Label>圖片網址（可手動貼上）</Form.Label>
              <Form.Control
                value={draft.valueZh}
                onChange={(e) => applyImageUrl(e.target.value)}
                placeholder="空白＝恢復系統預設圖"
              />
            </Form.Group>
          </>
        ) : (
          <>
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
          </>
        )}
        <Form.Check
          type="switch"
          className="mb-3"
          label={imageMode
            ? '啟用自訂圖片（關閉後學生端恢復預設圖）'
            : '啟用（停用後學生端恢復預設文案）'}
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
  mediaToken = null,
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
          mediaToken={mediaToken}
        />
      </div>
    </div>
  );
}
