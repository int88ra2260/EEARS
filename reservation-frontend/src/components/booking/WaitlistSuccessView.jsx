import React from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getEventLocationDisplay } from '../../utils/eventLocation';

export default function WaitlistSuccessView({ event, studentEmail, position, onClose }) {
  const navigate = useNavigate();
  const safeEvent = event || {};
  const eventName = safeEvent.name || '（未提供活動名稱）';
  const eventDate = safeEvent.date || '（未提供日期）';
  const eventStart = safeEvent.startTime || '--:--';
  const eventEnd = safeEvent.endTime || '--:--';
  const locationLabel = getEventLocationDisplay(safeEvent) || '（未提供地點）';
  const emailLabel = studentEmail || '您填寫的 Email';
  const posLabel = position != null ? String(position) : '—';

  const handleBackToActivities = () => {
    if (typeof onClose === 'function') onClose();
    navigate('/events');
  };

  return (
    <div>
      <div className="d-flex align-items-start gap-2">
        <div
          className="rounded-circle d-flex align-items-center justify-content-center"
          style={{ width: 44, height: 44, backgroundColor: '#0d6efd', color: 'white' }}
        >
          <i className="fas fa-list-ol" />
        </div>
        <div>
          <h4 className="mb-1">已加入候補名單</h4>
          <p className="text-muted mb-0">目前候補順位：第 {posLabel} 位</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="alert alert-info mb-3">
          <strong>活動資訊：</strong>
          <div className="mt-2">
            <div>
              <strong>活動名稱：</strong> {eventName}
            </div>
            <div>
              <strong>日期：</strong> {eventDate}
            </div>
            <div>
              <strong>時間：</strong> {eventStart} - {eventEnd}
            </div>
            <div>
              <strong>地點：</strong> {locationLabel}
            </div>
          </div>
        </div>

        <div className="alert alert-secondary mb-0">
          <p className="mb-2">
            若有學員取消正式預約，系統將依候補順序自動轉正，並寄送<strong>正式預約通知</strong>至 {emailLabel}。
          </p>
          <p className="mb-0 text-muted small">
            取消正式預約須遵守「活動開始前 2 小時」規則；轉正後亦同。
          </p>
        </div>
      </div>

      <div className="mt-3 d-flex flex-column flex-sm-row gap-2">
        <Button variant="primary" onClick={handleBackToActivities}>
          返回活動列表
        </Button>
        <Button variant="outline-secondary" onClick={onClose}>
          關閉
        </Button>
      </div>
    </div>
  );
}
