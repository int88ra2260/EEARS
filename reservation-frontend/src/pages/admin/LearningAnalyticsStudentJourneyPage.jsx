import React, { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { Link } from 'react-router-dom';

export default function LearningAnalyticsStudentJourneyPage() {
  const [studentId, setStudentId] = useState('');

  const analyticsPath = studentId
    ? `/admin/learning-analytics/students/${encodeURIComponent(studentId)}`
    : '#';

  return (
    <div>
      <div className="la-panel">
        <div className="la-panel-title">查詢學生學習軌跡</div>
        <p className="small text-muted">
          在此查詢學習成效分析用的時間線與成長 episode；完整檔案（含問卷等）請至英語學習歷程中心。
        </p>
        <Form
          className="d-flex flex-wrap gap-2 align-items-end"
          onSubmit={(e) => e.preventDefault()}
        >
          <Form.Group style={{ minWidth: 220 }}>
            <Form.Label className="small text-muted">學號</Form.Label>
            <Form.Control
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.trim().toUpperCase())}
              placeholder="例：D12345678"
            />
          </Form.Group>
          <Button
            as={Link}
            to={analyticsPath}
            variant="primary"
            disabled={!studentId}
          >
            開啟分析軌跡
          </Button>
          <Button
            as={Link}
            to={studentId ? `/admin/learning-journey/students/${encodeURIComponent(studentId)}` : '#'}
            variant="outline-secondary"
            disabled={!studentId}
          >
            完整學習歷程檔案
          </Button>
        </Form>
        <Alert variant="info" className="mt-3 mb-0 small">
          API：<code>/api/admin/learning-analytics/students/:studentId/journey</code>
          {' '}
          提供分析用時間線；網址格式為
          {' '}
          <code>/admin/learning-analytics/students/學號</code>
          （技能成長亦可用
          {' '}
          <code>/admin/learning-analytics/skills/學號</code>
          ）。
        </Alert>
      </div>
    </div>
  );
}
