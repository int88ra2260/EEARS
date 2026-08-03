import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import { computeClassDetailStatistics } from '../../../utils/classDetailHelpers';

export default function ClassDetailStatisticsCards({ data }) {
  const statistics = computeClassDetailStatistics(data);
  if (!statistics) return null;

  return (
    <Row className="mb-4">
      <Col md={3}>
        <Card className="text-center">
          <Card.Body>
            <h5 className="text-primary">{statistics.rosterCount}</h5>
            <p className="mb-0">名冊人數</p>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="text-center">
          <Card.Body>
            <h5 className="text-success">{statistics.participatedCount}</h5>
            <p className="mb-0">至少參與人數</p>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="text-center">
          <Card.Body>
            <h5 className="text-info">{statistics.totalAttends}</h5>
            <p className="mb-0">簽到總次數</p>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="text-center">
          <Card.Body>
            <h5 className="text-warning">{statistics.totalNoShows}</h5>
            <p className="mb-0">No-shows總數</p>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
