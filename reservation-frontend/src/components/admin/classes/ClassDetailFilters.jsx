import React from 'react';
import { Card, Col, Form, Row } from 'react-bootstrap';
import {
  ACTIVITY_TYPE_OPTIONS,
  CLASS_DETAIL_SEMESTER_OPTIONS,
  SORT_OPTIONS,
} from '../../../utils/classDetailHelpers';

export default function ClassDetailFilters({ filters, onFilterChange, onSearchChange }) {
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
              {CLASS_DETAIL_SEMESTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label>活動類型</Form.Label>
            <Form.Select
              value={filters.activityType}
              onChange={(e) => onFilterChange('activityType', e.target.value)}
            >
              {ACTIVITY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={4}>
            <Form.Label>搜尋學生</Form.Label>
            <Form.Control
              type="text"
              placeholder="輸入學號、姓名或系所..."
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </Col>
          <Col md={2}>
            <Form.Label>排序方式</Form.Label>
            <Form.Select
              value={filters.sortBy}
              onChange={(e) => onFilterChange('sortBy', e.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label>排序順序</Form.Label>
            <Form.Select
              value={filters.sortOrder}
              onChange={(e) => onFilterChange('sortOrder', e.target.value)}
            >
              <option value="asc">升序</option>
              <option value="desc">降序</option>
            </Form.Select>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}
