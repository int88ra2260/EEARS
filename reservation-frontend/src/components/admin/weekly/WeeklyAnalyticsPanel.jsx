import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { fetchAdminWeeklyAnalytics } from '../../../services/weeklyReportAdminApi';

export default function WeeklyAnalyticsPanel({ token, reportId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !reportId) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchAdminWeeklyAnalytics(token, reportId);
      setData(result);
    } catch (err) {
      setError(err.message || '無法載入統計');
    } finally {
      setLoading(false);
    }
  }, [token, reportId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="weekly-analytics mt-3 p-3 border rounded bg-light">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong className="small">互動統計（匿名彙總）</strong>
        <Button size="sm" variant="outline-secondary" type="button" onClick={load} disabled={loading}>
          {loading ? '更新中…' : '重新整理'}
        </Button>
      </div>
      {error ? <p className="text-danger small mb-2">{error}</p> : null}
      {!data && !loading ? <p className="text-muted small mb-0">尚無資料</p> : null}
      {data ? (
        <div className="small">
          <p className="mb-1">完整閱讀：{data.readComplete}</p>
          <p className="mb-2">語彙挑戰完成：{data.challengeComplete}</p>
          {data.polls?.length ? (
            <div className="mb-2">
              <p className="fw-semibold mb-1">投票</p>
              {data.polls.map((poll) => (
                <div key={poll.blockId} className="mb-2">
                  <div>{poll.label}（{poll.totalVotes} 票）</div>
                  <ul className="mb-0 ps-3">
                    {(poll.options || []).map((opt) => (
                      <li key={opt.id}>
                        {opt.label}：{poll.optionCounts?.[opt.id] || 0}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
          {data.quizzes?.length ? (
            <div>
              <p className="fw-semibold mb-1">小測驗</p>
              <ul className="mb-0 ps-3">
                {data.quizzes.map((quiz) => (
                  <li key={quiz.blockId}>
                    {quiz.label}：{quiz.submissions} 次提交，平均 {quiz.avgScore}%
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
