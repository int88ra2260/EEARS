import React from 'react';

export default function EnglishTestStatusModal({
  show,
  statusUpdate,
  onClose,
  onStatusChange,
  onNotesChange,
  onConfirm,
}) {
  if (!show) return null;

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">更新報名狀態</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">狀態</label>
              <select
                className="form-select"
                value={statusUpdate.status}
                onChange={(e) => onStatusChange(e.target.value)}
              >
                <option value="pending">審核中</option>
                <option value="approved">已通過</option>
                <option value="revision">請修正</option>
                <option value="success">報名成功</option>
                <option value="failed">報名失敗</option>
              </select>
            </div>
            {statusUpdate.status !== 'revision' && (
              <div className="mb-3">
                <label className="form-label">備註</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={statusUpdate.notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="可選填備註資訊"
                />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            {statusUpdate.status !== 'revision' && (
              <button type="button" className="btn btn-primary" onClick={onConfirm}>
                確認更新
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
