import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Alert, Button, Form, Modal, Table } from 'react-bootstrap';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  createAdminWeeklyReport,
  deleteAdminWeeklyReport,
  duplicateAdminWeeklyReport,
  fetchAdminWeeklyReports,
} from '../../services/weeklyReportAdminApi';
import { defaultBlocksTemplate } from '../../constants/weeklyBlocks';
import useConfirm from '../../components/ui/useConfirm';

const EMPTY_FORM = {
  issueKey: '',
  slug: '',
  title: '',
  headline: '',
  status: 'draft',
  weekStart: '',
  weekEnd: '',
};

export default function AdminWeeklyReportPage() {
  const { token } = useOutletContext();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminWeeklyReports(token, { limit: 50 });
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      const blocks = defaultBlocksTemplate({
        title: form.title || form.issueKey,
        headline: form.headline,
      });
      const created = await createAdminWeeklyReport(token, {
        ...form,
        title: form.title || form.issueKey,
        blocks,
        blocksVersion: 1,
      });
      setShowForm(false);
      setToast('已建立週報，正在開啟編輯器…');
      navigate(`/admin/weekly-reports/${created.id}/edit`);
    } catch (err) {
      setError(err.message || '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row) => {
    const ok = await confirm({
      title: '刪除週報',
      description: `確定要刪除「${row.title}」嗎？此操作無法復原。`,
      confirmLabel: '刪除',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteAdminWeeklyReport(token, row.id);
      setToast('已刪除');
      await load();
    } catch (err) {
      setError(err.message || '刪除失敗');
    }
  };

  const onDuplicate = async (row) => {
    try {
      const created = await duplicateAdminWeeklyReport(token, row.id, {
        issueKey: `${row.issueKey}-copy`,
        slug: `${row.slug}-copy`,
        title: `${row.title}（複製）`,
      });
      setToast('已複製週報');
      navigate(`/admin/weekly-reports/${created.id}/edit`);
    } catch (err) {
      setError(err.message || '複製失敗');
    }
  };

  const statusBadge = (row) => {
    if (row.status === 'published' && row.publishedAt && new Date(row.publishedAt) > new Date()) {
      return { label: '排程中', variant: 'warning' };
    }
    if (row.status === 'published') return { label: '已發布', variant: 'success' };
    return { label: '草稿', variant: 'neutral' };
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h2 className="mb-1">英語中心週報</h2>
          <p className="text-muted small mb-0">
            管理首頁彈窗與 <code>/weekly</code> 公開頁。建立後請使用區塊編輯器排版內容、上傳媒體與設定語彙挑戰。
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>新增週報</Button>
      </div>

      {toast ? (
        <Alert variant="success" onClose={() => setToast('')} dismissible>
          {toast}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="text-muted">載入中…</p>
      ) : (
        <Table responsive hover size="sm" className="align-middle">
          <thead>
            <tr>
              <th>期數</th>
              <th>標題</th>
              <th>週次</th>
              <th>狀態</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted text-center py-4">尚無週報</td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td><code>{row.issueKey}</code></td>
                  <td>{row.title}</td>
                  <td className="small text-muted">{row.weekStart} – {row.weekEnd}</td>
                  <td>
                    {(() => {
                      const s = statusBadge(row);
                      return (
                        <StatusBadge variant={s.variant} size="sm">{s.label}</StatusBadge>
                      );
                    })()}
                  </td>
                  <td className="text-end text-nowrap">
                    <Button
                      as={Link}
                      to={`/admin/weekly-reports/${row.id}/edit`}
                      size="sm"
                      variant="outline-primary"
                      className="me-1"
                    >
                      編輯
                    </Button>
                    <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => onDuplicate(row)}>
                      複製
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => onDelete(row)}>
                      刪除
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}

      <Modal show={showForm} onHide={() => setShowForm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>新增週報</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <div className="row g-2">
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>期數代碼 issueKey</Form.Label>
                  <Form.Control
                    value={form.issueKey}
                    onChange={(e) => setForm((f) => ({ ...f, issueKey: e.target.value }))}
                    placeholder="2026-W26"
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>slug</Form.Label>
                  <Form.Control
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="2026-w26"
                  />
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-2">
              <Form.Label>標題</Form.Label>
              <Form.Control value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>首頁摘要 headline（可於編輯器調整）</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.headline}
                onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
              />
            </Form.Group>
            <div className="row g-2">
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>weekStart</Form.Label>
                  <Form.Control
                    type="date"
                    value={form.weekStart}
                    onChange={(e) => setForm((f) => ({ ...f, weekStart: e.target.value }))}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>weekEnd</Form.Label>
                  <Form.Control
                    type="date"
                    value={form.weekEnd}
                    onChange={(e) => setForm((f) => ({ ...f, weekEnd: e.target.value }))}
                  />
                </Form.Group>
              </div>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? '建立中…' : '建立並編輯'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
