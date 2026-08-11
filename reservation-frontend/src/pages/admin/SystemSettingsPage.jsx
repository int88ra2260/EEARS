import React, { useCallback, useEffect, useState } from 'react';

import { Link, useOutletContext } from 'react-router-dom';

import { Spinner } from 'react-bootstrap';

import useToast from '../../components/ui/useToast';

import {

  fetchSystemSettingsBundle,

  SETTINGS_PATHS,

  updateSystemSetting,

} from '../../services/settingsAdminApi';



function ToggleRow({ title, desc, value, loading, onChange }) {

  return (

    <div className="d-flex justify-content-between align-items-center border rounded p-3 mb-2">

      <div>

        <div className="fw-semibold">{title}</div>

        <div className="small text-muted">{desc}</div>

      </div>

      <div className="form-check form-switch m-0">

        <input

          className="form-check-input"

          type="checkbox"

          checked={!!value}

          disabled={loading}

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

  });



  const [lastFeedback, setLastFeedback] = useState(null);



  const load = useCallback(async () => {

    setLoading(true);

    setError('');

    const bundle = await fetchSystemSettingsBundle(token, userRole);

    setSettings({

      englishTestRegistrationEnabled: bundle.englishTestRegistrationEnabled,

      englishTestRegistrationGroupEnabled: bundle.englishTestRegistrationGroupEnabled,

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

      setLastFeedback({

        type: 'danger',

        message: '設定更新失敗',

        at: new Date().toLocaleString('zh-TW'),

      });

      toast.error('設定更新失敗');

    } finally {

      setSaving(false);

    }

  };



  if (loading)

    return (

      <div className="d-flex align-items-center gap-2 p-4" role="status" aria-busy="true">

        <Spinner animation="border" size="sm" />

        <div>載入系統設定中...</div>

      </div>

    );

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

          <ToggleRow

            title="英檢個人報名開關"

            desc="控制培力英檢個人報名入口（含前台 Header 顯示與學生端 API）"

            value={settings.englishTestRegistrationEnabled}

            loading={saving}

            onChange={(v) => updateSetting(SETTINGS_PATHS.englishTestRegistration, 'englishTestRegistrationEnabled', v)}

          />

          <ToggleRow

            title="團體報名（Learning Partner）開關"

            desc="控制學習有伴團體報名（學生端與 API 同步）"

            value={settings.englishTestRegistrationGroupEnabled}

            loading={saving}

            onChange={(v) => updateSetting(SETTINGS_PATHS.englishTestRegistrationGroup, 'englishTestRegistrationGroupEnabled', v)}

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


