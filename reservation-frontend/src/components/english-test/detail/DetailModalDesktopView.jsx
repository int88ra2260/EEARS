import React from 'react';
import { DETAIL_MODAL_TABS } from './detailModalConstants';
import DetailModalFooter from './DetailModalFooter';
import DetailModalSequenceControls from './DetailModalSequenceControls';
import DetailModalStatusBadge from './DetailModalStatusBadge';

export default function DetailModalDesktopView({
  registration,
  onClose,
  isNarrow,
  positionLabel,
  onNavigatePrevious,
  onNavigateNext,
  canNavigatePrevious,
  canNavigateNext,
  onAdjustSequence,
  adjustingSequence,
  activeTab,
  setActiveTab,
  renderActiveTab,
  footerProps,
}) {
  return (
    <div className="modal fade show" style={{ display: 'block', position: 'fixed', inset: 0, zIndex: 1050, pointerEvents: 'none' }}>
      <div
        role="presentation"
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', pointerEvents: 'auto', zIndex: 0 }}
        onClick={onClose}
      />
      <div
        className="modal-dialog modal-xl modal-dialog-scrollable"
        style={{
          position: 'relative',
          margin: '0 auto',
          maxWidth: '95vw',
          width: '95vw',
          paddingLeft: isNarrow ? 0 : '56px',
          paddingRight: isNarrow ? 0 : '56px',
          pointerEvents: 'auto',
          zIndex: 1,
        }}
      >
        {canNavigatePrevious && (
          <button
            type="button"
            className="btn btn-light position-absolute top-50 start-0 translate-middle-y d-flex align-items-center justify-content-center border-2 border-primary bg-primary text-white shadow"
            style={{ width: '44px', height: '44px', left: '8px', zIndex: 1060, clipPath: 'polygon(100% 0, 100% 100%, 0 50%)', borderRadius: '4px 0 0 4px' }}
            onClick={() => onNavigatePrevious && onNavigatePrevious()}
            title="上一筆（當前篩選）"
            aria-label="上一筆"
          >
            <i className="fas fa-chevron-left" />
          </button>
        )}

        {canNavigateNext && (
          <button
            type="button"
            className="btn btn-light position-absolute top-50 end-0 translate-middle-y d-flex align-items-center justify-content-center border-2 border-primary bg-primary text-white shadow"
            style={{ width: '44px', height: '44px', right: '8px', zIndex: 1060, clipPath: 'polygon(0 0, 0 100%, 100% 50%)', borderRadius: '0 4px 4px 0' }}
            onClick={() => onNavigateNext && onNavigateNext()}
            title="下一筆（當前篩選）"
            aria-label="下一筆"
          >
            <i className="fas fa-chevron-right" />
          </button>
        )}

        <div className="modal-content">
          <div className="modal-header bg-primary text-white flex-wrap">
            <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
              <h5 className="modal-title mb-0 text-truncate" style={{ maxWidth: 'min(100%, 280px)' }}>
                報名詳細資料 - {registration.name}
              </h5>
              <div className="d-flex gap-2 align-items-center flex-shrink-0 flex-wrap">
                {positionLabel && (
                  <span className="badge bg-light text-dark" title="當前篩選下的序位">
                    {positionLabel}
                  </span>
                )}
                <DetailModalStatusBadge registration={registration} />
                <DetailModalSequenceControls
                  registration={registration}
                  onAdjustSequence={onAdjustSequence}
                  adjustingSequence={adjustingSequence}
                />
                <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="關閉" />
              </div>
            </div>
          </div>

          <div className="modal-body">
            <ul className="nav nav-tabs mb-3" role="tablist">
              {DETAIL_MODAL_TABS.map((tab) => (
                <li className="nav-item" key={tab.key}>
                  <button
                    className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                    type="button"
                  >
                    <i className={`fas fa-${tab.icon} me-1`}></i>
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="tab-content">{renderActiveTab()}</div>
          </div>

          <DetailModalFooter {...footerProps} />
        </div>
      </div>
    </div>
  );
}
