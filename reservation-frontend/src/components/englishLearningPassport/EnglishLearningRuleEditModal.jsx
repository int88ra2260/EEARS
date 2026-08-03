import React, { useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { adminCreateRule, adminUpdateRule } from '../../services/englishLearningPassportApi';

const EMPTY = {
  code: '',
  name: '',
  description: '',
  basePoints: '',
  maxPointsPerWeek: '',
  maxPointsTotal: '',
  isOnceOnly: false,
  requiresAttachment: false,
  isEnabled: true,
  sortOrder: '',
};

function toForm(rule) {
  if (!rule) return { ...EMPTY };
  return {
    code: rule.code || '',
    name: rule.name || '',
    description: rule.description || '',
    basePoints: rule.basePoints ?? '',
    maxPointsPerWeek: rule.maxPointsPerWeek ?? '',
    maxPointsTotal: rule.maxPointsTotal ?? '',
    isOnceOnly: !!rule.isOnceOnly,
    requiresAttachment: !!rule.requiresAttachment,
    isEnabled: rule.isEnabled !== false,
    sortOrder: rule.sortOrder ?? '',
  };
}

function toPayload(form, { includeCode = false } = {}) {
  const numOrNull = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    basePoints: Number(form.basePoints),
    maxPointsPerWeek: numOrNull(form.maxPointsPerWeek),
    maxPointsTotal: numOrNull(form.maxPointsTotal),
    isOnceOnly: !!form.isOnceOnly,
    requiresAttachment: !!form.requiresAttachment,
    isEnabled: !!form.isEnabled,
    sortOrder: Number(form.sortOrder) || 0,
  };
  if (includeCode) {
    payload.code = form.code.trim().toUpperCase();
  }
  return payload;
}

export default function EnglishLearningRuleEditModal({
  show,
  rule,
  isCreate = false,
  token,
  onHide,
  onSaved,
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(isCreate ? { ...EMPTY } : toForm(rule));
    setError('');
  }, [rule, show, isCreate]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isCreate && !form.code.trim()) {
      setError('規則代碼為必填');
      return;
    }
    if (!form.name.trim()) {
      setError('項目名稱為必填');
      return;
    }
    if (!Number.isFinite(Number(form.basePoints)) || Number(form.basePoints) < 0) {
      setError('預設點數須為 0 以上的數字');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isCreate) {
        await adminCreateRule(token, toPayload(form, { includeCode: true }));
      } else {
        if (!rule?.id) return;
        await adminUpdateRule(token, rule.id, toPayload(form));
      }
      onSaved?.();
      onHide();
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{isCreate ? '新增點數規則' : '編輯點數規則'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {isCreate ? (
            <Form.Group className="mb-3">
              <Form.Label>規則代碼 <span className="text-danger">*</span></Form.Label>
              <Form.Control
                value={form.code}
                onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                placeholder="例如 CUSTOM_ACTIVITY"
                required
              />
              <Form.Text className="text-muted">大寫英文、數字或底線；建立後不可變更。</Form.Text>
            </Form.Group>
          ) : (
            rule && (
              <p className="small text-muted mb-3">
                代碼：<code>{rule.code}</code>（不可變更）
              </p>
            )
          )}
          <Form.Group className="mb-3">
            <Form.Label>項目名稱 <span className="text-danger">*</span></Form.Label>
            <Form.Control
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>說明</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </Form.Group>
          <div className="row g-3">
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>預設點數 <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={form.basePoints}
                  onChange={(e) => handleChange('basePoints', e.target.value)}
                  required
                />
              </Form.Group>
            </div>
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>每週上限</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  placeholder="留空＝無"
                  value={form.maxPointsPerWeek}
                  onChange={(e) => handleChange('maxPointsPerWeek', e.target.value)}
                />
              </Form.Group>
            </div>
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>類別總上限</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  placeholder="留空＝無"
                  value={form.maxPointsTotal}
                  onChange={(e) => handleChange('maxPointsTotal', e.target.value)}
                />
              </Form.Group>
            </div>
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>排序</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => handleChange('sortOrder', e.target.value)}
                />
              </Form.Group>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-3 mt-3">
            <Form.Check
              type="switch"
              id="rule-once-only"
              label="僅能採計一次"
              checked={form.isOnceOnly}
              onChange={(e) => handleChange('isOnceOnly', e.target.checked)}
            />
            <Form.Check
              type="switch"
              id="rule-requires-attachment"
              label="需要附件"
              checked={form.requiresAttachment}
              onChange={(e) => handleChange('requiresAttachment', e.target.checked)}
            />
            <Form.Check
              type="switch"
              id="rule-is-enabled"
              label="啟用"
              checked={form.isEnabled}
              onChange={(e) => handleChange('isEnabled', e.target.checked)}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>取消</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? '儲存中…' : (isCreate ? '新增' : '儲存')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
