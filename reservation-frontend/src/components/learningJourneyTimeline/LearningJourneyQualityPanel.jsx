import React, { useCallback, useEffect, useState } from 'react';
import {
  getLearningJourneyQualityAssertions,
  getLearningJourneyOperationRunDetail,
  postLearningJourneyAnalyticsRebuild,
} from '../../services/learningJourneyV3Api';

function rebuildPayloadForMode(mode, semesterId) {
  if (mode === 'semester' && semesterId) {
    return { scope: 'semester', semesterId, confirm: true };
  }
  if (mode === 'global') {
    return { scope: 'global', confirm: true };
  }
  return { scope: 'global', confirm: true };
}

export default function LearningJourneyQualityPanel({ token, canManage, semesterId }) {
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [quality, setQuality] = useState(null);
  const [rebuildResult, setRebuildResult] = useState(null);
  const [pendingRunId, setPendingRunId] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getLearningJourneyQualityAssertions(token);
      setQuality(data);
    } catch (err) {
      setError(err?.message || '品質檢查失敗');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pendingRunId || !token) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const detail = await getLearningJourneyOperationRunDetail(token, pendingRunId);
        if (cancelled) return;
        if (detail?.status === 'success') {
          setRebuildResult(detail.resultSummary || null);
          setInfo('');
          setPendingRunId(null);
          setRebuilding(false);
          await load();
        } else if (detail?.status === 'failed') {
          setError(detail.errorMessage || '背景重建失敗');
          setInfo('');
          setPendingRunId(null);
          setRebuilding(false);
        } else if (detail?.resultSummary?.phase === 'rebuilding') {
          const p = detail.resultSummary;
          setInfo(`背景重建進行中：${p.completedBatches || 0}/${p.batchCount || '?'} 批（共 ${p.totalStudents || '?'} 人）`);
        }
      } catch (_) {
        // 持續輪詢
      }
    };

    poll();
    const timer = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pendingRunId, token, load]);

  const handleRebuild = async (mode) => {
    if (!token || !canManage) return;
    if (mode === 'semester' && !semesterId) {
      setError('請先在下方篩選條件指定學期，再執行學期重建。');
      return;
    }

    const label = mode === 'semester' ? `學期 ${semesterId}` : '全部學生';
    const ok = window.confirm(
      `將在背景重建 analytic 衍生層（${label}）。\n`
      + '此作業可能需數分鐘，完成後時間軸與研究匯出才會同步。\n'
      + '確定要繼續嗎？'
    );
    if (!ok) return;

    setRebuilding(true);
    setError('');
    setInfo('');
    setRebuildResult(null);
    try {
      const result = await postLearningJourneyAnalyticsRebuild(token, rebuildPayloadForMode(mode, semesterId));
      if (result?.async) {
        setPendingRunId(result.operationRunId);
        setInfo(result.message || '背景重建已啟動，請稍候…');
        return;
      }
      setRebuildResult(result);
      await load();
      setRebuilding(false);
    } catch (err) {
      setError(err?.message || '重建失敗');
      setRebuilding(false);
    }
  };

  const summary = quality?.summary;

  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span>學習歷程資料品質</span>
        {canManage ? (
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => handleRebuild('global')}
              disabled={rebuilding}
            >
              {rebuilding && !semesterId ? '重建中…' : '背景重建（全部）'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handleRebuild('semester')}
              disabled={rebuilding || !semesterId}
              title={semesterId ? `重建學期 ${semesterId}` : '請先指定學期'}
            >
              背景重建（目前學期）
            </button>
          </div>
        ) : null}
      </div>
      <div className="card-body">
        <div className="text-muted small mb-2">
          時間軸與研究分析讀取 <code>lj_student_events</code> 衍生層；匯入來源資料後需重建才會顯示。
          全域重建改為<strong>背景執行</strong>，避免 HTTP 逾時（502）。
        </div>
        {loading ? <div className="text-muted small">載入品質指標…</div> : null}
        {error ? <div className="alert alert-danger py-2">{error}</div> : null}
        {info ? <div className="alert alert-info py-2">{info}</div> : null}
        {summary ? (
          <div className="row g-2 small">
            <div className="col-md-3"><strong>事件總數</strong> {summary.totalEvents}</div>
            <div className="col-md-3"><strong>英檢列數</strong> {summary.totalExams}</div>
            <div className="col-md-3"><strong>缺 event_date 率</strong> {(summary.missingEventDateRate * 100).toFixed(1)}%</div>
            <div className="col-md-3"><strong>未出分比例</strong> {(summary.registeredNoScoreRate * 100).toFixed(1)}%</div>
            <div className="col-12 text-muted">
              異常：缺日期 {summary.anomalies?.missingEventDate}、未出分含分數 {summary.anomalies?.registeredNoScoreWithScore}、
              跨工具 delta {summary.anomalies?.crossInstrumentDelta}
            </div>
          </div>
        ) : null}
        {rebuildResult ? (
          <div className="alert alert-success py-2 mt-2 mb-0 small">
            重建完成：學生 {rebuildResult.analyticStudentCount} 列、英檢 {rebuildResult.analyticExamCount} 列
            {rebuildResult.snapshotVersion ? `（${rebuildResult.snapshotVersion}）` : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}
