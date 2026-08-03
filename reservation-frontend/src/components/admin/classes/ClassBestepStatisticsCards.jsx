import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';

export default function ClassBestepStatisticsCards({ statistics }) {
  if (!statistics) return null;

  return (
    <Row className="mb-4">
      <Col md={3}>
        <Card className="text-center">
          <Card.Body>
            <h5 className="text-primary">{statistics.domesticStudentCount ?? statistics.enrolledCount ?? 0}</h5>
            <p className="mb-0">本國學生</p>
            <small className="text-muted">班級 {statistics.totalStudents} 人</small>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="text-center">
          <Card.Body>
            <h5 className="text-success">{statistics.registrationRate ?? 0}%</h5>
            <p className="mb-0">報考率</p>
            <small className="text-muted">
              計次 {statistics.totalExamCount ?? statistics.registrationSlots ?? 0}
              {' / '}
              {statistics.registrationDenominator ?? 0}
            </small>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="text-center">
          <Card.Body>
            <p className="mb-2 fw-semibold text-info">到考率</p>
            <div className="small text-start mx-auto" style={{ maxWidth: '220px' }}>
              <div className="d-flex justify-content-between mb-1">
                <span>總</span>
                <span>
                  {statistics.attendanceRate != null ? `${statistics.attendanceRate}%` : '—'}
                  <span className="text-muted ms-1">
                    ({statistics.attendedSlots ?? 0}/{statistics.totalRegistrationExamSlots ?? 0})
                  </span>
                </span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span>LR</span>
                <span>
                  {statistics.lrAttendanceRate != null ? `${statistics.lrAttendanceRate}%` : '—'}
                  <span className="text-muted ms-1">
                    ({statistics.lrAttendedSlots ?? 0}/{statistics.lrTotalSlots ?? 0})
                  </span>
                </span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span>S</span>
                <span>
                  {statistics.sAttendanceRate != null ? `${statistics.sAttendanceRate}%` : '—'}
                  <span className="text-muted ms-1">
                    ({statistics.sAttendedSlots ?? 0}/{statistics.sTotalSlots ?? 0})
                  </span>
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span>W</span>
                <span>
                  {statistics.wAttendanceRate != null ? `${statistics.wAttendanceRate}%` : '—'}
                  <span className="text-muted ms-1">
                    ({statistics.wAttendedSlots ?? 0}/{statistics.wTotalSlots ?? 0})
                  </span>
                </span>
              </div>
            </div>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="text-center">
          <Card.Body>
            <h5 className={statistics.passedCount > 0 ? 'text-success' : 'text-muted'}>
              {statistics.passedCount}
            </h5>
            <p className="mb-0">達標人數</p>
            <small className="text-muted">({statistics.passRate}%)</small>
            {statistics.avgScore && (
              <div className="mt-1">
                <small className="text-muted">平均分: {statistics.avgScore}</small>
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
