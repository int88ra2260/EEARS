import React, { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { updateLearningAnalyticsFilterReferences } from '../../services/learningAnalyticsService';

function emptyRow() {
  return { value: '', label: '', sortOrder: 0 };
}

export default function FilterReferenceEditor({
  token,
  refType,
  label,
  items = [],
  hint,
  onSaved,
}) {
  const [rows, setRows] = useState(() => (items.length ? items.map((row) => ({
    value: row.value || '',
    label: row.label || '',
    sortOrder: row.sortOrder ?? 0,
  })) : [emptyRow()]));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(items.length ? items.map((row) => ({
      value: row.value || '',
      label: row.label || '',
      sortOrder: row.sortOrder ?? 0,
    })) : [emptyRow()]);
  }, [items]);

  const patchRow = (index, partial) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...partial } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (index) => {
    setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
  };

  const handleSave = async () => {
    if (!token || saving) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = rows
        .map((row, index) => ({
          value: String(row.value || '').trim(),
          label: String(row.label || '').trim() || null,
          sortOrder: index,
        }))
        .filter((row) => row.value);
      const data = await updateLearningAnalyticsFilterReferences(token, refType, payload);
      setMessage(`${label}清單已更新。`);
      onSaved?.(data?.filterReferences);
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="la-outlook-card mb-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div className="fw-semibold">{label}</div>
          {hint ? <p className="small text-muted mb-0">{hint}</p> : null}
        </div>
        <Button size="sm" variant="outline-dark" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size="sm" animation="border" /> : '儲存清單'}
        </Button>
      </div>

      {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
      {message ? <Alert variant="success" className="py-2 small">{message}</Alert> : null}

      {rows.map((row, index) => (
        <div key={`${refType}-${index}`} className="d-flex flex-wrap gap-2 mb-2 align-items-center">
          <Form.Control
            size="sm"
            placeholder="代碼或名稱"
            value={row.value}
            onChange={(e) => patchRow(index, { value: e.target.value })}
            style={{ maxWidth: '10rem' }}
          />
          <Form.Control
            size="sm"
            placeholder="顯示名稱（選填）"
            value={row.label}
            onChange={(e) => patchRow(index, { label: e.target.value })}
            className="flex-grow-1"
          />
          <Button size="sm" variant="outline-secondary" onClick={() => removeRow(index)}>移除</Button>
        </div>
      ))}
      <Button size="sm" variant="link" className="px-0" onClick={addRow}>+ 新增一筆</Button>
    </div>
  );
}
