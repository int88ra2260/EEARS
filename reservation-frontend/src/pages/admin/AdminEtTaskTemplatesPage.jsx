import React, { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import { useOutletContext } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { hasPermission } from '../../utils/accessControl';
import { fetchEtTaskTemplate, saveEtTaskTemplate } from '../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../utils/errorHandler';

const BAND_SCOPE_OPTIONS = [
  { value: 'ALL', label: '全部帶別' },
  { value: 'ET-A2', label: 'A2 帶' },
  { value: 'B1_PLUS', label: 'B1+ 帶' },
  { value: 'B2_PLUS', label: 'B2+ 帶' },
];

const EMPTY_ITEM = {
  code: '',
  label: '',
  description: '',
  bandScope: 'ALL',
  sortOrder: 0,
  isRequired: false,
  isActive: true,
};

export default function AdminEtTaskTemplatesPage() {
  const { token, accessProfile } = useOutletContext();
  const canManage = hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState(null);
  const [items, setItems] = useState([]);

  const loadTemplate = useCallback(async () => {
    if (!token || !canManage) return;
    setLoading(true);
    try {
      const data = await fetchEtTaskTemplate(token);
      setTemplate(data.template);
      setItems(data.items?.length ? data.items : [{ ...EMPTY_ITEM }]);
    } catch (e) {
      showErrorMessage(e.message || '載入任務模板失敗');
      setItems([{ ...EMPTY_ITEM }]);
    } finally {
      setLoading(false);
    }
  }, [token, canManage]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const updateItem = (index, key, value) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM, sortOrder: (prev.length + 1) * 10 }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = items
        .filter((row) => String(row.code || '').trim() && String(row.label || '').trim())
        .map((row, index) => ({
          code: row.code.trim(),
          label: row.label.trim(),
          description: row.description || '',
          bandScope: row.bandScope || 'ALL',
          sortOrder: Number(row.sortOrder) || (index + 1) * 10,
          isRequired: Boolean(row.isRequired),
          isActive: row.isActive !== false,
        }));
      const data = await saveEtTaskTemplate(token, payload);
      setTemplate(data.template);
      setItems(data.items || []);
      showSuccessMessage('任務模板已儲存');
    } catch (e) {
      showErrorMessage(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return <Alert variant="warning">您沒有 ET 任務模板管理權限。</Alert>;
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 py-4">
        <Spinner animation="border" size="sm" />
        <span>載入任務模板…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <p className="text-muted mb-0 small">
            {template?.name || '預設模板'} — Leader 場後勾選時依能力帶別顯示適用任務。
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={loadTemplate} disabled={saving}>重新載入</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中…' : '儲存模板'}
          </Button>
        </div>
      </div>

      <div className="table-responsive">
        <Table bordered size="sm" className="align-middle">
          <thead>
            <tr>
              <th>代碼</th>
              <th>任務描述</th>
              <th>說明</th>
              <th>適用帶別</th>
              <th>排序</th>
              <th>必選</th>
              <th>啟用</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.id || 'new'}-${index}`}>
                <td>
                  <Form.Control
                    size="sm"
                    value={item.code || ''}
                    onChange={(e) => updateItem(index, 'code', e.target.value)}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    value={item.label || ''}
                    onChange={(e) => updateItem(index, 'label', e.target.value)}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    value={item.description || ''}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                </td>
                <td>
                  <Form.Select
                    size="sm"
                    value={item.bandScope || 'ALL'}
                    onChange={(e) => updateItem(index, 'bandScope', e.target.value)}
                  >
                    {BAND_SCOPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Form.Select>
                </td>
                <td style={{ width: 90 }}>
                  <Form.Control
                    size="sm"
                    type="number"
                    value={item.sortOrder ?? 0}
                    onChange={(e) => updateItem(index, 'sortOrder', e.target.value)}
                  />
                </td>
                <td className="text-center">
                  <Form.Check
                    type="checkbox"
                    checked={Boolean(item.isRequired)}
                    onChange={(e) => updateItem(index, 'isRequired', e.target.checked)}
                  />
                </td>
                <td className="text-center">
                  <Form.Check
                    type="checkbox"
                    checked={item.isActive !== false}
                    onChange={(e) => updateItem(index, 'isActive', e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Button variant="outline-primary" size="sm" onClick={addItem}>新增任務項</Button>
    </div>
  );
}
