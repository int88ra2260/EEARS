import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import {
  resetLearningAnalyticsResourceSkillProfile,
  updateLearningAnalyticsResourceSkillProfiles,
} from '../../services/learningAnalyticsService';

const WEIGHT_KEYS = ['listening', 'reading', 'speaking', 'writing', 'interaction', 'mediation', 'eap', 'esp'];

const WEIGHT_LABELS = {
  listening: '聽',
  reading: '讀',
  speaking: '說',
  writing: '寫',
  interaction: '互動',
  mediation: '調整',
  eap: 'EAP',
  esp: 'ESP',
};

function cloneProfiles(rows = []) {
  return rows.map((row) => ({
    ...row,
    weights: { ...(row.weights || {}) },
    defaultWeights: { ...(row.defaultWeights || row.weights || {}) },
  }));
}

function profilesDirty(original, draft) {
  return draft.some((row, idx) => {
    const base = original[idx];
    if (!base) return true;
    return WEIGHT_KEYS.some((key) => Number(row.weights?.[key]) !== Number(base.weights?.[key]));
  });
}

export default function ResourceSkillProfileEditor({ token, profiles = [], onSaved, embedded = false }) {
  const [draft, setDraft] = useState(() => cloneProfiles(profiles));
  const [saving, setSaving] = useState(false);
  const [resettingKey, setResettingKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(cloneProfiles(profiles));
  }, [profiles]);

  const dirty = useMemo(() => profilesDirty(profiles, draft), [profiles, draft]);

  const updateWeight = (resourceKey, weightKey, value) => {
    setDraft((prev) => prev.map((row) => {
      if (row.resourceKey !== resourceKey) return row;
      return {
        ...row,
        weights: { ...row.weights, [weightKey]: value },
      };
    }));
  };

  const handleSaveAll = async () => {
    if (!token || saving || !dirty) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = draft.map((row) => ({
        resourceKey: row.resourceKey,
        weights: row.weights,
      }));
      const data = await updateLearningAnalyticsResourceSkillProfiles(token, payload);
      setMessage('技能向量已儲存；後續分析將採用新權重。');
      onSaved?.(data?.profiles || data);
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleResetRow = useCallback(async (resourceKey) => {
    if (!token || resettingKey) return;
    setResettingKey(resourceKey);
    setMessage('');
    setError('');
    try {
      const data = await resetLearningAnalyticsResourceSkillProfile(token, resourceKey);
      const nextProfiles = data?.profiles;
      if (Array.isArray(nextProfiles)) {
        onSaved?.(nextProfiles);
      } else {
        setDraft((prev) => prev.map((row) => (
          row.resourceKey === resourceKey
            ? { ...row, weights: { ...row.defaultWeights }, source: 'default', isCustom: false }
            : row
        )));
      }
      setMessage(`已還原 ${resourceKey} 為內建預設值。`);
    } catch (e) {
      setError(e.message || '還原失敗');
    } finally {
      setResettingKey('');
    }
  }, [token, resettingKey, onSaved]);

  if (!profiles.length) return null;

  const toolbar = (
    <div className={`d-flex flex-wrap justify-content-end gap-2 ${embedded ? 'mb-3' : 'mb-2'}`}>
      {!embedded ? (
        <div className="me-auto">
          <div className="la-panel-title mb-1">資源技能向量</div>
          <p className="small text-muted la-panel-lead mb-0">
            權重為 0–1 的相對訓練面向，用於曝光計算與個別化建議；非因果係數。
          </p>
        </div>
      ) : null}
      <Button
        size="sm"
        variant="dark"
        onClick={handleSaveAll}
        disabled={saving || !dirty}
      >
        {saving ? '儲存中…' : '儲存變更'}
      </Button>
    </div>
  );

  const body = (
    <>
      {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
      {message ? <Alert variant="success" className="py-2 small">{message}</Alert> : null}
      <div className="table-responsive la-skill-profile-scroll">
        <table className="table table-sm align-middle mb-0 la-skill-profile-table">
          <thead>
            <tr>
              <th>資源</th>
              {WEIGHT_KEYS.map((key) => (
                <th key={key} className="text-end">{WEIGHT_LABELS[key]}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.map((row) => {
              const isCustom = row.isCustom || row.source === 'db';
              return (
                <tr key={row.resourceKey} className={isCustom ? 'la-skill-profile-custom' : undefined}>
                  <td className="fw-semibold">
                    {row.label || row.resourceKey}
                    {isCustom ? (
                      <span className="la-tag la-tag-pastel-yellow ms-2">已校準</span>
                    ) : null}
                  </td>
                  {WEIGHT_KEYS.map((key) => (
                    <td key={key} className="text-end">
                      <Form.Control
                        type="number"
                        size="sm"
                        min={0}
                        max={1}
                        step={0.05}
                        className="la-skill-weight-input"
                        value={row.weights?.[key] ?? ''}
                        onChange={(e) => updateWeight(row.resourceKey, key, e.target.value)}
                        aria-label={`${row.label || row.resourceKey} ${WEIGHT_LABELS[key]}`}
                      />
                    </td>
                  ))}
                  <td className="text-end">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => handleResetRow(row.resourceKey)}
                      disabled={resettingKey === row.resourceKey}
                    >
                      {resettingKey === row.resourceKey ? <Spinner size="sm" animation="border" /> : '還原'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
