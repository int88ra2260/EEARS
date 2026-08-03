// components/admin/home/BatchAddEventsModal.js
// 批量新增活動 Modal：表單 UI 與 callbacks，API、驗證、parseDateString、refresh 保留在 AdminHome。

import React from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import dayjs from 'dayjs';
import LocationSelectField from '../LocationSelectField';
import EventCapacityFields from './EventCapacityFields';
import {
  getDefaultCapacityFields,
} from '../../../utils/eventCapacityFields';
import '../../../styles/admin-operations.css';

const createInitialEventRow = () => ({
  name: '',
  eventType: 'English Table',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  customEventType: '',
  customReservationRule: '',
  ...getDefaultCapacityFields('English Table'),
});

function normalizeBatchEventRow(event) {
  const eventType = event?.eventType || 'English Table';
  return {
    ...getDefaultCapacityFields(eventType),
    ...event,
    eventType,
  };
}

/**
 * @param {Object} props
 * @param {boolean} props.show
 * @param {Array} props.events - 批量活動陣列
 * @param {(events: Array) => void} props.onEventsChange
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {Object|null} props.result - { successCount, failureCount, errors? }
 * @param {() => void} props.onClose
 * @param {() => void} props.onSubmit
 * @param {boolean} props.showDatePicker
 * @param {string[]} props.selectedDates
 * @param {() => void} props.onOpenDatePicker
 * @param {() => void} props.onCloseDatePicker
 * @param {(dateStr: string) => void} props.onAddDate
 * @param {(dateStr: string) => void} props.onRemoveDate
 * @param {() => void} props.onClearDates
 * @param {() => void} props.onApplyDates
 * @param {(text: string) => void} props.onParseAndAddDates - parent 解析字串並加入 selectedDates、顯示 toast
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
  showDatePicker,
  selectedDates = [],
  onOpenDatePicker,
  onCloseDatePicker,
  onAddDate,
  onRemoveDate,
  onClearDates,
  onApplyDates,
  onParseAndAddDates
}) {
  const handleAddRow = () => {
    onEventsChange([...events, createInitialEventRow()]);
  };

  const handleRemoveRow = (index) => {
    if (events.length <= 1) return;
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

  const handleParseAndAdd = () => {
    const textarea = document.getElementById('batch-date-input');
    if (textarea && textarea.value) {
      onParseAndAddDates(textarea.value);
      textarea.value = '';
    }
  };

  const handleSingleDateAdd = () => {
    const input = document.getElementById('single-date-input');
    if (input && input.value) {
      onAddDate(input.value);
      input.value = '';
    }
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
        <div className="mb-3 d-flex align-items-center gap-2 flex-wrap">
          <Button variant="outline-primary" size="sm" onClick={handleAddRow}>
            + 新增一行
          </Button>
          <Button variant="outline-info" size="sm" onClick={onOpenDatePicker}>
            📅 批量選擇日期
          </Button>
          <small className="text-muted">可以一次新增多個活動，空行會被自動忽略</small>
        </div>

        {showDatePicker && (
          <div className="alert alert-info mb-3">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <strong>批量選擇日期</strong>
              <Button variant="link" size="sm" className="p-0" onClick={onCloseDatePicker}>
                ✕ 關閉
              </Button>
            </div>
            <p className="mb-2 small">請先在第一行填寫活動名稱、時間等資訊，然後選擇多個日期。系統會自動為每個日期創建一行活動。</p>

            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <Form.Label className="small">快速添加日期（支援多種格式）</Form.Label>
                <Form.Control
                  as="textarea"
                  rows="3"
                  id="batch-date-input"
                  placeholder={'例如：\n2025-03-01, 2025-03-02, 2025-03-03\n或：2025-03-01 到 2025-03-05（日期範圍）\n或：每行一個日期'}
                />
                <div className="d-flex gap-2 mt-1">
                  <Button variant="outline-primary" size="sm" onClick={handleParseAndAdd}>
                    解析並添加
                  </Button>
                  <Form.Text className="text-muted small align-self-center">
                    支援格式：逗號分隔、換行分隔、日期範圍（如：2025-03-01 到 2025-03-05）
                  </Form.Text>
                </div>
              </div>
              <div className="col-md-6">
                <Form.Label className="small">或選擇單個日期</Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control type="date" size="sm" id="single-date-input" />
                  <Button variant="outline-primary" size="sm" onClick={handleSingleDateAdd}>
                    添加
                  </Button>
                </div>
              </div>
            </div>

            {selectedDates.length > 0 && (
              <div className="mt-2">
                <Form.Label className="small">已選擇的日期 ({selectedDates.length} 個)：</Form.Label>
                <div className="d-flex flex-wrap gap-2 mt-1">
                  {selectedDates.map((date, idx) => (
                    <span key={idx} className="badge bg-primary d-flex align-items-center gap-1">
                      {dayjs(date).format('YYYY-MM-DD')}
                      <button
                        type="button"
                        className="btn-close btn-close-white"
                        style={{ fontSize: '0.6rem' }}
                        onClick={() => onRemoveDate(date)}
                        aria-label="移除"
                      />
                    </span>
                  ))}
                </div>
                <div className="mt-2">
                  <Button variant="success" size="sm" onClick={onApplyDates}>
                    應用日期（將創建 {selectedDates.length} 個活動）
                  </Button>
                  <Button variant="outline-secondary" size="sm" className="ms-2" onClick={onClearDates}>
                    清空選擇
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="batch-add-list" style={{ maxHeight: '520px', overflowY: 'auto' }}>
          {events.map((rawEvent, index) => {
            const event = normalizeBatchEventRow(rawEvent);
            return (
              <div className="batch-add-card" key={index}>
                <div className="batch-add-card__head">
                  <span className="batch-add-card__index">第 {index + 1} 筆</span>
                  {events.length > 1 && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleRemoveRow(index)}
                    >
                      刪除
                    </Button>
                  )}
                </div>

                <div className="batch-add-card__grid">
                  <div className="batch-add-field batch-add-field--name">
                    <label className="form-label">活動名稱 *</label>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={event.name}
                      onChange={(e) => handleUpdateEvent(index, 'name', e.target.value)}
                      placeholder="活動名稱"
                    />
                  </div>

                  <div className="batch-add-field">
                    <label className="form-label">活動類型 *</label>
                    <Form.Select
                      size="sm"
                      value={event.eventType}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        const defaults = getDefaultCapacityFields(nextType);
                        mergeRowFields(index, { eventType: nextType, ...defaults });
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
                    <label className="form-label">開始時間 *</label>
                    <Form.Control
                      type="time"
                      size="sm"
                      value={event.startTime}
                      onChange={(e) => handleUpdateEvent(index, 'startTime', e.target.value)}
                    />
                  </div>

                  <div className="batch-add-field">
                    <label className="form-label">結束時間 *</label>
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
                </div>
              </div>
            );
          })}
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
            {result.errors && result.errors.length > 0 && (
              <div className="mt-2">
                <strong>錯誤詳情：</strong>
                <ul className="mb-0">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          取消
        </Button>
        <Button variant="primary" onClick={onSubmit} disabled={loading}>
          {loading ? '新增中...' : '批量新增'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
