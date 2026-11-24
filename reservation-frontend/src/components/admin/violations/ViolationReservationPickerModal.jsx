import React from 'react';
import { Alert, Button, Form, Modal, Table } from 'react-bootstrap';
import { getEventDisplayName } from '../../../constants/eventTypes';

const VIOLATION_TYPE_OPTIONS = [
  { value: '預約未到', label: '預約未到' },
  { value: '擾亂秩序', label: '擾亂秩序' },
  { value: '未遵守規定', label: '未遵守規定' },
  { value: '無故缺席', label: '無故缺席' },
  { value: '其他', label: '其他' },
];

function formatEventDate(value) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.replace(/-/g, '/').slice(0, 10);
}

function formatClock(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, 5);
}

function formatTimeRange(row) {
  const start = formatClock(row.startTime);
  const end = formatClock(row.endTime);
  if (start && end) return `${start}–${end}`;
  return start || end || '—';
}

export default function ViolationReservationPickerModal({
  show,
  student,
  semester,
  reservations,
  selectedReservationId,
  violationType,
  description,
  loading,
  error,
  onSelectReservation,
  onViolationTypeChange,
  onDescriptionChange,
  onClose,
  onSubmit,
}) {
  const rows = Array.isArray(reservations) ? reservations : [];
  const selectableCount = rows.filter((row) => row.selectable).length;
  const selected = rows.find((row) => String(row.reservationId) === String(selectedReservationId));
  const canSubmit = Boolean(selected?.selectable) && !loading;

  return (
    <Modal
      show={show}
      onHide={() => {
        if (!loading) onClose();
      }}
      centered
      size="lg"
      backdrop={loading ? 'static' : true}
      keyboard={!loading}
    >
      <Modal.Header closeButton={!loading}>
        <Modal.Title>選擇要登記的預約</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          <span className="fw-semibold">{student?.studentId} {student?.name}</span>
          {semester ? <span className="text-muted"> · {semester}</span> : null}
        </p>
        <p className="small text-muted">
          列出當學期、而且你有權限登記的預約。已登記違規的列不能再選。送出後會寫入該活動的違規紀錄，並把這筆預約標成已登記違規。當學期黑名單次數會在該活動結束檢查時計入。
        </p>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {rows.length === 0 ? (
          <Alert variant="light" className="border mb-0">
            此學生在當學期沒有你可以登記的預約。
          </Alert>
        ) : (
          <>
            <div className="table-responsive">
              <Table bordered size="sm" className="mb-3 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: '4rem' }}>選擇</th>
                    <th>活動日期</th>
                    <th>時段</th>
                    <th>活動類型</th>
                    <th>活動名稱</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const inputId = `violation-reservation-${row.reservationId}`;
                    return (
                      <tr key={row.reservationId}>
                        <td>
                          {row.selectable ? (
                            <Form.Check
                              type="radio"
                              id={inputId}
                              name="violation-reservation"
                              checked={String(selectedReservationId) === String(row.reservationId)}
                              onChange={() => onSelectReservation(row.reservationId)}
                              aria-label={`${formatEventDate(row.eventDate)} ${row.eventName || ''}`}
                              disabled={loading}
                            />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{formatEventDate(row.eventDate)}</td>
                        <td>{formatTimeRange(row)}</td>
                        <td>{getEventDisplayName(row.eventType) || '—'}</td>
                        <td>{row.eventName || '—'}</td>
                        <td>{row.checkinStatus || '未簽到'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            {selectableCount === 0 ? (
              <Alert variant="light" className="border">
                這些預約都已登記違規。
              </Alert>
            ) : (
              <>
                <Form.Group className="mb-3">
                  <Form.Label htmlFor="violation-type">違規類型</Form.Label>
                  <Form.Select
                    id="violation-type"
                    value={violationType}
                    onChange={(e) => onViolationTypeChange(e.target.value)}
                    disabled={loading}
                  >
                    {VIOLATION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-0">
                  <Form.Label htmlFor="violation-description">說明</Form.Label>
                  <Form.Control
                    id="violation-description"
                    as="textarea"
                    rows={2}
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    placeholder="選填。類型為「其他」時請寫明原因。"
                    disabled={loading}
                  />
                </Form.Group>
              </>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          關閉
        </Button>
        <Button variant="danger" onClick={onSubmit} disabled={!canSubmit}>
          {loading ? '登記中...' : '登記違規'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
