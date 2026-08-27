import React, { useState } from 'react';
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
        <div className="la-panel-title">查學生學習軌跡</div>
        <p className="small text-muted">輸入學號查看時間線與進步明細。完整檔案請到學習歷程中心。</p>
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
            開啟軌跡
          </Button>
          <Button
            as={Link}
            to={studentId ? `/admin/learning-journey/students/${encodeURIComponent(studentId)}` : '#'}
            variant="outline-secondary"
            disabled={!studentId}
          >
            完整學習歷程
          </Button>
        </Form>
      </div>
    </div>
  );
}
