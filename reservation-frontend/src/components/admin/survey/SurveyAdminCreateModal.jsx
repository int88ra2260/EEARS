import React from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

export default function SurveyAdminCreateModal({
  show,
  form,
  submitting,
  onHide,
  onChange,
  onSubmit,
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>新增問卷</Modal.Title>
      </Modal.Header>
      <Modal.Body className="row g-2">
        <div className="col-12">
          <Form.Label>問卷名稱 <span className="text-danger">*</span></Form.Label>
          <Form.Control
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="例如：English Table 回饋問卷（114-1）"
          />
        </div>
        <div className="col-12">
          <Form.Label>問卷代碼 <span className="text-danger">*</span></Form.Label>
          <Form.Control
            value={form.surveyKey}
            onChange={(e) => onChange({ ...form, surveyKey: e.target.value })}
            placeholder="english_table_feedback_114_1"
          />
          <Form.Text className="text-muted">
            系統用來辨識問卷的唯一代碼，建議小寫英文與底線，建立後不宜隨意更改。
          </Form.Text>
        </div>
        <div className="col-12">
          <Form.Label>說明（選填）</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
          />
        </div>
        <div className="col-6">
          <Form.Label>分類（選填）</Form.Label>
          <Form.Control
            value={form.category}
            onChange={(e) => onChange({ ...form, category: e.target.value })}
          />
        </div>
        <div className="col-6">
          <Form.Label>對象類型（選填）</Form.Label>
          <Form.Control
            value={form.targetType}
            onChange={(e) => onChange({ ...form, targetType: e.target.value })}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={submitting}>取消</Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? '建立中…' : '建立'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
