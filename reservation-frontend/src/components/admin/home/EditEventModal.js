// components/admin/home/EditEventModal.js
// 編輯活動 Modal：表單 UI 與 callbacks，API 與驗證保留在 AdminHome。

import React from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import ErrorAlert from '../shared/ErrorAlert';
import LocationSelectField from '../LocationSelectField';
import EventCapacityFields from './EventCapacityFields';
import Time24Input from './Time24Input';
import { getDefaultCapacityFields } from '../../../utils/eventCapacityFields';
import {
  CAPACITY_MODES,
  getDefaultTypeConfig,
  getEventTypeDisplayName,
  getEventTypeSelectOptions,
  isOtherEventType,
  normalizeEventTypeCode,
} from '../../../constants/eventTypeCatalog';
import { DEFAULT_OTHER_OPEN_RULE_FIELDS } from '../../../utils/otherEventForm';
import OtherEventOpenRuleFields, { StudentHiddenField } from './OtherEventOpenRuleFields';

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
  const isOther = isOtherEventType(fields.eventType);
  const otherConfig = isOther ? (typeConfig || getDefaultTypeConfig('other')) : null;
  const selectedType = isOther
    ? 'other'
    : (optionValues.has(fields.eventType)
      ? fields.eventType
      : (normalizeEventTypeCode(fields.eventType) || fields.eventType || ''));

  const setField = (key, value) => {
    if (key === 'eventType') {
      const cfg = typeof resolveTypeConfig === 'function' ? resolveTypeConfig(value) : null;
      const becomingOther = isOtherEventType(value);
      const wasOther = isOtherEventType(fields.eventType);
      onFieldsChange({
        ...fields,
        eventType: value,
        ...(becomingOther && !wasOther ? DEFAULT_OTHER_OPEN_RULE_FIELDS : {}),
        ...(!becomingOther ? { capacityMode: undefined } : {}),
        ...getDefaultCapacityFields(
          value,
          cfg,
          becomingOther ? (wasOther ? fields.capacityMode : CAPACITY_MODES.SIMPLE) : undefined,
        ),
      });
      return;
    }
    onFieldsChange({ ...fields, [key]: value });
  };

  const handleCapacityModeChange = (mode) => {
    onFieldsChange({
      ...fields,
      capacityMode: mode,
      ...getDefaultCapacityFields(fields.eventType, typeConfig, mode),
    });
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
              value={selectedType}
              onChange={(e) => setField('eventType', e.target.value)}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
              {fields.eventType
                && !isOther
                && !optionValues.has(fields.eventType)
                && !normalizeEventTypeCode(fields.eventType) && (
                <option value={fields.eventType}>
                  {getEventTypeDisplayName(fields.eventType)}（未對應）
                </option>
              )}
            </Form.Select>
          </Form.Group>

          {isOther && (
            <Form.Group className="mb-3">
              <Form.Label>名額方式 *</Form.Label>
              <Form.Select
                value={fields.capacityMode === CAPACITY_MODES.GROUPED ? CAPACITY_MODES.GROUPED : CAPACITY_MODES.SIMPLE}
                onChange={(e) => handleCapacityModeChange(e.target.value)}
              >
                <option value={CAPACITY_MODES.SIMPLE}>總人數</option>
                <option value={CAPACITY_MODES.GROUPED}>分組（組數 × 每組人數）</option>
              </Form.Select>
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
                <Time24Input
                  value={fields.startTime || ''}
                  onChange={(value) => setField('startTime', value)}
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>結束時間 *</Form.Label>
                <Time24Input
                  value={fields.endTime || ''}
                  onChange={(value) => setField('endTime', value)}
                />
              </Form.Group>
            </div>
          </div>

          <div className="row">
            <EventCapacityFields
              eventType={fields.eventType}
              typeConfig={isOther
                ? {
                  ...(otherConfig || {}),
                  capacityMode: fields.capacityMode === CAPACITY_MODES.GROUPED
                    ? CAPACITY_MODES.GROUPED
                    : CAPACITY_MODES.SIMPLE,
                }
                : typeConfig}
              fields={fields}
              onFieldsChange={onFieldsChange}
              layout="stacked"
            />
          </div>

          {isOther && (
            <OtherEventOpenRuleFields
              fields={fields}
              onChange={onFieldsChange}
              cutoffHours={Number(otherConfig?.cutoffHours) || 2}
            />
          )}

          <StudentHiddenField
            id="edit-event-hidden-from-students"
            checked={fields.hiddenFromStudents}
            onChange={(checked) => setField('hiddenFromStudents', checked)}
          />

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
              placeholder="選填"
              maxLength={255}
            />
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
