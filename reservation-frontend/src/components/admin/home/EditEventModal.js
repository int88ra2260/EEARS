// components/admin/home/EditEventModal.js
// 編輯活動 Modal：表單 UI 與 callbacks，API 與驗證保留在 AdminHome。

import React from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import ErrorAlert from '../shared/ErrorAlert';
import LocationSelectField from '../LocationSelectField';
import EventCapacityFields from './EventCapacityFields';
import { getDefaultCapacityFields } from '../../../utils/eventCapacityFields';
import {
  getEventTypeDisplayName,
  getEventTypeSelectOptions,
  normalizeEventTypeCode,
} from '../../../constants/eventTypeCatalog';

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
  onFieldsChange,
  eventTypeOptions,
  resolveTypeConfig,
}) {
  const options = eventTypeOptions?.length
    ? eventTypeOptions
    : getEventTypeSelectOptions({ includeOther: true });
  const typeConfig = typeof resolveTypeConfig === 'function'
    ? resolveTypeConfig(fields.eventType)
    : null;
  const optionValues = new Set(options.map((o) => o.value));

  const setField = (key, value) => {
    if (key === 'eventType') {
      const cfg = typeof resolveTypeConfig === 'function' ? resolveTypeConfig(value) : null;
      onFieldsChange({
        ...fields,
        eventType: value,
        ...getDefaultCapacityFields(value, cfg),
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
              value={
                fields.eventType === '其他'
                  ? '其他'
                  : (optionValues.has(fields.eventType)
                    ? fields.eventType
                    : (normalizeEventTypeCode(fields.eventType) || fields.eventType || ''))
              }
              onChange={(e) => setField('eventType', e.target.value)}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
              {fields.eventType
                && fields.eventType !== '其他'
                && !optionValues.has(fields.eventType)
                && !normalizeEventTypeCode(fields.eventType) && (
                <option value={fields.eventType}>
                  {getEventTypeDisplayName(fields.eventType)}（未對應）
                </option>
              )}
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
              typeConfig={typeConfig}
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
