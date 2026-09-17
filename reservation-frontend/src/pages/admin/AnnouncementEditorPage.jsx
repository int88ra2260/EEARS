import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import SharedMediaLibraryModal from '../../components/media/SharedMediaLibraryModal';
import '../../components/media/SharedMediaLibraryModal.css';
import AnnouncementRichTextEditor from '../../components/admin/announcements/AnnouncementRichTextEditor';
import {
  createAdminAnnouncement,
  fetchAdminAnnouncement,
  updateAdminAnnouncement,
} from '../../services/announcementAdminApi';
import {
  isAnnouncementHtmlContent,
  sanitizeAnnouncementHtml,
} from '../../utils/sanitizeAnnouncementHtml';
import './AnnouncementEditorPage.css';

const empty = {
  title: '',
  summary: '',
  content: '',
  coverImage: '',
  coverImageAlt: '',
  slug: '',
  category: 'general',
  tags: '',
  seoTitle: '',
  seoDescription: '',
  ogImageUrl: '',
  scheduledPublishAt: '',
  expiresAt: '',
  publishedAt: '',
  isPublished: false,
  isPinned: false,
  sortOrder: 0,
  audienceType: 'all',
  shouldSendNotification: false,
  shouldSendEmail: false,
};

function toFormFromInitial(initial) {
  if (!initial) return { ...empty };
  return {
    title: initial.title || '',
    summary: initial.summary || '',
    content: initial.content || '',
    coverImage: initial.coverImage || '',
    coverImageAlt: initial.coverImageAlt || '',
    slug: initial.slug || '',
    category: initial.category || 'general',
    tags: Array.isArray(initial.tags) ? initial.tags.join(', ') : '',
    seoTitle: initial.seoTitle || '',
    seoDescription: initial.seoDescription || '',
    ogImageUrl: initial.ogImageUrl || '',
    scheduledPublishAt: initial.scheduledPublishAt
      ? new Date(initial.scheduledPublishAt).toISOString().slice(0, 16)
      : '',
    expiresAt: initial.expiresAt ? new Date(initial.expiresAt).toISOString().slice(0, 16) : '',
    publishedAt: initial.publishedAt ? new Date(initial.publishedAt).toISOString().slice(0, 16) : '',
    isPublished: !!initial.isPublished,
    isPinned: !!initial.isPinned,
    sortOrder: initial.sortOrder ?? 0,
    audienceType: initial.audienceType || 'all',
    shouldSendNotification: !!initial.shouldSendNotification,
    shouldSendEmail: !!initial.shouldSendEmail,
  };
}

function baseSlugFromTitle(title) {
  const raw = String(title || '')
    .trim()
    .slice(0, 80)
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (raw || 'announcement').slice(0, 160);
}

function contentLooksEmpty(html) {
  const plain = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !plain;
}

function ImageField({ label, value, onChange, token, helpText, onClear }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>{label}</Form.Label>
        <div className="d-flex gap-2 flex-wrap">
          <Form.Control
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="從媒體庫選擇，或貼上圖片網址"
          />
          <Button
            variant="outline-secondary"
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={!token}
          >
            選擇
          </Button>
          {value ? (
            <Button
              variant="outline-danger"
              type="button"
              onClick={() => {
                onChange('');
                onClear?.();
              }}
            >
              移除
            </Button>
          ) : null}
        </div>
        {helpText ? <Form.Text className="text-muted">{helpText}</Form.Text> : null}
        {value ? (
          <div className="shared-media-preview mt-2">
            <img src={value} alt="" />
          </div>
        ) : null}
      </Form.Group>
      <SharedMediaLibraryModal
        show={pickerOpen}
        onHide={() => setPickerOpen(false)}
        token={token}
        title={`選擇${label}`}
        uploadScope="announcement"
        onSelect={(item) => {
          onChange(item.url || item.urlPath || '');
          setPickerOpen(false);
        }}
      />
    </>
  );
}

export default function AnnouncementEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { token } = useOutletContext();

  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [editorReadyKey, setEditorReadyKey] = useState(isNew ? 'new' : `load-${id}`);
  const baselineRef = useRef('');

  const snapshot = useCallback((f) => JSON.stringify(f), []);

  const load = useCallback(async () => {
    if (isNew) {
      const next = { ...empty };
      setForm(next);
      baselineRef.current = snapshot(next);
      setEditorReadyKey(`new-${Date.now()}`);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminAnnouncement(token, id);
      const next = toFormFromInitial(data);
      setForm(next);
      baselineRef.current = snapshot(next);
      setEditorReadyKey(`edit-${id}-${data.updatedAt || data.id}`);
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [isNew, id, token, snapshot]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => !loading && snapshot(form) !== baselineRef.current,
    [form, loading, snapshot]
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const previewSlug = form.slug.trim() ? form.slug.trim() : baseSlugFromTitle(form.title);

  const goBack = () => {
    if (dirty && !window.confirm('內容尚未儲存，確定離開？')) return;
    navigate('/admin/announcements');
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!String(form.title).trim()) {
      setError('請填寫標題');
      return;
    }
    if (contentLooksEmpty(form.content)) {
      setError('請填寫內容');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const tags = String(form.tags)
        .split(/[,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const coverImage = form.coverImage.trim() || null;
      const content = isAnnouncementHtmlContent(form.content)
        ? sanitizeAnnouncementHtml(form.content)
        : form.content;
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        content,
        coverImage,
        coverImageAlt: form.coverImageAlt.trim() || null,
        slug: form.slug.trim() || undefined,
        category: form.category || 'general',
        tags: tags.length ? tags : null,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        ogImageUrl: form.ogImageUrl.trim() || null,
        scheduledPublishAt: form.scheduledPublishAt
          ? new Date(form.scheduledPublishAt).toISOString()
          : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        isPublished: !!form.isPublished,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
        isPinned: !!form.isPinned,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
        audienceType: form.audienceType || 'all',
        shouldSendNotification: !!form.shouldSendNotification,
        shouldSendEmail: !!form.shouldSendEmail,
      };

      if (isNew) {
        const created = await createAdminAnnouncement(token, payload);
        setToast('已建立公告');
        const synced = { ...form, content, coverImage: coverImage || '' };
        setForm(synced);
        baselineRef.current = snapshot(synced);
        navigate(`/admin/announcements/${created.id}/edit`, { replace: true });
      } else {
        await updateAdminAnnouncement(token, id, payload);
        setToast('已儲存');
        const synced = { ...form, content, coverImage: coverImage || '' };
        setForm(synced);
        baselineRef.current = snapshot(synced);
        if (content !== form.content) {
          setEditorReadyKey(`edit-${id}-saved-${Date.now()}`);
        }
      }
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ann-editor-page ann-editor-page--loading">
        <Spinner animation="border" role="status" />
        <span className="ms-2">載入編輯器…</span>
      </div>
    );
  }

  return (
    <div className="ann-editor-page">
      <header className="ann-editor-topbar">
        <div className="ann-editor-topbar__left">
          <Button variant="outline-secondary" size="sm" type="button" onClick={goBack}>
            ← 返回列表
          </Button>
          <div>
            <h1 className="ann-editor-topbar__title mb-0">{isNew ? '新增公告' : '編輯公告'}</h1>
            {dirty ? <span className="ann-editor-topbar__dirty">未儲存變更</span> : null}
          </div>
        </div>
        <div className="ann-editor-topbar__actions">
          {!isNew ? (
            <Link
              className="btn btn-sm btn-outline-primary"
              to={`/announcements/${encodeURIComponent(form.slug || id)}`}
              target="_blank"
              rel="noreferrer"
            >
              前台預覽
            </Link>
          ) : null}
          <Button variant="primary" type="button" disabled={saving} onClick={handleSave}>
            {saving ? '儲存中…' : '儲存'}
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      {toast ? (
        <Alert variant="success" className="mb-3 py-2" dismissible onClose={() => setToast('')}>
          {toast}
        </Alert>
      ) : null}

      <div className="ann-editor-layout">
        <main className="ann-editor-main">
          <Form.Group className="mb-3">
            <Form.Label>標題 *</Form.Label>
            <Form.Control
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={200}
              className="ann-editor-title-input"
            />
            <Form.Text className="text-muted">{String(form.title || '').length}/200</Form.Text>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>內容 *</Form.Label>
            <AnnouncementRichTextEditor
              value={form.content}
              resetKey={editorReadyKey}
              token={token}
              onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              disabled={saving}
            />
            <Form.Text className="text-muted">
              可調整字型（思源／標楷／Times）、字級、顏色、網底、對齊、粗斜底刪、超連結、表格與圖片。
            </Form.Text>
          </Form.Group>
        </main>

        <aside className="ann-editor-side">
          <section className="ann-editor-panel">
            <h2 className="ann-editor-panel__title">發布設定</h2>
            <Form.Group className="mb-2">
              <Form.Label>分類</Form.Label>
              <Form.Select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="general">一般</option>
                <option value="activity">活動</option>
                <option value="policy">政策</option>
                <option value="system">系統</option>
                <option value="emergency">緊急</option>
              </Form.Select>
            </Form.Group>
            <Form.Check
              className="mb-2"
              type="checkbox"
              label="立即發布"
              checked={form.isPublished}
              onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
            />
            <Form.Check
              className="mb-2"
              type="checkbox"
              label="置頂"
              checked={form.isPinned}
              onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
            />
            <Form.Group className="mb-2">
              <Form.Label>排程發布</Form.Label>
              <Form.Control
                type="datetime-local"
                value={form.scheduledPublishAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledPublishAt: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>到期下架</Form.Label>
              <Form.Control
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>發布時間（選填）</Form.Label>
              <Form.Control
                type="datetime-local"
                value={form.publishedAt}
                onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-0">
              <Form.Label>排序數字</Form.Label>
              <Form.Control
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </Form.Group>
          </section>

          <section className="ann-editor-panel">
            <h2 className="ann-editor-panel__title">摘要與 URL</h2>
            <Form.Group className="mb-2">
              <Form.Label>摘要</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>slug（選填）</Form.Label>
              <Form.Control
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="url-safe"
              />
              <Form.Text className="text-muted">
                預覽：<code>{previewSlug || '（由標題產生）'}</code>
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-0">
              <Form.Label>標籤（逗號分隔）</Form.Label>
              <Form.Control
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="例如：English Table, 期中考"
              />
            </Form.Group>
          </section>

          <section className="ann-editor-panel">
            <h2 className="ann-editor-panel__title">封面與 SEO</h2>
            <ImageField
              label="封面圖"
              value={form.coverImage}
              onChange={(url) => setForm((f) => ({ ...f, coverImage: url }))}
              onClear={() => setForm((f) => ({ ...f, coverImage: '', coverImageAlt: '' }))}
              token={token}
              helpText="只顯示於列表與詳情頂部；內文圖片請用上方編輯器「圖片」插入（可與封面不同）。詳情頁會自動隱藏開頭那張與封面重複的圖。"
            />
            <Form.Group className="mb-2">
              <Form.Label>封面替代文字</Form.Label>
              <Form.Control
                value={form.coverImageAlt}
                onChange={(e) => setForm((f) => ({ ...f, coverImageAlt: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>SEO Title</Form.Label>
              <Form.Control
                value={form.seoTitle}
                onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>SEO Description</Form.Label>
              <Form.Control
                value={form.seoDescription}
                onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
              />
            </Form.Group>
            <ImageField
              label="OG 圖片（選填）"
              value={form.ogImageUrl}
              onChange={(url) => setForm((f) => ({ ...f, ogImageUrl: url }))}
              onClear={() => setForm((f) => ({ ...f, ogImageUrl: '' }))}
              token={token}
            />
          </section>

          <section className="ann-editor-panel">
            <h2 className="ann-editor-panel__title">進階（預留）</h2>
            <Form.Group className="mb-2">
              <Form.Label>受眾</Form.Label>
              <Form.Select
                value={form.audienceType}
                onChange={(e) => setForm((f) => ({ ...f, audienceType: e.target.value }))}
              >
                <option value="all">全部</option>
                <option value="students">學生</option>
                <option value="teachers">教師</option>
                <option value="admins">管理者</option>
              </Form.Select>
            </Form.Group>
            <Form.Check
              className="mb-1"
              type="checkbox"
              label="shouldSendNotification"
              checked={form.shouldSendNotification}
              onChange={(e) => setForm((f) => ({ ...f, shouldSendNotification: e.target.checked }))}
            />
            <Form.Check
              className="mb-0"
              type="checkbox"
              label="shouldSendEmail"
              checked={form.shouldSendEmail}
              onChange={(e) => setForm((f) => ({ ...f, shouldSendEmail: e.target.checked }))}
            />
          </section>

          <Row className="g-2">
            <Col xs={6}>
              <Button variant="outline-secondary" className="w-100" type="button" onClick={goBack} disabled={saving}>
                取消
              </Button>
            </Col>
            <Col xs={6}>
              <Button variant="primary" className="w-100" type="button" onClick={handleSave} disabled={saving}>
                {saving ? '儲存中…' : '儲存'}
              </Button>
            </Col>
          </Row>
        </aside>
      </div>
    </div>
  );
}
