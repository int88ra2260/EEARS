import React from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import {
  STAFF_LEVEL_OPTIONS,
  STAFF_LEVEL_SUMMARY,
  WORKER_LEVEL_OPTIONS,
  WORKER_LEVEL_SUMMARY,
} from '../../../constants/accountManagement';

export default function AccountCreateModal({
  show,
  onHide,
  createForm,
  roleChoicesForActor,
  teacherLevelChoicesForActor,
  saving,
  onInputChange,
  onSubmit,
}) {
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      dialogClassName="account-mgmt-modal-create"
    >
      <Modal.Header closeButton>
        <Modal.Title>新增帳號</Modal.Title>
      </Modal.Header>
      <Form onSubmit={onSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>姓名 *</Form.Label>
            <Form.Control
              value={createForm.name}
              onChange={(e) => onInputChange('name', e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>帳號 *</Form.Label>
            <Form.Control
              value={createForm.username}
              onChange={(e) => onInputChange('username', e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Email *</Form.Label>
            <Form.Control
              type="email"
              value={createForm.email}
              onChange={(e) => onInputChange('email', e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>角色</Form.Label>
            <Form.Select
              value={createForm.role}
              onChange={(e) => onInputChange('role', e.target.value)}
            >
              {roleChoicesForActor.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
          {createForm.role === 'teacher' && (
            <Form.Group className="mb-3">
              <Form.Label>老師層級</Form.Label>
              <Form.Select
                value={createForm.teacherLevel}
                onChange={(e) => onInputChange('teacherLevel', e.target.value)}
              >
                {teacherLevelChoicesForActor.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
          )}
          {createForm.role === 'leader' && (
            <Form.Group className="mb-3">
              <Form.Label>學號</Form.Label>
              <Form.Control
                value={createForm.studentId}
                onChange={(e) => onInputChange('studentId', e.target.value)}
                placeholder="建議填寫，方便對照學生身份"
              />
            </Form.Group>
          )}
          {createForm.role === 'office_staff' && (
            <Form.Group className="mb-3">
              <Form.Label>行政職務 <span className="text-danger">*</span></Form.Label>
              <Form.Select
                value={createForm.staffLevel}
                onChange={(e) => onInputChange('staffLevel', e.target.value)}
                required
              >
                {STAFF_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                活動／課務／培力／副理僅影響預設可見的後台模組與權限；細部可再透過覆寫調整。
              </Form.Text>
              <div className="mt-2 small text-muted">
                <div className="fw-semibold text-body">
                  {STAFF_LEVEL_SUMMARY[createForm.staffLevel || 'event_lead']?.description}
                </div>
                <div className="mt-1">
                  預設權限摘要：
                  {(STAFF_LEVEL_SUMMARY[createForm.staffLevel || 'event_lead']?.permissions || []).join('、')}
                </div>
              </div>
            </Form.Group>
          )}
          {createForm.role === 'worker' && (
            <Form.Group className="mb-3">
              <Form.Label>工讀職務 <span className="text-danger">*</span></Form.Label>
              <Form.Select
                value={createForm.workerLevel}
                onChange={(e) => onInputChange('workerLevel', e.target.value)}
                required
              >
                {WORKER_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                開帳號時須指定職務，預設權限會依職務分責；不含帳號管理與系統設定。
              </Form.Text>
              <div className="mt-2 small text-muted">
                <div className="fw-semibold text-body">
                  {WORKER_LEVEL_SUMMARY[createForm.workerLevel || 'event_ops']?.description}
                </div>
                <div className="mt-1">
                  預設權限摘要：
                  {(WORKER_LEVEL_SUMMARY[createForm.workerLevel || 'event_ops']?.permissions || []).join('、')}
                </div>
              </div>
            </Form.Group>
          )}
          <Form.Group className="mb-3">
            <Form.Label>系所/單位</Form.Label>
            <Form.Control
              value={createForm.department}
              onChange={(e) => onInputChange('department', e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>電話</Form.Label>
            <Form.Control
              value={createForm.phone}
              onChange={(e) => onInputChange('phone', e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>臨時密碼</Form.Label>
            <Form.Control
              type="password"
              placeholder="留空則自動產生"
              value={createForm.password}
              onChange={(e) => onInputChange('password', e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>取消</Button>
          <Button type="submit" disabled={saving}>
            {saving ? '建立中...' : '建立'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
