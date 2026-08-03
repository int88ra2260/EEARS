import React from 'react';
import { Card, Col, Form, Row } from 'react-bootstrap';
import { EXAM_TYPE_OPTIONS } from '../../../utils/classBestepDisplayHelpers';

export default function ClassBestepFilters({ filters, onFilterChange, onSearchChange }) {
  return (
    <Card className="mb-4">
      <Card.Body>
        <Row className="g-3">
          <Col md={2}>
            <Form.Label>學期</Form.Label>
            <Form.Select
              value={filters.semester}
              onChange={(e) => onFilterChange('semester', e.target.value)}
            >
              <option value="114-1">114-1學期</option>
              <option value="113-2">113-2學期</option>
              <option value="114-2">114-2學期</option>
              <option value="115-1">115-1學期</option>
              <option value="115-2">115-2學期</option>
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label>考試類型</Form.Label>
            <Form.Select
              value={filters.examType}
              onChange={(e) => onFilterChange('examType', e.target.value)}
            >
              {EXAM_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={4}>
            <Form.Label>搜尋學生</Form.Label>
            <Form.Control
              type="text"
              placeholder="輸入學號或姓名..."
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </Col>
          <Col md={2}>
            <Form.Label>每頁筆數</Form.Label>
            <Form.Select
              value={filters.pageSize}
              onChange={(e) => onFilterChange('pageSize', parseInt(e.target.value, 10))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </Form.Select>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}
