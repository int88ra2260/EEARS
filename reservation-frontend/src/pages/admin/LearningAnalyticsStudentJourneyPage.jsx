import React, { useEffect, useMemo, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import {
  clearRecentStudents,
  pushRecentStudent,
  readRecentStudents,
  rememberFindListScroll,
  restoreFindListScroll,
  studentTrajectoryPath,
} from '../../utils/learningAnalyticsRecentStudents';

export default function LearningAnalyticsStudentJourneyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const listReturn = `${location.pathname}${location.search}`;
  const [studentId, setStudentId] = useState('');
  const [recent, setRecent] = useState(() => readRecentStudents());

  useEffect(() => {
    setRecent(readRecentStudents());
  }, []);

  useEffect(() => {
    restoreFindListScroll();
  }, [listReturn]);

  const analyticsPath = useMemo(
    () => (studentId ? studentTrajectoryPath(studentId) : null),
    [studentId]
  );

  const openTrajectory = (sid, name = null) => {
    const normalized = String(sid || '').trim().toUpperCase();
    if (!normalized) return;
    pushRecentStudent({ studentId: normalized, name });
    setRecent(readRecentStudents());
    rememberFindListScroll();
    navigate(studentTrajectoryPath(normalized, listReturn));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    openTrajectory(studentId);
  };

  const handleClearRecent = () => {
    clearRecentStudents();
    setRecent([]);
  };

  return (
    <LearningAnalyticsPageFrame
      title="個人軌跡"
      findMode="student"
      question="輸入學號，看這位學生的輔導摘要、前後測與時間線。"
      scope="從名單、KPI 或課／師／活動點學號進來，或在這裡直接查。"
    >
      <div className="la-panel mb-3">
        <Form
          className="d-flex flex-wrap gap-2 align-items-end"
          onSubmit={handleSubmit}
        >
          <Form.Group style={{ minWidth: 220 }}>
            <Form.Label className="small text-muted">學號</Form.Label>
            <Form.Control
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.trim().toUpperCase())}
              placeholder="例：D12345678"
              autoComplete="off"
            />
          </Form.Group>
          <Button
            type="submit"
            variant="primary"
            disabled={!studentId}
          >
            開啟軌跡
          </Button>
          <Button
            as={Link}
            to={analyticsPath ? `/admin/learning-journey/students/${encodeURIComponent(studentId)}` : '#'}
            variant="outline-secondary"
            disabled={!studentId}
          >
            完整學習歷程
          </Button>
        </Form>
      </div>

      <div className="la-panel">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <div className="la-panel-title mb-0">最近查詢</div>
          {recent.length ? (
            <Button variant="link" size="sm" className="p-0" onClick={handleClearRecent}>
              清除
            </Button>
          ) : null}
        </div>
        {!recent.length ? (
          <p className="small text-muted mb-0">尚無本機最近查詢。從 KPI 明細或上方搜尋開啟後會出現在這裡。</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {recent.map((row) => (
              <li
                key={`${row.studentId}-${row.at}`}
                className="d-flex flex-wrap justify-content-between align-items-center py-2 border-bottom"
              >
                <div>
                  <Button
                    variant="link"
                    className="p-0 font-monospace text-decoration-none"
                    onClick={() => openTrajectory(row.studentId, row.name)}
                  >
                    {row.studentId}
                  </Button>
                  {row.name ? (
                    <span className="small text-muted ms-2">{row.name}</span>
                  ) : null}
                </div>
                <span className="small text-muted">
                  {row.at ? String(row.at).slice(0, 10) : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </LearningAnalyticsPageFrame>
  );
}
