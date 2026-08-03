import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, Modal } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';

import useToast from '../../components/ui/useToast';
import { getTranslation, LANG_EN, LANG_ZH } from '../../constants/translations';
import {
  SITE_CONTENT_KEY_SUGGESTIONS,
  SITE_CONTENT_SECTIONS,
  STRUCTURED_SECTIONS,
} from '../../constants/siteContentManifest';
import {
  createSiteContentFaq,
  createSiteContentStaff,
  deleteSiteContentEntry,
  fetchSiteContentSection,
  reorderSiteContentFaq,
  reorderSiteContentStaff,
  updateSiteContentFaq,
  updateSiteContentStaff,
  upsertSiteContentText,
} from '../../services/siteContentAdminApi';
import SiteContentTextPanel, { StatusBadge } from './SiteContentTextPanel';
import SiteContentVisualPanel from './SiteContentVisualPanel';
import { VISUAL_TEXT_SECTIONS } from './siteContentVisualConfig';
import { previewTypographyClass } from '../../utils/siteContentGroups';
import './siteContentAdmin.css';

const TEXT_SECTIONS = SITE_CONTENT_SECTIONS.filter((s) => !STRUCTURED_SECTIONS.includes(s.id));
const STAFF_SECTIONS = ['staff_faculty', 'staff_admin'];

const SECTION_LEADS = {
  home: '直接點擊首頁畫面上的文字即可編輯 Hero、公告、FAQ 等區塊。',
  activities: '在活動介紹頁預覽中點擊文字，即可修改各類型說明與導言。',
  about: '在關於我們頁面預覽中點擊介紹段落即可編輯。',
  contact: '在聯絡我們頁面預覽中點擊標籤與內容即可編輯。',
  legal: '切換隱私權／使用條款後，點擊段落文字即可編輯。',
  faq: '學生端常見問題列表，可排序與雙語編輯。',
  rules_modal: '在彈窗預覽中點擊文字，可編輯取消預約、黑名單與活動規定內容。',
  staff_faculty: '關於我們頁面的師資卡片。',
  staff_admin: '關於我們頁面的行政團隊卡片。',
};

function emptyTextForm() {
  return {
    contentKey: '',
    label: '',
    valueZh: '',
    valueEn: '',
    isActive: true,
  };
}

function emptyFaqForm() {
  return {
    label: '',
    questionZh: '',
    questionEn: '',
    answerZh: '',
    answerEn: '',
    isActive: true,
  };
}

function emptyStaffForm() {
  return {
    slug: '',
    label: '',
    nameZh: '',
    nameEn: '',
    roleZh: '',
    roleEn: '',
    email: '',
    extension: '',
    isActive: true,
  };
}

function TextPreviewPanel({ form, initial, previewLang, onPreviewLangChange }) {
  const text = previewLang === 'zh' ? form.valueZh : form.valueEn;
  const beforeText = previewLang === 'zh' ? initial?.valueZh : initial?.valueEn;
  const changed = Boolean(text && beforeText && text !== beforeText);
  const typography = previewTypographyClass(form.contentKey);

  return (
    <div className="scm-preview">
      <div className="scm-preview__toolbar">
        <span className="scm-preview__toolbar-label">學生端預覽</span>
        <div className="scm-preview__lang" role="group" aria-label="預覽語言">
          <button
            type="button"
            className={`scm-preview__lang-btn${previewLang === 'zh' ? ' is-active' : ''}`}
            onClick={() => onPreviewLangChange('zh')}
          >
            中文
          </button>
          <button
            type="button"
            className={`scm-preview__lang-btn${previewLang === 'en' ? ' is-active' : ''}`}
            onClick={() => onPreviewLangChange('en')}
          >
            EN
          </button>
        </div>
      </div>

      {!form.isActive ? (
        <p className="scm-preview__warn">已停用：學生端不會套用此覆寫，仍顯示程式預設或隱藏。</p>
      ) : null}

      <div className="scm-preview__frame">
        <p className="scm-preview__context">{form.label || form.contentKey || '文案預覽'}</p>
        <div className={`scm-preview__content ${typography}`}>
          {text || '（尚未輸入內容）'}
        </div>
      </div>

      {changed ? (
        <div className="scm-preview__diff">
          <p className="scm-preview__diff-label">修改前</p>
          <p className="scm-preview__diff-old">{beforeText}</p>
        </div>
      ) : null}
    </div>
  );
}

function TextEditorModal({ show, onHide, section, initial, saving, onSubmit }) {
  const [form, setForm] = useState(emptyTextForm());
  const [previewLang, setPreviewLang] = useState('zh');
  const suggestions = SITE_CONTENT_KEY_SUGGESTIONS[section] || [];

  useEffect(() => {
    if (!show) return;
    setForm(
      initial
        ? {
            contentKey: initial.contentKey || '',
            label: initial.label || '',
            valueZh: initial.valueZh || '',
            valueEn: initial.valueEn || '',
            isActive: initial.isActive !== false,
          }
        : emptyTextForm()
    );
  }, [show, initial]);

  const applySuggestion = (key) => {
    const meta = suggestions.find((s) => s.key === key);
    if (!meta) return;
    setForm((f) => ({
      ...f,
      contentKey: meta.key,
      label: meta.label || meta.key,
      valueZh: f.valueZh || getTranslation(LANG_ZH, meta.key),
      valueEn: f.valueEn || getTranslation(LANG_EN, meta.key),
    }));
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      backdrop={saving ? 'static' : true}
      className="scm-modal scm-modal--editor"
    >
      <Modal.Header closeButton={!saving}>
        <Modal.Title>{initial?.id ? '編輯文案' : '新增文案'}</Modal.Title>
      </Modal.Header>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        <Modal.Body>
          <div className="scm-editor-layout">
            <div className="scm-editor-layout__form">
          {suggestions.length > 0 ? (
            <Form.Group className="mb-3">
              <Form.Label>快速選擇欄位</Form.Label>
              <Form.Select
                value=""
                onChange={(e) => e.target.value && applySuggestion(e.target.value)}
              >
                <option value="">選擇常用欄位（選填）</option>
                {suggestions.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </Form.Select>
              <Form.Text>選擇後會帶入翻譯鍵與預設內容，仍可手動修改。</Form.Text>
            </Form.Group>
          ) : null}
          <Form.Group className="mb-3">
            <Form.Label>翻譯鍵</Form.Label>
            <Form.Control
              value={form.contentKey}
              onChange={(e) => setForm((f) => ({ ...f, contentKey: e.target.value }))}
              placeholder="homePage.heroTitle"
              required
              disabled={!!initial?.id}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>管理用標籤</Form.Label>
            <Form.Control
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="方便後台辨識的欄位名稱"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>中文內容</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={form.valueZh}
              onChange={(e) => setForm((f) => ({ ...f, valueZh: e.target.value }))}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>English</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={form.valueEn}
              onChange={(e) => setForm((f) => ({ ...f, valueEn: e.target.value }))}
            />
          </Form.Group>
          <Form.Check
            type="switch"
            label="啟用（停用後學生端不再顯示此覆寫）"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
            </div>
            <TextPreviewPanel
              form={form}
              initial={initial}
              previewLang={previewLang}
              onPreviewLangChange={setPreviewLang}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="scm-btn-ghost" onClick={onHide} disabled={saving}>
            取消
          </button>
          <button type="submit" className="scm-btn-primary" disabled={saving}>
            {saving ? '儲存中…' : '儲存'}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function FaqPreviewPanel({ form, initial, previewLang, onPreviewLangChange }) {
  const question = previewLang === 'zh' ? form.questionZh : form.questionEn;
  const answer = previewLang === 'zh' ? form.answerZh : form.answerEn;
  const beforeQ = previewLang === 'zh' ? initial?.question?.zh : initial?.question?.en;
  const beforeA = previewLang === 'zh' ? initial?.answer?.zh : initial?.answer?.en;

  return (
    <div className="scm-preview">
      <div className="scm-preview__toolbar">
        <span className="scm-preview__toolbar-label">學生端預覽</span>
        <div className="scm-preview__lang" role="group" aria-label="預覽語言">
          <button
            type="button"
            className={`scm-preview__lang-btn${previewLang === 'zh' ? ' is-active' : ''}`}
            onClick={() => onPreviewLangChange('zh')}
          >
            中文
          </button>
          <button
            type="button"
            className={`scm-preview__lang-btn${previewLang === 'en' ? ' is-active' : ''}`}
            onClick={() => onPreviewLangChange('en')}
          >
            EN
          </button>
        </div>
      </div>
      {!form.isActive ? (
        <p className="scm-preview__warn">已停用：此 FAQ 不會顯示於學生端。</p>
      ) : null}
      <div className="scm-preview__frame scm-preview__frame--faq">
        <p className="scm-preview__heading">{question || '（問題）'}</p>
        <p className="scm-preview__body">{answer || '（答案）'}</p>
      </div>
      {(beforeQ && question !== beforeQ) || (beforeA && answer !== beforeA) ? (
        <div className="scm-preview__diff">
          <p className="scm-preview__diff-label">修改前</p>
          {beforeQ ? <p className="scm-preview__diff-old"><strong>Q：</strong>{beforeQ}</p> : null}
          {beforeA ? <p className="scm-preview__diff-old"><strong>A：</strong>{beforeA}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function FaqEditorModal({ show, onHide, initial, onSubmit }) {
  const [form, setForm] = useState(emptyFaqForm());
  const [previewLang, setPreviewLang] = useState('zh');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!show) {
      setSubmitting(false);
      return;
    }
    setForm(
      initial
        ? {
            label: initial.label || '',
            questionZh: initial.question?.zh || '',
            questionEn: initial.question?.en || '',
            answerZh: initial.answer?.zh || '',
            answerEn: initial.answer?.en || '',
            isActive: initial.isActive !== false,
          }
        : emptyFaqForm()
    );
  }, [show, initial]);

  const handleClose = () => {
    if (submitting) return;
    onHide();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch {
      // 儲存失敗時保持視窗開啟，錯誤訊息由父層 toast 顯示
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="xl"
      backdrop={submitting ? 'static' : true}
      keyboard={!submitting}
      className="scm-modal scm-modal--editor"
    >
      <Modal.Header closeButton={!submitting}>
        <Modal.Title>{initial?.id ? '編輯 FAQ' : '新增 FAQ'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="scm-editor-layout">
            <div className="scm-editor-layout__form">
          <Form.Group className="mb-3">
            <Form.Label>管理用標籤</Form.Label>
            <Form.Control
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>問題（中文）</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.questionZh}
              onChange={(e) => setForm((f) => ({ ...f, questionZh: e.target.value }))}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Question (English)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.questionEn}
              onChange={(e) => setForm((f) => ({ ...f, questionEn: e.target.value }))}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>答案（中文）</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={form.answerZh}
              onChange={(e) => setForm((f) => ({ ...f, answerZh: e.target.value }))}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Answer (English)</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={form.answerEn}
              onChange={(e) => setForm((f) => ({ ...f, answerEn: e.target.value }))}
            />
          </Form.Group>
          <Form.Check
            type="switch"
            label="啟用"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
            </div>
            <FaqPreviewPanel
              form={form}
              initial={initial}
              previewLang={previewLang}
              onPreviewLangChange={setPreviewLang}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="scm-btn-ghost" onClick={handleClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" className="scm-btn-primary" disabled={submitting}>
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function StaffEditorModal({ show, onHide, initial, saving, onSubmit }) {
  const [form, setForm] = useState(emptyStaffForm());

  useEffect(() => {
    if (!show) return;
    setForm(
      initial
        ? {
            slug: initial.slug || '',
            label: initial.label || '',
            nameZh: initial.name?.zh || '',
            nameEn: initial.name?.en || '',
            roleZh: initial.role?.zh || '',
            roleEn: initial.role?.en || '',
            email: initial.email || '',
            extension: initial.extension || '',
            isActive: initial.isActive !== false,
          }
        : emptyStaffForm()
    );
  }, [show, initial]);

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop={saving ? 'static' : true} className="scm-modal">
      <Modal.Header closeButton={!saving}>
        <Modal.Title>{initial ? '編輯成員' : '新增成員'}</Modal.Title>
      </Modal.Header>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>slug</Form.Label>
            <Form.Control
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="huang-shuping"
              required={!initial}
              disabled={!!initial}
            />
            <Form.Text>英文小寫與連字號，建立後不可修改。</Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>管理用標籤</Form.Label>
            <Form.Control
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>姓名（中文）</Form.Label>
            <Form.Control
              value={form.nameZh}
              onChange={(e) => setForm((f) => ({ ...f, nameZh: e.target.value }))}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Name (English)</Form.Label>
            <Form.Control
              value={form.nameEn}
              onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>職稱（中文）</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.roleZh}
              onChange={(e) => setForm((f) => ({ ...f, roleZh: e.target.value }))}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Role (English)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.roleEn}
              onChange={(e) => setForm((f) => ({ ...f, roleEn: e.target.value }))}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>分機</Form.Label>
            <Form.Control
              value={form.extension}
              onChange={(e) => setForm((f) => ({ ...f, extension: e.target.value }))}
              placeholder="5808 / 3170"
            />
          </Form.Group>
          <Form.Check
            type="switch"
            label="啟用"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="scm-btn-ghost" onClick={onHide} disabled={saving}>
            取消
          </button>
          <button type="submit" className="scm-btn-primary" disabled={saving}>
            {saving ? '儲存中…' : '儲存'}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function FaqListPanel({
  items,
  loading,
  saving,
  onCreate,
  onEdit,
  onDelete,
  onMove,
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => (item.question?.zh || item.label || '').toLowerCase().includes(q)
        || (item.answer?.zh || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="scm-panel">
      <div className="scm-toolbar">
        <p className="scm-toolbar__meta mb-0">共 {items.length} 則 FAQ</p>
        <div className="scm-toolbar__search">
          <input
            type="search"
            className="form-control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋問題或答案"
            aria-label="搜尋 FAQ"
          />
        </div>
        <button type="button" className="scm-btn-primary" disabled={saving} onClick={onCreate}>
          新增 FAQ
        </button>
      </div>

      {loading ? (
        <div className="scm-loading">載入中…</div>
      ) : filtered.length === 0 ? (
        <div className="scm-empty">
          <p className="scm-empty__title">{items.length === 0 ? '尚無 FAQ' : '沒有符合條件的 FAQ'}</p>
          <p className="scm-empty__text">
            {items.length === 0 ? '建立第一則常見問題，學生端即可顯示。' : '調整搜尋條件後再試。'}
          </p>
          {items.length === 0 ? (
            <button type="button" className="scm-btn-primary" disabled={saving} onClick={onCreate}>
              新增 FAQ
            </button>
          ) : null}
        </div>
      ) : (
        <div className="scm-table-wrap">
          <table className="scm-table">
            <thead>
              <tr>
                <th style={{ width: '5.5rem' }}>排序</th>
                <th>問題</th>
                <th>答案預覽</th>
                <th>狀態</th>
                <th style={{ width: '9rem' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const index = items.findIndex((f) => f.id === item.id);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          className="scm-btn-ghost scm-btn-icon"
                          disabled={saving || index === 0}
                          onClick={() => onMove(index, -1)}
                          aria-label="上移"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="scm-btn-ghost scm-btn-icon"
                          disabled={saving || index === items.length - 1}
                          onClick={() => onMove(index, 1)}
                          aria-label="下移"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="scm-table__primary">{item.question?.zh || item.label}</div>
                      {item.question?.en ? (
                        <div className="scm-table__secondary">{item.question.en}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="scm-table__preview" title={item.answer?.zh || ''}>
                        {item.answer?.zh || '—'}
                      </div>
                    </td>
                    <td><StatusBadge isActive={item.isActive !== false} /></td>
                    <td>
                      <div className="scm-actions">
                        <button type="button" className="scm-btn-ghost" disabled={saving} onClick={() => onEdit(item)}>
                          編輯
                        </button>
                        <button
                          type="button"
                          className="scm-btn-danger-ghost"
                          disabled={saving}
                          onClick={() => onDelete(item.id, item.question?.zh || item.label)}
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StaffListPanel({
  items,
  loading,
  saving,
  onCreate,
  onEdit,
  onDelete,
  onMove,
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => (item.name?.zh || item.label || '').toLowerCase().includes(q)
        || (item.role?.zh || '').toLowerCase().includes(q)
        || (item.email || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="scm-panel">
      <div className="scm-toolbar">
        <p className="scm-toolbar__meta mb-0">共 {items.length} 位成員</p>
        <div className="scm-toolbar__search">
          <input
            type="search"
            className="form-control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋姓名、職稱或 Email"
            aria-label="搜尋成員"
          />
        </div>
        <button type="button" className="scm-btn-primary" disabled={saving} onClick={onCreate}>
          新增成員
        </button>
      </div>

      {loading ? (
        <div className="scm-loading">載入中…</div>
      ) : filtered.length === 0 ? (
        <div className="scm-empty">
          <p className="scm-empty__title">{items.length === 0 ? '尚無成員' : '沒有符合條件的成員'}</p>
          <p className="scm-empty__text">
            {items.length === 0 ? '新增第一位成員以顯示於關於我們頁面。' : '調整搜尋條件後再試。'}
          </p>
          {items.length === 0 ? (
            <button type="button" className="scm-btn-primary" disabled={saving} onClick={onCreate}>
              新增成員
            </button>
          ) : null}
        </div>
      ) : (
        <div className="scm-table-wrap">
          <table className="scm-table">
            <thead>
              <tr>
                <th style={{ width: '5.5rem' }}>排序</th>
                <th>姓名</th>
                <th>職稱</th>
                <th>Email</th>
                <th>狀態</th>
                <th style={{ width: '9rem' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const index = items.findIndex((s) => s.id === item.id);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          className="scm-btn-ghost scm-btn-icon"
                          disabled={saving || index === 0}
                          onClick={() => onMove(index, -1)}
                          aria-label="上移"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="scm-btn-ghost scm-btn-icon"
                          disabled={saving || index === items.length - 1}
                          onClick={() => onMove(index, 1)}
                          aria-label="下移"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="scm-table__primary">{item.name?.zh || item.label}</div>
                      {item.name?.en ? (
                        <div className="scm-table__secondary">{item.name.en}</div>
                      ) : null}
                    </td>
                    <td className="scm-table__secondary">{item.role?.zh || '—'}</td>
                    <td className="scm-table__secondary">{item.email || '—'}</td>
                    <td><StatusBadge isActive={item.isActive !== false} /></td>
                    <td>
                      <div className="scm-actions">
                        <button type="button" className="scm-btn-ghost" disabled={saving} onClick={() => onEdit(item)}>
                          編輯
                        </button>
                        <button
                          type="button"
                          className="scm-btn-danger-ghost"
                          disabled={saving}
                          onClick={() => onDelete(item.id, item.name?.zh || item.label)}
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SiteContentManagementPage() {
  const { token } = useOutletContext();
  const toast = useToast();
  const [activeSection, setActiveSection] = useState(TEXT_SECTIONS[0]?.id || 'home');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sectionData, setSectionData] = useState(null);
  const [textModal, setTextModal] = useState({ show: false, item: null });
  const [faqModal, setFaqModal] = useState({ show: false, item: null });
  const [staffModal, setStaffModal] = useState({ show: false, item: null });
  const [textEditMode, setTextEditMode] = useState('visual');

  const loadSection = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSiteContentSection(token, activeSection);
      setSectionData(data);
    } catch (err) {
      setError(err.message || '載入失敗');
      setSectionData(null);
    } finally {
      setLoading(false);
    }
  }, [token, activeSection]);

  useEffect(() => {
    loadSection();
  }, [loadSection]);

  useEffect(() => {
    if (VISUAL_TEXT_SECTIONS.includes(activeSection)) {
      setTextEditMode('visual');
    }
    setTextModal({ show: false, item: null });
    setFaqModal({ show: false, item: null });
    setStaffModal({ show: false, item: null });
  }, [activeSection]);

  const textItems = useMemo(() => sectionData?.items || [], [sectionData]);
  const faqItems = useMemo(() => sectionData?.faq || [], [sectionData]);
  const staffItems = useMemo(() => sectionData?.staff || [], [sectionData]);
  const isStaffSection = STAFF_SECTIONS.includes(activeSection);

  const activeSectionMeta = useMemo(
    () => SITE_CONTENT_SECTIONS.find((s) => s.id === activeSection),
    [activeSection]
  );

  const handleSaveText = async (form) => {
    setSaving(true);
    try {
      await upsertSiteContentText(token, activeSection, form);
      toast.success('文案已儲存');
      if (textModal.show) {
        setTextModal({ show: false, item: null });
      }
      await loadSection();
    } catch (err) {
      toast.error(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFaq = async (form) => {
    if (faqModal.item?.id) {
      await updateSiteContentFaq(token, faqModal.item.id, form);
    } else {
      await createSiteContentFaq(token, form);
    }
    toast.success('FAQ 已儲存');
    setFaqModal({ show: false, item: null });
    await loadSection();
  };

  const handleSaveStaff = async (form) => {
    setSaving(true);
    try {
      if (staffModal.item?.id) {
        await updateSiteContentStaff(token, staffModal.item.id, form);
      } else {
        await createSiteContentStaff(token, activeSection, form);
      }
      toast.success('成員已儲存');
      setStaffModal({ show: false, item: null });
      await loadSection();
    } catch (err) {
      toast.error(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, label) => {
    if (!window.confirm(`確定刪除「${label}」？刪除後學生端將不再顯示此筆資料。`)) return;
    setSaving(true);
    try {
      await deleteSiteContentEntry(token, id);
      toast.success('已刪除');
      await loadSection();
    } catch (err) {
      toast.error(err.message || '刪除失敗');
    } finally {
      setSaving(false);
    }
  };

  const moveFaq = async (index, direction) => {
    const next = [...faqItems];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    setSaving(true);
    try {
      await reorderSiteContentFaq(token, next.map((f) => f.id));
      await loadSection();
    } catch (err) {
      toast.error(err.message || '排序失敗');
    } finally {
      setSaving(false);
    }
  };

  const moveStaff = async (index, direction) => {
    const next = [...staffItems];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    setSaving(true);
    try {
      await reorderSiteContentStaff(token, activeSection, next.map((s) => s.id));
      await loadSection();
    } catch (err) {
      toast.error(err.message || '排序失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scm-page admin-page">
      <header className="scm-page__header">
        <p className="scm-page__kicker">Site content</p>
        <h1 className="scm-page__title">網站文案管理</h1>
        <p className="scm-page__lead">
          直接在學生端畫面上點擊文字即可修改；儲存後即時生效。FAQ 與師資名單仍使用列表編輯。
        </p>
      </header>

      {error ? <div className="scm-alert" role="alert">{error}</div> : null}

      <nav className="scm-tabs" role="tablist" aria-label="文案區塊">
        {SITE_CONTENT_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={activeSection === s.id}
            className={`scm-tabs__item${activeSection === s.id ? ' is-active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {activeSectionMeta ? (
        <p className="scm-page__lead mb-3">
          {SECTION_LEADS[activeSection] || ''}
        </p>
      ) : null}

      {activeSection === 'faq' ? (
        <FaqListPanel
          items={faqItems}
          loading={loading}
          saving={saving}
          onCreate={() => setFaqModal({ show: true, item: null })}
          onEdit={(item) => setFaqModal({ show: true, item })}
          onDelete={handleDelete}
          onMove={moveFaq}
        />
      ) : isStaffSection ? (
        <StaffListPanel
          items={staffItems}
          loading={loading}
          saving={saving}
          onCreate={() => setStaffModal({ show: true, item: null })}
          onEdit={(item) => setStaffModal({ show: true, item })}
          onDelete={handleDelete}
          onMove={moveStaff}
        />
      ) : VISUAL_TEXT_SECTIONS.includes(activeSection) && textEditMode === 'visual' ? (
        <SiteContentVisualPanel
          section={activeSection}
          items={textItems}
          loading={loading}
          saving={saving}
          onSave={handleSaveText}
          onSwitchToList={() => setTextEditMode('list')}
        />
      ) : (
        <SiteContentTextPanel
          section={activeSection}
          items={textItems}
          loading={loading}
          saving={saving}
          onCreate={() => setTextModal({ show: true, item: null })}
          onEdit={(row) => setTextModal({ show: true, item: row })}
          onDelete={handleDelete}
          onSwitchToVisual={
            VISUAL_TEXT_SECTIONS.includes(activeSection)
              ? () => setTextEditMode('visual')
              : undefined
          }
        />
      )}

      <TextEditorModal
        show={textModal.show}
        initial={textModal.item}
        section={activeSection}
        saving={saving}
        onHide={() => !saving && setTextModal({ show: false, item: null })}
        onSubmit={handleSaveText}
      />

      <FaqEditorModal
        show={faqModal.show}
        initial={faqModal.item}
        onHide={() => setFaqModal({ show: false, item: null })}
        onSubmit={async (form) => {
          try {
            await handleSaveFaq(form);
          } catch (err) {
            toast.error(err.message || '儲存失敗');
            throw err;
          }
        }}
      />

      <StaffEditorModal
        show={staffModal.show}
        initial={staffModal.item}
        saving={saving}
        onHide={() => !saving && setStaffModal({ show: false, item: null })}
        onSubmit={handleSaveStaff}
      />
    </div>
  );
}
