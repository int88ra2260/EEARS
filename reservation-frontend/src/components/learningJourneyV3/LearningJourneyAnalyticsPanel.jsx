import React, { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import { Link } from 'react-router-dom';
import { getLearningJourneyAnalyticsSummary } from '../../services/learningJourneyV3Api';

function formatRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function KpiCard({ label, value, hint }) {
  return (
    <div className="border rounded p-3 h-100 bg-light">
      <div className="small text-muted">{label}</div>
      <div className="fs-4 fw-semibold">{value}</div>
      {hint ? <div className="small text-muted mt-1">{hint}</div> : null}
    </div>
  );
}

function buildAnalyticsOverviewHref(semesterId) {
  const sem = String(semesterId || '').trim();
  const qs = sem ? `?semester=${encodeURIComponent(sem)}` : '';
  return `/admin/learning-analytics/overview${qs}`;
}

/**
 * 學習歷程儀表板上的成效摘要（精簡版）。
 * 完整群體分析、資源效益與 Model Run 請至「英語學習成效分析」模組。
 */
export default function LearningJourneyAnalyticsPanel({ token, semesterId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getLearningJourneyAnalyticsSummary(token, {});
      setSummary(data || null);
    } catch (err) {
      setSummary(null);
      setError(err.message || '讀取成效摘要失敗');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const totals = summary?.totals || {};
  const overviewHref = buildAnalyticsOverviewHref(semesterId);
  const resourcesHref = semesterId
    ? `/admin/learning-analytics/resources?semester=${encodeURIComponent(semesterId)}`
    : '/admin/learning-analytics/resources';

  return (
    <div>
      <p className="small text-muted mb-3 mb-md-2">
        以下為全域分析快照的精簡摘要。學期 B2 程度、分項統計與學生清單請見本頁其他區塊；
        完整圖表與技能成長請到
        {' '}
        <Link to="/admin/learning-analytics/overview">英語學習成效分析</Link>
        。
      </p>

      {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
      {loading ? (
        <div className="border rounded p-3 bg-light text-muted small">載入成效摘要…</div>
      ) : null}

      {!loading && summary ? (
        <>
          <div className="small text-muted mb-2">
            分析快照：{summary.snapshotVersion || '—'}
          </div>
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3">
              <KpiCard
                label="納入分析學生"
                value={totals.students ?? '—'}
                hint="全域最新分析快照人數；下方分項統計為學期名冊，兩者範圍不同。"
              />
            </div>
            <div className="col-6 col-md-3">
              <KpiCard
                label="B2+ 達標率"
                value={formatRate(totals.b2plusRate)}
                hint={`${totals.b2plusCount ?? 0} 人`}
              />
            </div>
            <div className="col-6 col-md-3">
              <KpiCard
                label="有前後測樣本"
                value={totals.multiExamStudents ?? '—'}
                hint={`重測 ${totals.retestStudents ?? 0} 人`}
              />
            </div>
            <div className="col-6 col-md-3">
              <KpiCard label="有進步英檢列" value={totals.improvedExamRows ?? '—'} />
            </div>
          </div>
          {Array.isArray(summary.notes) && summary.notes.length ? (
            <Alert variant="info" className="py-2 small">{summary.notes[0]}</Alert>
          ) : null}
        </>
      ) : null}

      {!loading && !error && !summary ? (
        <Alert variant="warning" className="small mb-3">
          尚無分析資料。請至
          {' '}
          <Link to="/admin/learning-journey/operations">學習歷程維運</Link>
          {' '}
          執行「背景重建（全部）」後再檢視。
        </Alert>
      ) : null}

      <div className="d-flex flex-wrap gap-2 align-items-center pt-1 border-top">
        <Button as={Link} to={overviewHref} variant="primary" size="sm">
          查看完整成效分析 →
        </Button>
        <Button as={Link} to={resourcesHref} variant="outline-secondary" size="sm">
          資源效益與進階模型
        </Button>
        {semesterId ? (
          <span className="small text-muted">
            將帶入學期
            {' '}
            <strong>{semesterId}</strong>
            {' '}
            的 B2+ 認證率
          </span>
        ) : null}
      </div>
    </div>
  );
}
