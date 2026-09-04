import React from 'react';
import { Button, Card, Form, InputGroup, Stack } from 'react-bootstrap';
import {
  MUST_RESET_FILTER_OPTIONS,
  ROLE_OPTIONS,
  STATUS_FILTER_OPTIONS,
  STAFF_LEVEL_FILTER_OPTIONS,
  SYSTEM_OVERRIDE_FILTER_OPTIONS,
  TEACHER_LEVEL_FILTER_OPTIONS,
  WORKER_LEVEL_FILTER_OPTIONS,
} from '../../../constants/accountManagement';

export default function AccountFiltersCard({
  filters,
  setFilters,
  searchInput,
  setSearchInput,
  filterSummary,
  loading,
  onClearFilters,
  onReload,
  roleFilterOptions = ROLE_OPTIONS,
  lockLeaderOnly = false,
}) {
  return (
    <Card className="border-0 shadow-sm mb-3">
      <Card.Header className="bg-white py-3 border-bottom">
        <div className="fw-semibold">篩選條件</div>
        <div className="text-muted small mt-1">{filterSummary}</div>
      </Card.Header>
      <Card.Body>
        <Stack direction="horizontal" gap={3} className="flex-wrap align-items-end">
          <div>
            <Form.Label className="small text-muted mb-1">角色</Form.Label>
            <Form.Select
              value={filters.role}
              disabled={lockLeaderOnly}
              onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
              style={{ minWidth: '132px' }}
            >
              {roleFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </div>
          <div>
            <Form.Label className="small text-muted mb-1">老師層級</Form.Label>
            <Form.Select
              value={filters.teacherLevel}
              disabled={lockLeaderOnly}
              onChange={(e) => setFilters((prev) => ({ ...prev, teacherLevel: e.target.value }))}
              style={{ minWidth: '148px' }}
            >
              {TEACHER_LEVEL_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </div>
          <div>
            <Form.Label className="small text-muted mb-1">行政職務</Form.Label>
            <Form.Select
              value={filters.staffLevel}
              disabled={lockLeaderOnly}
              onChange={(e) => setFilters((prev) => ({ ...prev, staffLevel: e.target.value }))}
              style={{ minWidth: '160px' }}
            >
              {STAFF_LEVEL_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </div>
          <div>
            <Form.Label className="small text-muted mb-1">工讀職務</Form.Label>
            <Form.Select
              value={filters.workerLevel}
              disabled={lockLeaderOnly}
              onChange={(e) => setFilters((prev) => ({ ...prev, workerLevel: e.target.value }))}
              style={{ minWidth: '160px' }}
            >
              {WORKER_LEVEL_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </div>
          <div>
            <Form.Label className="small text-muted mb-1">啟用狀態</Form.Label>
            <Form.Select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              style={{ minWidth: '120px' }}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </div>
          <div>
            <Form.Label className="small text-muted mb-1">改密碼</Form.Label>
            <Form.Select
              value={filters.mustResetPassword}
              onChange={(e) => setFilters((prev) => ({ ...prev, mustResetPassword: e.target.value }))}
              style={{ minWidth: '168px' }}
            >
              {MUST_RESET_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </div>
          <div>
            <Form.Label className="small text-muted mb-1">系統層級覆寫</Form.Label>
            <Form.Select
              value={filters.systemOverride}
              onChange={(e) => setFilters((prev) => ({ ...prev, systemOverride: e.target.value }))}
              style={{ minWidth: '168px' }}
            >
              {SYSTEM_OVERRIDE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </div>
          <div className="flex-grow-1" style={{ minWidth: 'min(100%, 280px)', maxWidth: '360px' }}>
            <Form.Label className="small text-muted mb-1">關鍵字（約 0.4 秒後送出搜尋）</Form.Label>
            <InputGroup>
              <InputGroup.Text className="text-muted bg-light">搜尋</InputGroup.Text>
              <Form.Control
                placeholder="姓名、帳號或 Email"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="搜尋姓名、帳號或 Email"
                autoComplete="off"
              />
            </InputGroup>
          </div>
          <Stack direction="horizontal" gap={2} className="ms-auto flex-wrap">
            <Button variant="outline-secondary" size="sm" onClick={onClearFilters}>
              清除篩選
            </Button>
            <Button variant="outline-primary" size="sm" onClick={onReload} disabled={loading}>
              重新載入
            </Button>
          </Stack>
        </Stack>
      </Card.Body>
    </Card>
  );
}
