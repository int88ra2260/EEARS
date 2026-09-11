// components/admin/home/BatchAddEventsModal.js
// 批量新增：共用設定 + 多時段 + 月曆多選日期 → 產生活動清單

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import dayjs from 'dayjs';
import LocationSelectField from '../LocationSelectField';
import EventCapacityFields from './EventCapacityFields';
import {
  getDefaultCapacityFields,
} from '../../../utils/eventCapacityFields';
import { saveCapacityPrefs } from '../../../utils/eventCapacityPrefs';
import '../../../styles/admin-operations.css';

const DEFAULT_EVENT_NOTES = '實踐歷程檔案';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function createInitialTemplate() {
  return {
    name: '',
    eventType: 'English Table',
    location: '',
    notes: DEFAULT_EVENT_NOTES,
    ...getDefaultCapacityFields('English Table'),
  };
}

function createEmptySlot(overrides = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startTime: '',
    endTime: '',
    ...overrides,
  };
}

function normalizeBatchEventRow(event) {
  const eventType = event?.eventType || 'English Table';
  return {
    ...getDefaultCapacityFields(eventType),
    ...event,
    eventType,
  };
}

function MultiDateCalendar({ selectedDates, onToggleDate }) {
  const [cursor, setCursor] = useState(() => dayjs().startOf('month'));
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const cells = useMemo(() => {
    const start = cursor.startOf('month');
    // dayjs: 0=Sun ... convert to Mon-first grid
    const mondayIndex = (start.day() + 6) % 7;
    const daysInMonth = cursor.daysInMonth();
    const list = [];
    for (let i = 0; i < mondayIndex; i += 1) list.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      list.push(cursor.date(d).format('YYYY-MM-DD'));
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor]);

  return (
    <div className="batch-date-calendar">
      <div className="batch-date-calendar__nav">
        <Button
          variant="outline-secondary"
          size="sm"
          type="button"
          onClick={() => setCursor((c) => c.subtract(1, 'month'))}
        >
          ‹
        </Button>
        <strong>{cursor.format('YYYY年 M月')}</strong>
        <Button
          variant="outline-secondary"
          size="sm"
          type="button"
          onClick={() => setCursor((c) => c.add(1, 'month'))}
        >
          ›
        </Button>
      </div>
      <div className="batch-date-calendar__weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="batch-date-calendar__weekday">{w}</div>
        ))}
      </div>
      <div className="batch-date-calendar__grid">
        {cells.map((dateStr, idx) => {
          if (!dateStr) {
            return <div key={`e-${idx}`} className="batch-date-calendar__cell is-empty" />;
          }
          const selected = selectedSet.has(dateStr);
          const isToday = dateStr === dayjs().format('YYYY-MM-DD');
          return (
            <button
              key={dateStr}
              type="button"
              className={`batch-date-calendar__cell${selected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
              onClick={() => onToggleDate(dateStr)}
            >
              {dayjs(dateStr).date()}
            </button>
          );
        })}
      </div>
      <div className="small text-muted mt-2">點選日期可多選／取消；深色表示已選。</div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {boolean} props.show
 * @param {Array} props.events
 * @param {(events: Array) => void} props.onEventsChange
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {Object|null} props.result
 * @param {() => void} props.onClose
 * @param {() => void} props.onSubmit
 */
export default function BatchAddEventsModal({
  show,
  events = [],
  onEventsChange,
  loading,
  error,
  result,
  onClose,
  onSubmit,
}) {
  const [template, setTemplate] = useState(createInitialTemplate);
  const [timeSlots, setTimeSlots] = useState(() => [createEmptySlot()]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [generateError, setGenerateError] = useState('');

  useEffect(() => {
    if (!show) return;
    setTemplate(createInitialTemplate());
    setTimeSlots([createEmptySlot()]);
    setSelectedDates([]);
    setGenerateError('');
  }, [show]);

  const expectedCount = selectedDates.length * timeSlots.filter((s) => s.startTime && s.endTime).length;

  const updateTemplate = (field, value) => {
    setTemplate((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'eventType') {
        Object.assign(next, getDefaultCapacityFields(value));
      }
      return next;
    });
  };

  const mergeTemplateCapacity = (nextFields) => {
    setTemplate((prev) => {
      const next = {
        ...prev,
        groupCount: nextFields.groupCount,
        perGroupCapacity: nextFields.perGroupCapacity,
        maxParticipants: nextFields.maxParticipants,
      };
      saveCapacityPrefs({ ...next, eventType: next.eventType });
      return next;
    });
  };

  const toggleDate = (dateStr) => {
    setSelectedDates((current) => {
      if (current.includes(dateStr)) return current.filter((d) => d !== dateStr);
      return [...current, dateStr].sort();
    });
  };

  const updateSlot = (id, field, value) => {
    setTimeSlots((slots) => slots.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const addSlot = () => {
    setTimeSlots((slots) => [...slots, createEmptySlot()]);
  };

  const removeSlot = (id) => {
    setTimeSlots((slots) => (slots.length <= 1 ? slots : slots.filter((s) => s.id !== id)));
  };

  const handleGenerate = () => {
    setGenerateError('');
    if (!template.name.trim()) {
      setGenerateError('請先填寫活動名稱');
      return;
    }
    if (selectedDates.length === 0) {
      setGenerateError('請在月曆上至少選擇一個日期');
      return;
    }
    const validSlots = timeSlots.filter((s) => s.startTime && s.endTime);
    if (validSlots.length === 0) {
      setGenerateError('請至少填寫一個完整時段（開始／結束時間）');
      return;
    }
    for (const slot of validSlots) {
      if (slot.endTime <= slot.startTime) {
        setGenerateError(`時段 ${slot.startTime}–${slot.endTime} 的結束時間須晚於開始時間`);
        return;
      }
    }

    const rows = [];
    selectedDates.forEach((date) => {
      validSlots.forEach((slot) => {
        rows.push({
          name: template.name.trim(),
          eventType: template.eventType,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          location: template.location || '',
          notes: template.notes ?? DEFAULT_EVENT_NOTES,
          groupCount: template.groupCount,
          perGroupCapacity: template.perGroupCapacity,
          maxParticipants: template.maxParticipants,
          customEventType: '',
          customReservationRule: '',
        });
      });
    });

    saveCapacityPrefs(template);
    onEventsChange(rows);
    setGenerateError('');
  };

  const handleRemoveRow = (index) => {
    if (events.length <= 1) {
      onEventsChange([]);
      return;
    }
    onEventsChange(events.filter((_, i) => i !== index));
  };

  const handleUpdateEvent = (index, field, value) => {
    const updated = [...events];
    updated[index] = { ...updated[index], [field]: value };
    onEventsChange(updated);
  };

  const mergeRowFields = (index, patch) => {
    const updated = [...events];
    updated[index] = { ...updated[index], ...patch };
    onEventsChange(updated);
  };

  return (
    <Modal
      show={show}
      onHide={() => {
        if (!loading) onClose();
      }}
      size="xl"
    >
      <Modal.Header closeButton>
        <Modal.Title>批量新增活動</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="batch-add-setup mb-3">
          <h6 className="fw-semibold mb-2">1. 共用設定</h6>
          <div className="row g-2 mb-2">
            <div className="col-md-4">
              <Form.Label className="small mb-0">活動名稱 *</Form.Label>
              <Form.Control
                size="sm"
                value={template.name}
                onChange={(e) => updateTemplate('name', e.target.value)}
                placeholder="活動名稱"
              />
            </div>
            <div className="col-md-3">
              <Form.Label className="small mb-0">活動類型 *</Form.Label>
              <Form.Select
                size="sm"
                value={template.eventType}
                onChange={(e) => updateTemplate('eventType', e.target.value)}
              >
                <option value="English Table">English Table</option>
                <option value="Job Talk">Job Talk</option>
                <option value="English Club">English Club</option>
                <option value="International Forum">International Forum</option>
              </Form.Select>
            </div>
            <div className="col-md-5">
              <LocationSelectField
                label="活動地點"
                size="sm"
                value={template.location || ''}
                onChange={(location) => updateTemplate('location', location)}
              />
            </div>
          </div>

          <div className="mb-2">
            <EventCapacityFields
              eventType={template.eventType}
              fields={template}
              size="sm"
              layout="labeled"
              onFieldsChange={mergeTemplateCapacity}
            />
            <div className="small text-muted mt-1">組數／人數會記住上次使用的數值。</div>
          </div>

          <Form.Label className="small mb-1">備註</Form.Label>
          <Form.Control
            size="sm"
            className="mb-3"
            value={template.notes ?? ''}
            maxLength={255}
            placeholder="實踐歷程檔案"
            onChange={(e) => updateTemplate('notes', e.target.value)}
          />

          <div className="d-flex align-items-center justify-content-between mb-1">
            <Form.Label className="small mb-0">時段 *（同一天可上／下午多場）</Form.Label>
            <Button variant="outline-primary" size="sm" type="button" onClick={addSlot}>
              + 新增時段
            </Button>
          </div>
          {timeSlots.map((slot, idx) => (
            <div key={slot.id} className="d-flex flex-wrap align-items-end gap-2 mb-2">
              <div>
                <Form.Label className="small mb-0">時段 {idx + 1} 開始</Form.Label>
                <Form.Control
                  type="time"
                  size="sm"
                  value={slot.startTime}
                  onChange={(e) => updateSlot(slot.id, 'startTime', e.target.value)}
                />
              </div>
              <div>
                <Form.Label className="small mb-0">結束</Form.Label>
                <Form.Control
                  type="time"
                  size="sm"
                  value={slot.endTime}
                  onChange={(e) => updateSlot(slot.id, 'endTime', e.target.value)}
                />
              </div>
              {timeSlots.length > 1 && (
                <Button variant="outline-danger" size="sm" type="button" onClick={() => removeSlot(slot.id)}>
                  刪除時段
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="row g-3 mb-3">
          <div className="col-lg-5">
            <h6 className="fw-semibold mb-2">2. 月曆多選日期</h6>
            <MultiDateCalendar selectedDates={selectedDates} onToggleDate={toggleDate} />
          </div>
          <div className="col-lg-7">
            <h6 className="fw-semibold mb-2">已選日期（{selectedDates.length}）</h6>
            {selectedDates.length === 0 ? (
              <div className="text-muted small">尚未選擇日期，請點月曆上的日期。</div>
            ) : (
              <div className="d-flex flex-wrap gap-2 mb-2">
                {selectedDates.map((date) => (
                  <span key={date} className="badge bg-primary d-flex align-items-center gap-1">
                    {date}
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      style={{ fontSize: '0.6rem' }}
                      onClick={() => toggleDate(date)}
                      aria-label="移除"
                    />
                  </span>
                ))}
              </div>
            )}
            <Button variant="success" size="sm" type="button" onClick={handleGenerate}>
              產生清單
              {expectedCount > 0 ? `（約 ${expectedCount} 筆＝${selectedDates.length} 日 × 時段）` : ''}
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              type="button"
              className="ms-2"
              onClick={() => setSelectedDates([])}
              disabled={!selectedDates.length}
            >
              清空日期
            </Button>
            {generateError && <div className="text-danger small mt-2">{generateError}</div>}
          </div>
        </div>

        <h6 className="fw-semibold mb-2">3. 活動清單（{events.length} 筆）</h6>
        <div className="batch-add-list" style={{ maxHeight: '360px', overflowY: 'auto' }}>
          {events.length === 0 ? (
            <div className="text-muted small border rounded p-3">
              產生清單後會顯示在這裡，可再微調單筆日期／時間後送出。
            </div>
          ) : (
            events.map((rawEvent, index) => {
              const event = normalizeBatchEventRow(rawEvent);
              return (
                <div className="batch-add-card" key={`${event.date}-${event.startTime}-${index}`}>
                  <div className="batch-add-card__head">
                    <span className="batch-add-card__index">第 {index + 1} 筆</span>
                    <Button variant="outline-danger" size="sm" onClick={() => handleRemoveRow(index)}>
                      刪除
                    </Button>
                  </div>
                  <div className="batch-add-card__grid">
                    <div className="batch-add-field batch-add-field--name">
                      <label className="form-label">活動名稱 *</label>
                      <Form.Control
                        type="text"
                        size="sm"
                        value={event.name}
                        onChange={(e) => handleUpdateEvent(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="batch-add-field">
                      <label className="form-label">類型 *</label>
                      <Form.Select
                        size="sm"
                        value={event.eventType}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          mergeRowFields(index, {
                            eventType: nextType,
                            ...getDefaultCapacityFields(nextType),
                          });
                        }}
                      >
                        <option value="English Table">English Table</option>
                        <option value="Job Talk">Job Talk</option>
                        <option value="English Club">English Club</option>
                        <option value="International Forum">International Forum</option>
                      </Form.Select>
                    </div>
                    <div className="batch-add-field">
                      <label className="form-label">日期 *</label>
                      <Form.Control
                        type="date"
                        size="sm"
                        value={event.date}
                        onChange={(e) => handleUpdateEvent(index, 'date', e.target.value)}
                      />
                    </div>
                    <div className="batch-add-field">
                      <label className="form-label">開始 *</label>
                      <Form.Control
                        type="time"
                        size="sm"
                        value={event.startTime}
                        onChange={(e) => handleUpdateEvent(index, 'startTime', e.target.value)}
                      />
                    </div>
                    <div className="batch-add-field">
                      <label className="form-label">結束 *</label>
                      <Form.Control
                        type="time"
                        size="sm"
                        value={event.endTime}
                        onChange={(e) => handleUpdateEvent(index, 'endTime', e.target.value)}
                      />
                    </div>
                    <div className="batch-add-field batch-add-field--capacity">
                      <EventCapacityFields
                        eventType={event.eventType}
                        fields={event}
                        size="sm"
                        layout="labeled"
                        onFieldsChange={(nextFields) => {
                          mergeRowFields(index, {
                            groupCount: nextFields.groupCount,
                            perGroupCapacity: nextFields.perGroupCapacity,
                            maxParticipants: nextFields.maxParticipants,
                          });
                          saveCapacityPrefs({ ...event, ...nextFields });
                        }}
                      />
                    </div>
                    <div className="batch-add-field batch-add-field--location">
                      <LocationSelectField
                        label="活動地點"
                        size="sm"
                        value={event.location || ''}
                        onChange={(location) => handleUpdateEvent(index, 'location', location)}
                      />
                    </div>
                    <div className="batch-add-field batch-add-field--notes">
                      <label className="form-label">備註</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={event.notes ?? ''}
                        maxLength={255}
                        onChange={(e) => handleUpdateEvent(index, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && (
          <div className="alert alert-danger mt-3">
            <strong>錯誤：</strong>
            <pre style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{error}</pre>
          </div>
        )}

        {result && (
          <div className="alert alert-success mt-3">
            <strong>成功！</strong>
            <p className="mb-0">
              成功新增 {result.successCount} 個活動
              {result.failureCount > 0 && (
                <span className="text-warning">，失敗 {result.failureCount} 個</span>
              )}
            </p>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button variant="primary" onClick={onSubmit} disabled={loading || events.length === 0}>
          {loading ? '新增中...' : `批量新增${events.length ? `（${events.length}）` : ''}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
