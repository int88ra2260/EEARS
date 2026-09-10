import React, { useEffect, useMemo, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { Link, useNavigate } from 'react-router-dom';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import LaFold from '../../components/learningAnalytics/LaFold';
import {
  clearRecentStudents,
  pushRecentStudent,
  readRecentStudents,
  studentTrajectoryPath,
} from '../../utils/learningAnalyticsRecentStudents';

export default function LearningAnalyticsStudentJourneyPage() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [recent, setRecent] = useState(() => readRecentStudents());

  useEffect(() => {
    setRecent(readRecentStudents());
  }, []);

  const analyticsPath = useMemo(
    () => (studentId ? studentTrajectoryPath(studentId) : null),
    [studentId]
  );

  const openTrajectory = (sid, name = null) => {
    const normalized = String(sid || '').trim().toUpperCase();
    if (!normalized) return;
    pushRecentStudent({ studentId: normalized, name });
    setRecent(readRecentStudents());
    navigate(studentTrajectoryPath(normalized));
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
    <div>
      <div className="la-panel mb-3">
        <LearningAnalyticsPanelHeader
          title="查學生學習軌跡"
          lead="輸入學號查看輔導摘要、前後測與時間線。也可從 B2 KPI 報表的學號直接點進來。"
        />
        <LaFold label="怎麼找到人？" className="mb-3">
          <ul className="small mb-0 ps-3">
            <li className="mb-1">
              從
              {' '}
              <Link to="/admin/learning-analytics/kpi-report">B2 KPI 報表</Link>
              {' '}
              學生明細點學號（上呈／缺口閉環）。
            </li>
            <li className="mb-1">從課／師／活動展開列的學號點進來。</li>
            <li>或在下方輸入學號；最近查詢會留在本機瀏覽器。</li>
          </ul>
        </LaFold>
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
    </div>
  );
}
