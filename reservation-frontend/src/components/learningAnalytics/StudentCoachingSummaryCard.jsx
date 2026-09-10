import React, { useMemo } from 'react';
import Badge from 'react-bootstrap/Badge';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { Link } from 'react-router-dom';
import StatusBadge from '../ui/StatusBadge';

function pickRecentByLane(timeline, lane, limit = 3) {
  return (timeline || [])
    .filter((ev) => ev.lane === lane)
    .slice()
    .reverse()
    .slice(0, limit);
}

/**
 * 個人軌跡頁頂：30 秒內知道要催什麼（快照口徑，非學期官方 KPI）。
 */
export default function StudentCoachingSummaryCard({ journey, studentId, semesterId }) {
  const status = journey?.student?.currentStatus || {};
  const baseline = journey?.student?.baseline || {};
  const examCount = Number(status.examCount) || 0;
  const hasRetest = Boolean(status.retestFlag);
  const isB2plus = Boolean(status.isB2plus);

  const actionItems = useMemo(() => {
    const items = [];
    if (examCount <= 0) {
      items.push({ key: 'no_exam', tone: 'danger', label: '無有效考試', hint: '優先協助報名／確認成績入檔' });
    } else if (!hasRetest) {
      items.push({ key: 'missing_retest', tone: 'warning', label: '缺重測（僅基線）', hint: '有考試但尚無法算個人成長' });
    }
    if (examCount > 0 && !isB2plus) {
      items.push({ key: 'not_b2', tone: 'secondary', label: '快照尚未 B2+', hint: '歷史最佳技能尚未達 B2（非學期 KPI 結算）' });
    }
    if (examCount > 0 && hasRetest && isB2plus) {
      items.push({ key: 'ok', tone: 'success', label: '已有重測且快照 B2+', hint: '可對照時間線與資源參與做追蹤' });
    }
    return items;
  }, [examCount, hasRetest, isB2plus]);

  const recentCourses = pickRecentByLane(journey?.timeline, 'course', 3);
  const recentActivities = pickRecentByLane(journey?.timeline, 'activity', 3);

  const offeringsLink = semesterId
    ? `/admin/learning-analytics/offerings?semester=${encodeURIComponent(semesterId)}`
    : '/admin/learning-analytics/offerings';

  return (
    <div className="la-panel mb-3 la-zone la-zone--ops">
      <div className="la-zone__badge">輔導摘要</div>
      <div className="la-panel-title mb-1">
        {journey?.student?.name || studentId}
        <span className="text-muted fw-normal ms-2 font-monospace small">{studentId}</span>
      </div>
      <p className="small text-muted mb-3">
        以下依分析快照判斷，方便輔導優先序；正式學期聽讀／說寫達標請以
        {' '}
        <Link to="/admin/learning-analytics/kpi-report">B2 KPI 報表</Link>
        {' '}
        為準。
      </p>

      <Row className="g-2 small mb-3">
        <Col md={3} sm={6}>
          <span className="text-muted">系所</span>
          <div>{journey?.student?.department || '—'}</div>
        </Col>
        <Col md={3} sm={6}>
          <span className="text-muted">入學屆</span>
          <div>{journey?.student?.cohort || '—'}</div>
        </Col>
        <Col md={3} sm={6}>
          <span className="text-muted">基準 → 最佳 CEFR</span>
          <div>
            {baseline.cefr || '—'}
            <span className="text-muted mx-1">→</span>
            <strong>{status.bestCefr || '—'}</strong>
            {isB2plus ? (
              <StatusBadge variant="success" size="sm" className="ms-1">B2+</StatusBadge>
            ) : null}
          </div>
        </Col>
        <Col md={3} sm={6}>
          <span className="text-muted">有效考試場次</span>
          <div>
            {examCount}
            {hasRetest ? (
              <Badge bg="light" text="dark" className="ms-2">有重測</Badge>
            ) : (
              <Badge bg="warning" text="dark" className="ms-2">無重測</Badge>
            )}
          </div>
        </Col>
      </Row>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {actionItems.map((item) => (
          <div key={item.key} className="border rounded px-2 py-1 small bg-white">
            <Badge bg={item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : item.tone === 'success' ? 'success' : 'secondary'} text={item.tone === 'warning' ? 'dark' : undefined} className="me-2">
              {item.label}
            </Badge>
            <span className="text-muted">{item.hint}</span>
          </div>
        ))}
      </div>

      <Row className="g-3">
        <Col md={6}>
          <div className="small fw-semibold mb-1">最近修課</div>
          {recentCourses.length ? (
            <ul className="small mb-0 ps-3">
              {recentCourses.map((ev) => (
                <li key={ev.eventId}>
                  <span className="text-muted">{ev.eventDate || '—'} · </span>
                  {ev.title || '（無標題）'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small text-muted mb-0">尚無修課事件</p>
          )}
        </Col>
        <Col md={6}>
          <div className="small fw-semibold mb-1">最近活動</div>
          {recentActivities.length ? (
            <ul className="small mb-0 ps-3">
              {recentActivities.map((ev) => (
                <li key={ev.eventId}>
                  <span className="text-muted">{ev.eventDate || '—'} · </span>
                  {ev.title || '（無標題）'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small text-muted mb-0">尚無活動事件</p>
          )}
        </Col>
      </Row>

      <div className="d-flex flex-wrap gap-3 mt-3 pt-2 border-top small">
        <Link to={offeringsLink}>課／師／活動細項{semesterId ? `（${semesterId}）` : ''}</Link>
        <Link to="/admin/learning-analytics/kpi-report">B2 KPI／缺口</Link>
      </div>
    </div>
  );
}
