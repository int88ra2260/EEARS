import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import { Link } from 'react-router-dom';
import {
  createLearningAnalyticsModelRun,
  listLearningAnalyticsModelRuns,
} from '../../services/learningAnalyticsService';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';

export default function LearningAnalyticsModelRunPanel({ token, apiParams, disabled }) {
  const [modelRuns, setModelRuns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canRun = useMemo(
    () => hasPermission(buildAccessProfile(token), P.CAN_RUN_LEARNING_ANALYTICS_MODEL),
    [token]
  );

  const loadRuns = useCallback(async () => {
    if (!token) return;
    try {
      const runData = await listLearningAnalyticsModelRuns(token, { limit: 5 });
      setModelRuns(Array.isArray(runData?.items) ? runData.items : []);
    } catch {
      setModelRuns([]);
    }
  }, [token]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const persistModelRun = async () => {
    if (!token || saving || disabled || !canRun) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const filters = { ...(apiParams?.() || {}) };
      const data = await createLearningAnalyticsModelRun(token, { filters });
      setMessage(`已儲存分析紀錄 #${data?.modelRun?.id || '—'}。`);
      await loadRuns();
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const latestRun = modelRuns[0] || null;

  return (
    <div className="la-panel mt-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div className="la-panel-title mb-1">儲存這次分析結果</div>
          <p className="small text-muted mb-0">
            把目前篩選下的數字存下來，方便之後對照。
            {' '}
            <Link to="/admin/learning-analytics/model-runs">查看紀錄</Link>
          </p>
        </div>
        <Button
          size="sm"
          variant="dark"
          onClick={persistModelRun}
          disabled={saving || disabled || !canRun}
        >
          {saving ? '儲存中…' : '儲存紀錄'}
        </Button>
      </div>
      {!canRun ? (
        <Alert variant="light" className="small border py-2 mb-2">
          您沒有儲存權限；仍可
          {' '}
          <Link to="/admin/learning-analytics/model-runs">查看歷史紀錄</Link>
          。
        </Alert>
      ) : null}
      {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
      {message ? <Alert variant="success" className="py-2 small">{message}</Alert> : null}
      <div className="small text-muted">
        最近一次：
        {latestRun ? (
          <>
            {' '}
            #{latestRun.id}
            {latestRun.created_at ? ` · ${new Date(latestRun.created_at).toLocaleString('zh-TW')}` : ''}
          </>
        ) : (
          ' 尚無紀錄'
        )}
      </div>
    </div>
  );
}
