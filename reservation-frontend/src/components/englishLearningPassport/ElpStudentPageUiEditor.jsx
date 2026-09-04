import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Form } from 'react-bootstrap';
import useToast from '../ui/useToast';
import {
  adminFetchElpPageUi,
  adminUpsertElpPageUiText,
  adminDeleteElpPageUiEntry,
} from '../../services/englishLearningPassportApi';
import SiteContentTextPanel, { StatusBadge } from '../../pages/admin/SiteContentTextPanel';
import SiteContentVisualPanel from '../../pages/admin/SiteContentVisualPanel';
import { labelForContentKey, mergeTextCatalog } from '../../utils/siteContentCatalog';
import { previewTypographyClass } from '../../utils/siteContentGroups';
import '../../pages/admin/siteContentAdmin.css';

const SECTION = 'english_learning_passport';

function emptyTextForm() {
  return {
    contentKey: '',
    label: '',
    valueZh: '',
    valueEn: '',
    isActive: true,
  };
}

/**
 * 英語學習護照：學生端頁面文案視覺／列表編輯（掛在後台 ELP 分頁）
 */
export default function ElpStudentPageUiEditor({ token }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState('visual');
  const [textModal, setTextModal] = useState({ show: false, item: null });
  const [form, setForm] = useState(emptyTextForm());

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetchElpPageUi(token);
      setItems(data?.items || []);
    } catch (e) {
      toast.error(e.message || '載入學生頁面文案失敗');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const catalogRows = useMemo(
    () => mergeTextCatalog(SECTION, items),
    [items],
  );

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      await adminUpsertElpPageUiText(token, {
        contentKey: payload.contentKey,
        label: payload.label || labelForContentKey(payload.contentKey),
        valueZh: payload.valueZh,
        valueEn: payload.valueEn,
        isActive: payload.isActive !== false,
      });
      toast.success('文案已儲存');
      setTextModal({ show: false, item: null });
      await load();
    } catch (e) {
      toast.error(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, label) => {
    if (!window.confirm(`確定刪除「${label}」覆寫？刪除後學生端將恢復預設文案。`)) return;
    setSaving(true);
    try {
      await adminDeleteElpPageUiEntry(token, id);
      toast.success('已刪除覆寫');
      await load();
    } catch (e) {
      toast.error(e.message || '刪除失敗');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setForm({
      contentKey: row.contentKey,
      label: row.label || row.displayLabel || labelForContentKey(row.contentKey),
      valueZh: row.valueZh || '',
      valueEn: row.valueEn || '',
      isActive: row.isActive !== false,
      id: row.id,
    });
    setTextModal({ show: true, item: row });
  };

  return (
    <div className="scm-page elp-page-ui-editor">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h2 className="h5 mb-1">學生頁面文案</h2>
          <p className="text-muted small mb-0">
            編輯 <code>/student/english-learning-passport</code> 的標題、指南與申請相關文字。
            共可編 {catalogRows.length} 個欄位；未覆寫者顯示系統預設。
          </p>
        </div>
        <div className="btn-group" role="group" aria-label="編輯模式">
          <button
            type="button"
            className={`btn btn-sm ${mode === 'visual' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setMode('visual')}
          >
            視覺編輯
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setMode('list')}
          >
            進階列表
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <SiteContentVisualPanel
          section={SECTION}
          items={items}
          loading={loading}
          saving={saving}
          onSave={handleSave}
          onSwitchToList={() => setMode('list')}
          mediaToken={token}
        />
      ) : (
        <SiteContentTextPanel
          section={SECTION}
          items={catalogRows}
          loading={loading}
          saving={saving}
          onCreate={() => {
            setForm(emptyTextForm());
            setTextModal({ show: true, item: null });
          }}
          onEdit={openEdit}
          onDelete={handleDelete}
          onSwitchToVisual={() => setMode('visual')}
        />
      )}

      <Modal show={textModal.show} onHide={() => !saving && setTextModal({ show: false, item: null })} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{textModal.item ? '編輯文案' : '新增文案覆寫'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form
            id="elp-page-ui-text-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave(form);
            }}
          >
            <Form.Group className="mb-3">
              <Form.Label>內容鍵</Form.Label>
              <Form.Control
                value={form.contentKey}
                disabled={!!textModal.item}
                onChange={(e) => setForm((f) => ({ ...f, contentKey: e.target.value.trim() }))}
                placeholder="例：elpPage.heroTitle"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>標籤</Form.Label>
              <Form.Control
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>中文</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                className={previewTypographyClass(form.contentKey)}
                value={form.valueZh}
                onChange={(e) => setForm((f) => ({ ...f, valueZh: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>English</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.valueEn}
                onChange={(e) => setForm((f) => ({ ...f, valueEn: e.target.value }))}
              />
            </Form.Group>
            <Form.Check
              type="switch"
              label="啟用"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            {textModal.item?.id ? (
              <p className="small text-muted mt-2 mb-0">
                狀態 <StatusBadge isActive={form.isActive} />
              </p>
            ) : null}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={saving}
            onClick={() => setTextModal({ show: false, item: null })}
          >
            取消
          </button>
          <button
            type="submit"
            form="elp-page-ui-text-form"
            className="btn btn-primary"
            disabled={saving || !form.contentKey}
          >
            {saving ? '儲存中…' : '儲存'}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
