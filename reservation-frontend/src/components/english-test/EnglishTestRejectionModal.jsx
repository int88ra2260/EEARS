import React from 'react';
import { rejectionReasonOptions } from '../../constants/englishTestRejectionReasons';

export default function EnglishTestRejectionModal({
  show,
  pendingStatusUpdate,
  rejectionReasons,
  rejectionOther,
  onClose,
  onReasonChange,
  onOtherChange,
  onConfirm,
}) {
  if (!show) return null;

  const isFailed = pendingStatusUpdate === 'failed';

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-danger text-white">
            <h5 className="modal-title">
              {isFailed ? '選擇報名失敗原因（可複選）' : '選擇拒絕原因（可複選）'}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="alert alert-warning">
              <strong>注意：</strong>
              {isFailed
                ? '切換至「報名失敗」狀態時，必須至少選擇一個原因，通知信將一併附上原因。'
                : '切換至「請修正」狀態時，必須至少選擇一個拒絕原因。'}
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">
                {isFailed ? '請選擇報名失敗原因（可複選）：' : '請選擇拒絕原因（可複選）：'}
              </label>
              <div className="mt-2">
                {rejectionReasonOptions.map((option) => (
                  <div key={option.id} className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`rejection-${option.id}`}
                      checked={rejectionReasons.includes(option.id)}
                      onChange={() => onReasonChange(option.id)}
                    />
                    <label className="form-check-label" htmlFor={`rejection-${option.id}`}>
                      {option.text}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            {rejectionReasons.includes('其他') && (
              <div className="mb-3">
                <label className="form-label fw-bold">其他原因說明：</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={rejectionOther}
                  onChange={(e) => onOtherChange(e.target.value)}
                  placeholder="請詳細說明拒絕原因"
                  required
                />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="button" className="btn btn-danger" onClick={onConfirm}>
              {isFailed ? '確認設為報名失敗' : '確認拒絕'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
