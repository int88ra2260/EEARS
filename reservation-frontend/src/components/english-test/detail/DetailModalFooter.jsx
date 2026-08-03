import React from 'react';
import DetailModalStatusDropdown from './DetailModalStatusDropdown';

export default function DetailModalFooter({
  mobile = false,
  registration,
  onClose,
  onQuickStatusUpdate,
  onUpdateRegistration,
  token,
  isEditing,
  handleStartEdit,
  handleSaveEdit,
  handleCancelEdit,
  statusDropdownProps,
  handleStatusChange,
  confirm,
}) {
  const sizeClass = mobile ? ' btn-sm' : '';

  return (
    <div className="modal-footer d-flex justify-content-between flex-wrap gap-2">
      <div className="d-flex gap-2 flex-wrap">
        <DetailModalStatusDropdown
          registration={registration}
          onQuickStatusUpdate={onQuickStatusUpdate}
          handleStatusChange={handleStatusChange}
          confirm={confirm}
          isMobile={mobile}
          {...statusDropdownProps}
        />
        {onUpdateRegistration && token && (
          <>
            {!isEditing ? (
              <button
                type="button"
                className={`btn btn-warning${sizeClass}`}
                onClick={handleStartEdit}
                title="後台管理員專用：修改報名資料"
              >
                <i className="fas fa-edit me-1"></i>
                <span className="badge bg-danger me-1">後台</span>
                {mobile ? '編輯' : '編輯資料'}
              </button>
            ) : (
              <>
                <button type="button" className={`btn btn-success${sizeClass}`} onClick={handleSaveEdit}>
                  <i className="fas fa-save me-1"></i>儲存
                </button>
                <button type="button" className={`btn btn-secondary${sizeClass}`} onClick={handleCancelEdit}>
                  <i className="fas fa-times me-1"></i>取消
                </button>
              </>
            )}
          </>
        )}
      </div>
      <button type="button" className={`btn btn-secondary${sizeClass}`} onClick={onClose}>
        關閉
      </button>
    </div>
  );
}
