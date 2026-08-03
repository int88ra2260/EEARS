import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, Form, Button, Spinner, Alert, Badge, Row, Col } from 'react-bootstrap';
import { SEMESTER_OPTIONS } from '../utils/semesterUtils';
import { handleAPIError } from '../utils/errorHandler';
import { fetchClient } from '../utils/fetchClient';

function interpretProxyGrowth(growth) {
  if (growth === null || growth === undefined || growth === '') {
    return { variant: 'secondary', text: '無可比較資料：請確認查詢範圍是否涵蓋至少兩個學期。' };
  }
  const n = Number(growth);
  if (Number.isNaN(n)) {
    return { variant: 'secondary', text: '無法判讀變化量。' };
  }
  if (n > 0.5) {
    return {
      variant: 'info',
      text: '變化為正：全校班級合成之教學綜合 proxy 平均上升，可作為整體趨勢參考（非因果）。',
    };
  }
  if (n < -0.5) {
    return {
      variant: 'warning',
      text: '變化為負：建議進一步查看參與率、BESTEP、抵免、問卷與違規等細項（仍為 proxy，不得歸因於單一教師）。',
    };
  }
  return { variant: 'light', text: '變化量接近零：整體 proxy 大致持平。' };
}

export default function TeacherImpactPage() {
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');

  const [fromSemester, setFromSemester] = useState('113-2');
  const [toSemester, setToSemester] = useState('115-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [impact, setImpact] = useState(null);
  const [semesterSpan, setSemesterSpan] = useState([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchClient(
        `/api/analytics/trends/overview?fromSemester=${encodeURIComponent(
          fromSemester
        )}&toSemester=${encodeURIComponent(toSemester)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
        const msg = json?.error || json?.message || '載入失敗';
        const err = new Error(msg);
        err.requestId = requestId;
        err.status = res.status;
        if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
        throw err;
      }
      setSemesterSpan(json.semesters || []);
      // API 保留鍵名 teacherImpact；語意為全校教學綜合 proxy 跨期差分（非教師因果）
      setImpact(json.decisionKpis?.teacherImpact || null);
    } catch (e) {
      const errMsg = handleAPIError(e);
      setError(
        e?.message && typeof e.message === 'string' && e.message.trim()
          ? e.message
          : errMsg?.display || errMsg?.zh || '載入失敗'
      );
      setImpact(null);
      setSemesterSpan([]);
    } finally {
      setLoading(false);
    }
  }, [token, fromSemester, toSemester]);

  useEffect(() => {
    load();
  }, [load]);

  const needTwoSemesters = semesterSpan.length < 2;
  const interp = interpretProxyGrowth(impact?.growth);

  return (
    <div className="container-fluid px-2 px-md-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <Badge bg="secondary">實驗性指標</Badge>
        <Badge bg="info" text="dark">
          Proxy 指標
        </Badge>
      </div>
      <Alert variant="warning" className="mb-3">
        <strong>不作為個別教師績效評定依據。</strong>
        本頁呈現的是依班級參與率、BESTEP 通過率、抵免、問卷完成率與違規率等資料計算出的綜合 proxy 指標（全校班級合成教學分數之跨學期差分）。
        可作為行政觀察趨勢參考，<strong>不代表</strong>個別教師對學生學習成果的因果影響。
      </Alert>

      <Card className="mb-3 border-primary-subtle">
        <Card.Body>
          <div className="d-flex gap-2 flex-wrap align-items-end">
            <Form.Group>
              <Form.Label>前一學期（比較基準）</Form.Label>
              <Form.Select value={fromSemester} onChange={(e) => setFromSemester(e.target.value)}>
                {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label || o.value}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>目前學期（比較對象）</Form.Label>
              <Form.Select value={toSemester} onChange={(e) => setToSemester(e.target.value)}>
                {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label || o.value}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Button variant="primary" onClick={load} disabled={loading}>
              {loading ? '更新中…' : '重新整理'}
            </Button>
          </div>
          {needTwoSemesters && !loading && (
            <Alert variant="light" border className="small mt-3 mb-0 py-2">
              查詢範圍僅 {semesterSpan.length} 個學期：<strong>需要至少兩個學期</strong>才能計算教學綜合 proxy 之前後差分。
            </Alert>
          )}
        </Card.Body>
      </Card>

      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" className="text-primary" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}

      {!loading && impact && (
        <>
          <Card className="mb-3">
            <Card.Header className="d-flex flex-wrap align-items-center gap-2 fw-semibold bg-primary-subtle">
              <span>教學綜合指標（跨學期變化）</span>
              <Badge bg="secondary">Proxy</Badge>
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col xs={12} md={6}>
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body>
                      <div className="text-muted small">前一學期</div>
                      <div className="fs-5 fw-semibold text-primary">{impact.previousSemester ?? '—'}</div>
                      <div className="text-muted small mt-2">前一學期平均教學綜合分（proxy）</div>
                      <div className="fs-4">{impact.previousAvgTeachingScore ?? '—'}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12} md={6}>
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body>
                      <div className="text-muted small">目前學期</div>
                      <div className="fs-5 fw-semibold text-primary">{impact.currentSemester ?? '—'}</div>
                      <div className="text-muted small mt-2">目前學期平均教學綜合分（proxy）</div>
                      <div className="fs-4">{impact.currentAvgTeachingScore ?? '—'}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12}>
                  <div className="p-3 rounded border border-primary-subtle bg-white">
                    <div className="text-muted small">變化量（目前 − 前一，proxy）</div>
                    <div className="fs-3 fw-bold text-primary">{impact.growth ?? '—'}</div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          <Alert variant={interp.variant} className="small">
            <strong>判讀提示：</strong>
            {interp.text}
          </Alert>
        </>
      )}

      {!loading && !error && !impact && !needTwoSemesters && (
        <Alert variant="secondary" className="mb-0">
          後端未回傳教學綜合 proxy 差分（可能僅單一學期或資料不足）。請調整學期範圍後重試。
        </Alert>
      )}
    </div>
  );
}
