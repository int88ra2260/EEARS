import React from 'react';
import DetailModalFooter from './DetailModalFooter';
import DetailModalMobileAccordion from './DetailModalMobileAccordion';
import DetailModalSequenceControls from './DetailModalSequenceControls';
import DetailModalStatusBadge from './DetailModalStatusBadge';

export default function DetailModalMobileView({
  registration,
  onClose,
  expandedSections,
  toggleSection,
  editState,
  footerProps,
  onAdjustSequence,
  adjustingSequence,
}) {
  const {
    isEditing,
    editData,
    handleEditChange,
    editFileInputs,
    handleFileInputChange,
    onUploadRegistrationFiles,
  } = editState;

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-scrollable" style={{ margin: '0.5rem' }}>
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
              <h5 className="modal-title mb-0">{registration.name}</h5>
              <div className="d-flex gap-2 align-items-center flex-shrink-0">
                <DetailModalStatusBadge registration={registration} />
                <DetailModalSequenceControls
                  registration={registration}
                  onAdjustSequence={onAdjustSequence}
                  adjustingSequence={adjustingSequence}
                />
                <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="關閉"></button>
              </div>
            </div>
          </div>
          <div className="modal-body">
            <DetailModalMobileAccordion
              registration={registration}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              isEditing={isEditing}
              editData={editData}
              handleEditChange={handleEditChange}
              editFileInputs={editFileInputs}
              handleFileInputChange={handleFileInputChange}
              onUploadRegistrationFiles={onUploadRegistrationFiles}
            />
          </div>
          <DetailModalFooter mobile {...footerProps} />
        </div>
      </div>
    </div>
  );
}
