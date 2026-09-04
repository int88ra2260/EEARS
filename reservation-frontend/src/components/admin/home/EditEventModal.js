// components/admin/home/EditEventModal.js
// 編輯活動 Modal：表單 UI 與 callbacks，API 與驗證保留在 AdminHome。

import React from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import ErrorAlert from '../shared/ErrorAlert';
import LocationSelectField from '../LocationSelectField';
import EventCapacityFields from './EventCapacityFields';
import { getDefaultCapacityFields } from '../../../utils/eventCapacityFields';

/**
 * @param {Object} props
 * @param {boolean} props.show
 * @param {Object} props.event - 表單欄位 { eventId, name, eventType, date, startTime, endTime, maxParticipants, customEventType, customReservationRule }
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {() => void} props.onClose
 * @param {() => void} props.onSubmit
 * @param {(next: Object) => void} props.onFieldsChange
 */
export default function EditEventModal({
  show,
  event: fields,
  loading,
  error,
  onClose,
  onSubmit,
  onFieldsChange
}) {
  const setField = (key, value) => {
    if (key === 'eventType') {
      onFieldsChange({
        ...fields,
        eventType: value,
        ...getDefaultCapacityFields(value),
      });
      return;
    }
    onFieldsChange({ ...fields, [key]: value });
  };

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>編輯活動</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ErrorAlert error={error} />
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>活動名稱 *</Form.Label>
            <Form.Control
              type="text"
              value={fields.name || ''}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="請輸入活動名稱"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>活動類型 *</Form.Label>
            <Form.Select
              value={fields.eventType || ''}
              onChange={(e) => setField('eventType', e.target.value)}
            >
              <option value="English Table">English Table</option>
              <option value="English Club">English Club</option>
              <option value="Job Talk">Job Talk</option>
              <option value="International Forum">International Forum</option>
              <option value="其他">其他</option>
            </Form.Select>
          </Form.Group>

          {fields.eventType === '其他' && (
            <Form.Group className="mb-3">
              <Form.Label>自訂活動類型 *</Form.Label>
              <Form.Control
                type="text"
                value={fields.customEventType || ''}
                onChange={(e) => setField('customEventType', e.target.value)}
                placeholder="請輸入自訂活動類型"
              />
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>活動日期 *</Form.Label>
            <Form.Control
              type="date"
              value={fields.date || ''}
              onChange={(e) => setField('date', e.target.value)}
            />
          </Form.Group>

          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>開始時間 *</Form.Label>
                <Form.Control
                  type="time"
                  value={fields.startTime || ''}
                  onChange={(e) => setField('startTime', e.target.value)}
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>結束時間 *</Form.Label>
                <Form.Control
                  type="time"
                  value={fields.endTime || ''}
                  onChange={(e) => setField('endTime', e.target.value)}
                />
              </Form.Group>
            </div>
          </div>

          <div className="row">
            <EventCapacityFields
              eventType={fields.eventType}
              fields={fields}
              onFieldsChange={onFieldsChange}
              layout="stacked"
            />
          </div>

          <Form.Group className="mb-3">
            <LocationSelectField
              value={fields.location || ''}
              onChange={(location) => setField('location', location)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>備註</Form.Label>
            <Form.Control
              type="text"
              value={fields.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="實踐歷程檔案"
              maxLength={255}
            />
            <Form.Text muted>預設為「實踐歷程檔案」，可自行修改。</Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" onClick={onSubmit} disabled={loading}>
          {loading ? '更新中...' : '更新活動'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
