import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Form, Button, Alert, Row, Col } from 'react-bootstrap';

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
  const base = raw || 'announcement';
  // backend：SLUG_MAX=180，baseSlugFromTitle 會再切到 SLUG_MAX - 20
  return base.slice(0, 160);
}

export default function AnnouncementFormModal({ show, onHide, initial, onSubmit, saving }) {
  const [form, setForm] = useState(empty);
  const [localError, setLocalError] = useState('');
  const baselineRef = useRef('');

  const snapshot = useCallback((f) => JSON.stringify(f), []);

  useEffect(() => {
    if (!show) return;
    setLocalError('');
    const next = toFormFromInitial(initial);
    setForm(next);
    baselineRef.current = snapshot(next);
  }, [show, initial, snapshot]);

  const dirty = show && snapshot(form) !== baselineRef.current;
  const titleLen = String(form.title || '').length;
  const contentLen = String(form.content || '').length;
  const previewSlug = form.slug.trim() ? form.slug.trim() : baseSlugFromTitle(form.title);
  const showTitleInvalid = localError === '請填寫標題';
  const showContentInvalid = localError === '請填寫內容';

  useEffect(() => {
    if (!show || !dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [show, dirty]);

  const requestHide = () => {
    if (saving) return;
    if (dirty && !window.confirm('內容尚未儲存，確定關閉？')) return;
    onHide();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!String(form.title).trim()) {
      setLocalError('請填寫標題');
      return;
    }
    if (!String(form.content).trim()) {
      setLocalError('請填寫內容');
      return;
    }
    setLocalError('');
    const tags = String(form.tags)
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      content: form.content,
      coverImage: form.coverImage.trim() || null,
      coverImageAlt: form.coverImageAlt.trim() || null,
      slug: form.slug.trim() || undefined,
      category: form.category || 'general',
      tags: tags.length ? tags : null,
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      ogImageUrl: form.ogImageUrl.trim() || null,
      scheduledPublishAt: form.scheduledPublishAt ? new Date(form.scheduledPublishAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      isPublished: !!form.isPublished,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
      isPinned: !!form.isPinned,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
      audienceType: form.audienceType || 'all',
      shouldSendNotification: !!form.shouldSendNotification,
      shouldSendEmail: !!form.shouldSendEmail,
    };
    onSubmit(payload);
  };

  return (
    <Modal show={show} onHide={requestHide} size="lg" backdrop={true} keyboard={true}>
      <Modal.Header closeButton>
        <Modal.Title>{initial ? '編輯公告' : '新增公告'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {localError && <Alert variant="danger">{localError}</Alert>}
        {dirty && <Alert variant="warning" className="py-2 small">您有未儲存的變更</Alert>}
        <Form id="announcement-form" onSubmit={handleSubmit}>
          <Row className="g-2">
            <Col md={8}>
              <Form.Group className="mb-2">
                <Form.Label>標題 *</Form.Label>
                <Form.Control
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={200}
                  isInvalid={showTitleInvalid}
                />
                <Form.Text className="text-muted">{titleLen}/200</Form.Text>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-2">
                <Form.Label>分類</Form.Label>
                <Form.Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="general">一般</option>
                  <option value="activity">活動</option>
                  <option value="policy">政策</option>
                  <option value="system">系統</option>
                  <option value="emergency">緊急</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-2">
            <Form.Label>slug（選填，留空則由標題自動產生）</Form.Label>
            <Form.Control
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="url-safe"
            />
            <Form.Text className="text-muted">
              URL 代稱（可留空由系統自動產生）：<code>{previewSlug || '（由標題產生）'}</code>
            </Form.Text>
            <div className="small text-muted">
              建議使用英文、數字與連字號（`-`）/底線（`_`）。
            </div>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>摘要</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>內容 *（純文字，前台保留換行）</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              isInvalid={showContentInvalid}
            />
            <Form.Text className="text-muted">{contentLen} 字</Form.Text>
          </Form.Group>
          <Row className="g-2">
            <Col md={6}>
              <Form.Group className="mb-2">
                <Form.Label>封面圖 URL</Form.Label>
                <Form.Control
                  value={form.coverImage}
                  onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
                  placeholder="https://..."
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-2">
                <Form.Label>封面替代文字</Form.Label>
                <Form.Control
                  value={form.coverImageAlt}
                  onChange={(e) => setForm((f) => ({ ...f, coverImageAlt: e.target.value }))}
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-2">
            <Form.Label>標籤（逗號分隔）</Form.Label>
            <Form.Control
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="例如：English Table, 期中考"
            />
          </Form.Group>
          <Row className="g-2">
            <Col md={6}>
              <Form.Group className="mb-2">
                <Form.Label>SEO Title</Form.Label>
                <Form.Control value={form.seoTitle} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-2">
                <Form.Label>SEO Description</Form.Label>
                <Form.Control
                  value={form.seoDescription}
                  onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-2">
            <Form.Label>OG 圖片 URL（選填）</Form.Label>
            <Form.Control value={form.ogImageUrl} onChange={(e) => setForm((f) => ({ ...f, ogImageUrl: e.target.value }))} />
          </Form.Group>
          <Row className="g-2">
            <Col md={4}>
              <Form.Group className="mb-2">
                <Form.Label>排程發布</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={form.scheduledPublishAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledPublishAt: e.target.value }))}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-2">
                <Form.Label>到期下架</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-2">
                <Form.Label>排序數字</Form.Label>
                <Form.Control
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Check
            className="mb-2"
            type="checkbox"
            label="立即發布（與排程二擇一時，請清空排程或勿勾此項）"
            checked={form.isPublished}
            onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
          />
          <Form.Group className="mb-2">
            <Form.Label>發布時間（選填）</Form.Label>
            <Form.Control
              type="datetime-local"
              value={form.publishedAt}
              onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
            />
          </Form.Group>
          <Form.Check
            className="mb-2"
            type="checkbox"
            label="置頂"
            checked={form.isPinned}
            onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
          />
          <Form.Group className="mb-2">
            <Form.Label>受眾（預留推播／通知）</Form.Label>
            <Form.Select value={form.audienceType} onChange={(e) => setForm((f) => ({ ...f, audienceType: e.target.value }))}>
              <option value="all">全部</option>
              <option value="students">學生</option>
              <option value="teachers">教師</option>
              <option value="admins">管理者</option>
            </Form.Select>
          </Form.Group>
          <Form.Check
            className="mb-1"
            type="checkbox"
            label="shouldSendNotification（預留）"
            checked={form.shouldSendNotification}
            onChange={(e) => setForm((f) => ({ ...f, shouldSendNotification: e.target.checked }))}
          />
          <Form.Check
            className="mb-2"
            type="checkbox"
            label="shouldSendEmail（預留）"
            checked={form.shouldSendEmail}
            onChange={(e) => setForm((f) => ({ ...f, shouldSendEmail: e.target.checked }))}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={requestHide} disabled={saving}>
          取消
        </Button>
        <Button variant="primary" type="submit" form="announcement-form" disabled={saving}>
          {saving ? '儲存中…' : '儲存'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
