import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import {
  fetchStudentEtInsights,
  fetchStudentEtRecommendations,
} from '../../services/etGroupingApi';

function formatGse(snapshot) {
  if (!snapshot) return '—';
  const cefr = snapshot.cefrDisplay || snapshot.cefr || '';
  const gse = snapshot.gse;
  if (gse != null) return `${cefr || '?'} · ${gse}`;
  return cefr || '無資料';
}

export default function EtStudentParticipationPanel({
  token,
  studentId,
  showRecommendations = true,
  compact = false,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState(null);
  const [recommendations, setRecommendations] = useState(null);

  useEffect(() => {
    const sid = String(studentId || '').trim();
    if (!token || !sid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const tasks = [fetchStudentEtInsights(token, sid)];
    if (showRecommendations) {
      tasks.push(fetchStudentEtRecommendations(token, sid, { limit: 5 }).catch(() => null));
    }
    Promise.all(tasks)
      .then(([insightData, recData]) => {
        setInsights(insightData);
        setRecommendations(recData);
      })
      .catch((e) => {
        setInsights(null);
        setRecommendations(null);
        setError(e.message || '載入 ET 資料失敗');
      })
      .finally(() => setLoading(false));
  }, [token, studentId, showRecommendations]);

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 text-muted small py-2">
        <Spinner animation="border" size="sm" />
        載入 ET 參與紀錄…
      </div>
    );
  }

  if (error) {
    return <Alert variant="light" className="border small mb-0">{error}</Alert>;
  }

  if (!insights) return null;

  const summary = insights.summary || {};
  const links = insights.links || {};

  return (
    <div className="et-student-participation-panel">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className="small text-muted">GSE 快照：{formatGse(insights.gseSnapshot)}</span>
        <Badge bg="light" text="dark" className="border">
          ET 場次 {summary.totalSessions || 0}
        </Badge>
        <Badge bg="light" text="dark" className="border">
          已簽到 {summary.checkedInCount || 0}
        </Badge>
        {summary.avgTaskCompletionRate != null ? (
          <Badge bg="light" text="dark" className="border">
            平均任務完成 {summary.avgTaskCompletionRate}%
          </Badge>
        ) : null}
        <div className="ms-auto d-flex flex-wrap gap-2">
          {links.etStudentTrends ? (
            <Link to={links.etStudentTrends} className="btn btn-outline-secondary btn-sm">
              ET 學期趨勢
            </Link>
          ) : null}
          {links.learningAnalytics ? (
            <Link to={links.learningAnalytics} className="btn btn-outline-secondary btn-sm">
              LVA 學習軌跡
            </Link>
          ) : null}
        </div>
      </div>

      {insights.disclaimer ? (
        <p className="small text-muted mb-2">{insights.disclaimer}</p>
      ) : null}

      {!compact && (insights.sessions || []).length > 0 ? (
        <div className="table-responsive mb-3">
          <Table size="sm" striped bordered hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>日期</th>
                <th>活動</th>
                <th>組別</th>
                <th>簽到</th>
                <th>任務</th>
              </tr>
            </thead>
            <tbody>
              {insights.sessions.map((session) => (
                <tr key={`${session.eventId}-${session.date}`}>
                  <td>{session.date || '—'}</td>
                  <td>
                    {session.adminEventPath ? (
                      <Link to={session.adminEventPath}>{session.eventName || '—'}</Link>
                    ) : (
                      session.eventName || '—'
                    )}
                  </td>
                  <td>{session.groupLabel || '—'}</td>
                  <td>{session.checkinStatus || '—'}</td>
                  <td>
                    {session.taskTotal
                      ? `${session.taskCompleted || 0}/${session.taskTotal}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : null}

      {showRecommendations && recommendations?.recommendations?.length ? (
        <div>
          <div className="fw-semibold small mb-2">活動建議（行政參考）</div>
          <ul className="list-unstyled mb-0 small">
            {recommendations.recommendations.map((rec) => (
              <li key={rec.eventId} className="border rounded p-2 mb-2">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="fw-semibold">{rec.name}</span>
                  <Badge bg="light" text="dark" className="border">{rec.eventType}</Badge>
                  {rec.openNow ? (
                    <Badge bg="success">可預約</Badge>
                  ) : (
                    <Badge bg="secondary">未開放</Badge>
                  )}
                  {rec.alreadyReserved ? (
                    <Badge bg="info">已報名</Badge>
                  ) : null}
                </div>
                <div className="text-muted">
                  {rec.date} {rec.startTime || ''}
                  {rec.availableSpots != null ? ` · 剩餘 ${rec.availableSpots} 名額` : ''}
                </div>
                <div className="mt-1">{rec.rationale}</div>
              </li>
            ))}
          </ul>
          {recommendations.disclaimer ? (
            <p className="small text-muted mt-2 mb-0">{recommendations.disclaimer}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
