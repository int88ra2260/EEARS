import React, { useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import {
  resetLearningAnalyticsLvaConfig,
  updateLearningAnalyticsLvaConfig,
} from '../../services/learningAnalyticsService';
import LvaFormulaReference from './LvaFormulaReference';
import LaFold from './LaFold';

function cloneGroups(groups = []) {
  return groups.map((group) => ({
    ...group,
    fields: group.fields.map((field) => ({ ...field })),
  }));
}

function groupsDirty(original, draft) {
  return draft.some((group, groupIdx) => group.fields.some((field, fieldIdx) => {
    const base = original[groupIdx]?.fields?.[fieldIdx];
    return Number(field.value) !== Number(base?.value);
  }));
}

export default function LvaConfigEditor({ token, lvaConfig, onSaved, embedded = false }) {
  const groups = useMemo(() => lvaConfig?.groups || [], [lvaConfig?.groups]);
  const [draft, setDraft] = useState(() => cloneGroups(groups));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(cloneGroups(groups));
  }, [groups]);

  const dirty = useMemo(() => groupsDirty(groups, draft), [groups, draft]);
  const hasCustom = lvaConfig?.hasCustomOverrides;

  const patchField = (groupId, key, value) => {
    setDraft((prev) => prev.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        fields: group.fields.map((field) => (
          field.key === key ? { ...field, value } : field
        )),
      };
    }));
  };

  const handleSave = async () => {
    if (!token || saving || !dirty) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const params = draft.flatMap((group) => group.fields.map((field) => ({
        key: field.key,
        value: field.type === 'integer' ? parseInt(field.value, 10) : Number(field.value),
      })));
      const data = await updateLearningAnalyticsLvaConfig(token, params);
      setMessage('估計參數已儲存。');
      onSaved?.(data?.lvaConfig || data);
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    if (!token || resetting) return;
    setResetting(true);
    setMessage('');
    setError('');
    try {
      const data = await resetLearningAnalyticsLvaConfig(token);
      setMessage('已還原為預設值。');
      onSaved?.(data?.lvaConfig || data);
    } catch (e) {
      setError(e.message || '還原失敗');
    } finally {
      setResetting(false);
    }
  };

  if (!groups.length) return null;

  const toolbar = (
    <div className={`d-flex flex-wrap justify-content-between align-items-start gap-2 ${embedded ? 'mb-3' : 'mb-2'}`}>
      {!embedded ? (
        <div>
          <div className="la-panel-title mb-1">估計參數</div>
          <p className="small text-muted la-panel-lead mb-0">
            調整校正後進步、背景相近比較與加權比較的門檻。
          </p>
        </div>
      ) : (
        <div className="small text-muted">
          此為觀察結果，不是保證參加就進步。
        </div>
      )}
      <div className="d-flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={handleResetAll}
          disabled={resetting || saving}
        >
          {resetting ? <Spinner size="sm" animation="border" /> : '全部還原預設'}
        </Button>
        <Button size="sm" variant="dark" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? '儲存中…' : '儲存參數'}
        </Button>
      </div>
    </div>
  );

  const body = (
    <>
      <LaFold label="計算方式說明" className="mb-3">
        <LvaFormulaReference />
      </LaFold>

      {hasCustom ? (
        <Alert variant="info" className="py-2 small">
          部分參數已自訂校準；可按「全部還原預設」恢復系統原始值。
        </Alert>
      ) : null}
      {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
      {message ? <Alert variant="success" className="py-2 small">{message}</Alert> : null}

      {draft.map((group) => (
        <div key={group.id} className="la-outlook-card mb-3">
          <div className="fw-semibold">{group.title}</div>
          {group.description ? <p className="small text-muted mb-2">{group.description}</p> : null}
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>參數</th>
                  <th className="text-end" style={{ width: '8rem' }}>目前值</th>
                  <th className="text-end" style={{ width: '6rem' }}>預設</th>
                </tr>
              </thead>
              <tbody>
                {group.fields.map((field) => (
                  <tr key={field.key} className={field.isCustom ? 'la-skill-profile-custom' : undefined}>
                    <td>
                      <div className="fw-semibold small">{field.label}</div>
                      {field.help ? <div className="text-muted small">{field.help}</div> : null}
                    </td>
                    <td className="text-end">
                      <Form.Control
                        type="number"
                        size="sm"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        className="la-skill-weight-input ms-auto"
                        value={field.value}
                        onChange={(e) => patchField(group.id, field.key, e.target.value)}
                      />
                    </td>
                    <td className="text-end text-muted">{field.defaultValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );

  if (embedded) {
    return (
      <div>
        {toolbar}
        {body}
      </div>
    );
  }

  return (
    <div className="la-panel mb-3">
      {toolbar}
      {body}
    </div>
  );
}
