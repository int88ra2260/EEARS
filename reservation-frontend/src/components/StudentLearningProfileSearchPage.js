// src/components/StudentLearningProfileSearchPage.js
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form } from 'react-bootstrap';

export default function StudentLearningProfileSearchPage() {
  const navigate = useNavigate();

  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [fromSemester, setFromSemester] = useState('');
  const [toSemester, setToSemester] = useState('');
  const [error, setError] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    const semesterId = toSemester.trim() || fromSemester.trim();
    if (semesterId) params.set('semesterId', semesterId);
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [fromSemester, toSemester]);

  const onSubmit = () => {
    setError('');
    const sid = studentId.trim();
    if (!sid) {
      setError('請輸入學號才能查詢學生學習歷程。');
      return;
    }

    // Legacy/MVP search entry only. Official student profiles are served by Learning Journey V3.
    navigate(`/admin/learning-journey/students/${encodeURIComponent(sid)}${queryString}`);
  };

  return (
    <div className="container-fluid px-2 px-md-3">
      <p className="text-muted small mb-2">以學號查詢學生學習歷程，結果會開啟 Learning Journey V3 學生 profile。</p>
      <p className="text-muted small mb-3">
        查詢結果將以指定學期開啟 Learning Journey V3 profile；若同時填起訖學期，系統會以結束學期作為學生 profile 查詢學期。
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="mb-4">
        <Card.Header>查詢條件</Card.Header>
        <Card.Body>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <Form.Group className="mb-3" controlId="studentId">
              <Form.Label>學號</Form.Label>
              <Form.Control
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="例如：114xxxx"
                autoComplete="off"
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="name">
              <Form.Label>姓名（目前未啟用姓名搜尋）</Form.Label>
              <Form.Control
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="可留空"
                autoComplete="off"
              />
            </Form.Group>

            <div className="d-flex gap-3 flex-wrap">
              <Form.Group className="mb-3" controlId="fromSemester" style={{ minWidth: 220 }}>
                <Form.Label>起始學期（可選）</Form.Label>
                <Form.Control
                  value={fromSemester}
                  onChange={(e) => setFromSemester(e.target.value)}
                  placeholder="例如：114-1"
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="toSemester" style={{ minWidth: 220 }}>
                <Form.Label>結束學期（可選，優先作為 V3 profile 學期）</Form.Label>
                <Form.Control
                  value={toSemester}
                  onChange={(e) => setToSemester(e.target.value)}
                  placeholder="例如：114-2"
                />
              </Form.Group>
            </div>

            <Button type="submit" variant="primary">
              搜尋並查看學習歷程
            </Button>
          </Form>
        </Card.Body>
      </Card>

      <Alert variant="info" className="mb-0">
        此入口保留為學生查詢入口；正式學生 profile 以 Learning Journey V3 為準。
      </Alert>
    </div>
  );
}

