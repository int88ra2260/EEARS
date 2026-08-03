import React from 'react';
import { Card, Col, Form, Row } from 'react-bootstrap';
import {
  CLASS_OVERVIEW_SEMESTER_OPTIONS,
  CLASS_OVERVIEW_SORT_OPTIONS,
} from '../../../utils/classOverviewImportHelpers';

export default function ClassOverviewFilters({
  filters,
  onFilterChange,
  onSearchChange,
  onTeacherNameChange,
  onStudentIdChange,
}) {
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
              {CLASS_OVERVIEW_SEMESTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label>搜尋班級</Form.Label>
            <Form.Control
              type="text"
              placeholder="輸入班級名稱..."
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </Col>
          <Col md={2}>
            <Form.Label>老師姓名</Form.Label>
            <Form.Control
              type="text"
              placeholder="輸入老師姓名..."
              onChange={(e) => onTeacherNameChange(e.target.value)}
            />
          </Col>
          <Col md={2}>
            <Form.Label>學號</Form.Label>
            <Form.Control
              type="text"
              placeholder="輸入學號..."
              onChange={(e) => onStudentIdChange(e.target.value)}
            />
          </Col>
          <Col md={2}>
            <Form.Label>排序方式</Form.Label>
            <Form.Select
              value={filters.sortBy}
              onChange={(e) => onFilterChange('sortBy', e.target.value)}
            >
              {CLASS_OVERVIEW_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label>排序順序</Form.Label>
            <Form.Select
              value={filters.sortOrder}
              onChange={(e) => onFilterChange('sortOrder', e.target.value)}
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </Form.Select>
          </Col>
          <Col md={1}>
            <Form.Label>每頁筆數</Form.Label>
            <Form.Select
              value={filters.pageSize}
              onChange={(e) => onFilterChange('pageSize', parseInt(e.target.value, 10))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </Form.Select>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}
