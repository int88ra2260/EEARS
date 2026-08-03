import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export default function ClassOverviewChart({ data }) {
  if (!data.length) return null;
  const chartData = data.map((item) => ({
    name: item.className,
    coverage: item.coverage,
    attends: item.attendedCountTotal,
  }));

  return (
    <Row className="mb-4">
      <Col xs={12}>
        <Card>
          <Card.Header><h5>各班參與率</h5></Card.Header>
          <Card.Body>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="coverage" fill="#8884d8" name="參與率(%)" />
              </BarChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
