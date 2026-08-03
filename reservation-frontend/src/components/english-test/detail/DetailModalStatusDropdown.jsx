import React from 'react';
import { DETAIL_MODAL_STATUS_OPTIONS } from './detailModalConstants';

export default function DetailModalStatusDropdown({
  registration,
  onQuickStatusUpdate,
  showStatusDropdown,
  setShowStatusDropdown,
  dropdownPosition,
  statusDropdownRef,
  statusDropdownButtonRef,
  handleStatusChange,
  confirm,
  isMobile,
}) {
  if (!onQuickStatusUpdate) return null;

  const handleOptionClick = (option) => {
    if (!option.confirmDescription) {
      handleStatusChange(option.status);
      return;
    }

    confirm({
      title: '確認更新狀態？',
      description: option.confirmDescription,
      confirmText: '更新',
      cancelText: '取消',
      variant: 'warning',
    }).then((ok) => {
      if (!ok) return;
      handleStatusChange(option.status);
    });
  };

  return (
    <div className="dropdown" ref={statusDropdownRef} style={{ position: 'relative' }}>
      <button
        ref={statusDropdownButtonRef}
        className={`btn btn-outline-primary ${isMobile ? 'btn-sm ' : ''}dropdown-toggle`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowStatusDropdown(!showStatusDropdown);
        }}
        aria-expanded={showStatusDropdown}
      >
        <i className="fas fa-edit me-1"></i>
        修改狀態
      </button>
      {showStatusDropdown && (
        <div
          className="dropdown-menu show"
          style={{
            display: 'block',
            position: 'absolute',
            top: dropdownPosition.top,
            bottom: dropdownPosition.bottom,
            left: dropdownPosition.left,
            right: dropdownPosition.right,
            zIndex: 1050,
            minWidth: '200px',
            maxWidth: '300px',
            maxHeight: dropdownPosition.maxHeight || 'none',
            overflowY: dropdownPosition.maxHeight ? 'auto' : 'visible',
            backgroundColor: 'white',
            border: '1px solid rgba(0,0,0,.15)',
            borderRadius: '0.25rem',
            boxShadow: '0 0.5rem 1rem rgba(0,0,0,.175)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {DETAIL_MODAL_STATUS_OPTIONS.map((option) => (
            <button
              key={option.status}
              className="dropdown-item"
              type="button"
              onClick={() => handleOptionClick(option)}
              disabled={registration.status === option.status}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.5rem 1rem',
                border: 'none',
                backgroundColor: registration.status === option.status ? '#f8f9fa' : 'transparent',
                cursor: registration.status === option.status ? 'not-allowed' : 'pointer',
              }}
            >
              <i className={`fas fa-${option.icon} me-2 ${option.iconClass || ''}`}></i>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
