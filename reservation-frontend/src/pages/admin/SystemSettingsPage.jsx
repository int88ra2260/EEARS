import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import useToast from '../../components/ui/useToast';
import {
  fetchSystemSettingsBundle,
  SETTINGS_PATHS,
  updateSystemSetting,
} from '../../services/settingsAdminApi';

function ToggleRow({ title, desc, value, loading, onChange, disabled = false, disabledHint }) {
  return (
    <div className="d-flex justify-content-between align-items-center border rounded p-3 mb-2">
      <div>
        <div className="fw-semibold">{title}</div>
        <div className="small text-muted">{desc}</div>
        {disabled && disabledHint ? (
          <div className="small text-warning mt-1">{disabledHint}</div>
        ) : null}
      </div>
      <div className="form-check form-switch m-0">
        <input
          className="form-check-input"
          type="checkbox"
          checked={!!value}
          disabled={loading || disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    </div>
  );
}

export default function SystemSettingsPage() {
  const { token, userRole } = useOutletContext();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({
    englishTestRegistrationEnabled: true,
    englishTestRegistrationGroupEnabled: true,
    englishTestRegistrationEditEnabled: true,
  });
  const [lastFeedback, setLastFeedback] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const bundle = await fetchSystemSettingsBundle(token, userRole);
    setSettings({
      englishTestRegistrationEnabled: bundle.englishTestRegistrationEnabled,
      englishTestRegistrationGroupEnabled: bundle.englishTestRegistrationGroupEnabled,
      englishTestRegistrationEditEnabled: bundle.englishTestRegistrationEditEnabled,
    });

    if (bundle.allSettingsFailed) {
      setError('無法載入系統設定，請確認權限或稍後再試。');
    }
    setLoading(false);
  }, [token, userRole]);

  useEffect(() => {
    load();
  }, [load]);

  const updateSetting = async (path, key, enabled) => {
    if (key === 'englishTestRegistrationEnabled' && enabled && !settings.englishTestRegistrationEditEnabled) {
      toast.error('請先開啟「檢視與修正」，才能開啟個人報名');
      return;
    }
    if (key === 'englishTestRegistrationEditEnabled' && !enabled && settings.englishTestRegistrationEnabled) {
      toast.error('請先關閉「個人報名」，才能關閉「檢視與修正」');
      return;
    }

    setSaving(true);
    try {
      await updateSystemSetting(token, userRole, path, enabled);
      setSettings((prev) => ({ ...prev, [key]: enabled }));
      const feedback = {
        type: 'success',
        message: `設定已更新：${key} -> ${enabled ? '啟用' : '停用'}`,
        at: new Date().toLocaleString('zh-TW'),
      };
      setLastFeedback(feedback);
      toast.success('設定已更新');
    } catch (e) {
      const msg = e?.message || e?.data?.error || '設定更新失敗';
      setLastFeedback({
        type: 'danger',
        message: msg,
        at: new Date().toLocaleString('zh-TW'),
      });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 p-4" role="status" aria-busy="true">
        <Spinner animation="border" size="sm" />
        <div>載入系統設定中...</div>
      </div>
    );
  }
  if (error) return <div className="alert alert-warning">{error}</div>;

  return (
    <div>
      <div className="d-flex justify-content-end align-items-center mb-3">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={load} disabled={saving}>
          {saving ? '儲存中...' : '重新整理'}
        </button>
      </div>
      {lastFeedback ? (
        <div className={`alert alert-${lastFeedback.type} py-2`} role="status">
          <div>{lastFeedback.message}</div>
          <div className="small opacity-75">時間：{lastFeedback.at}</div>
        </div>
      ) : null}

      <div className="alert alert-info small mb-3">
        活動問卷（English Table／English Club）的啟用、時段與必填，請至
        {' '}
        <Link to="/admin/survey-rules">問卷啟用規則</Link>
        {' '}
        統一設定。
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-header">系統開關</div>
        <div className="card-body">
          <div className="alert alert-secondary small mb-3">
            個人報名與「檢視與修正」僅允許：兩者皆開（Header：培力英檢(考試報名)）、僅檢視與修正（Header：培力英檢(資料修正)）、兩者皆關（Header 不顯示）。
          </div>
          <ToggleRow
            title="英檢個人報名開關"
            desc="控制培力英檢個人新報名；需同時開啟「檢視與修正」"
            value={settings.englishTestRegistrationEnabled}
            loading={saving}
            disabled={!settings.englishTestRegistrationEnabled && !settings.englishTestRegistrationEditEnabled}
            disabledHint="請先開啟「檢視與修正」"
            onChange={(v) => updateSetting(SETTINGS_PATHS.englishTestRegistration, 'englishTestRegistrationEnabled', v)}
          />
          <ToggleRow
            title="團體報名（Learning Partner）開關"
            desc="控制學習有伴團體報名（學生端與 API 同步）"
            value={settings.englishTestRegistrationGroupEnabled}
            loading={saving}
            onChange={(v) => updateSetting(SETTINGS_PATHS.englishTestRegistrationGroup, 'englishTestRegistrationGroupEnabled', v)}
          />
          <ToggleRow
            title="英檢「檢視與修正」開關"
            desc="控制 Header 是否顯示培力英檢入口，以及學生端查詢／修改；關閉前需先關閉個人報名"
            value={settings.englishTestRegistrationEditEnabled}
            loading={saving}
            disabled={settings.englishTestRegistrationEditEnabled && settings.englishTestRegistrationEnabled}
            disabledHint="請先關閉「個人報名」"
            onChange={(v) => updateSetting(SETTINGS_PATHS.englishTestRegistrationEdit, 'englishTestRegistrationEditEnabled', v)}
          />
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header">其他設定入口</div>
        <div className="card-body d-flex flex-wrap gap-2">
          <Link to="/admin/survey-rules" className="btn btn-outline-primary btn-sm">問卷啟用規則</Link>
          <Link to="/admin/announcements" className="btn btn-outline-primary btn-sm">公告管理</Link>
          <Link to="/admin/english-test" className="btn btn-outline-primary btn-sm">英檢管理</Link>
          <Link to="/admin/settings/email-templates" className="btn btn-outline-primary btn-sm">郵件設定中心</Link>
          <Link to="/admin/logs" className="btn btn-outline-secondary btn-sm">操作紀錄</Link>
        </div>
      </div>
    </div>
  );
}
