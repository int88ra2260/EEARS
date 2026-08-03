// components/english-test/DetailModalWithTabs.js
import React, { useState } from 'react';
import useDetailModalEdit from '../../hooks/useDetailModalEdit';
import { useDetailModalStatusDropdown } from '../../hooks/useDetailModalStatusDropdown';
import useMediaQuery from '../../hooks/useMediaQuery';
import useConfirm from '../ui/useConfirm';
import DetailModalAcademicTab from './detail/DetailModalAcademicTab';
import DetailModalBasicTab from './detail/DetailModalBasicTab';
import DetailModalDesktopView from './detail/DetailModalDesktopView';
import DetailModalExamTab from './detail/DetailModalExamTab';
import DetailModalFilesTab from './detail/DetailModalFilesTab';
import DetailModalMobileView from './detail/DetailModalMobileView';
import DetailModalSpecialTab from './detail/DetailModalSpecialTab';
import { INITIAL_EXPANDED_SECTIONS } from './detail/detailModalConstants';

export default function DetailModalWithTabs({ 
  registration, 
  onClose, 
  onQuickStatusUpdate,
  onNavigatePrevious,
  onNavigateNext,
  canNavigatePrevious = false,
  canNavigateNext = false,
  positionLabel = null,
  onAdjustSequence = null,
  token = null,
  adjustingSequence = false,
  onUpdateRegistration = null,
  onUploadRegistrationFiles = null,
}) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isNarrow = useMediaQuery('(max-width: 992px)');
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState('basic');
  const [expandedSections, setExpandedSections] = useState(INITIAL_EXPANDED_SECTIONS);
  const statusDropdown = useDetailModalStatusDropdown();

  const {
    isEditing,
    editData,
    editFileInputs,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleEditChange,
    handleFileInputChange,
  } = useDetailModalEdit({ registration, onUpdateRegistration, onUploadRegistrationFiles, token });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleStatusChange = (newStatus) => {
    statusDropdown.setShowStatusDropdown(false);
    if (onQuickStatusUpdate) onQuickStatusUpdate(registration.id, newStatus);
  };

  const renderActiveTab = () => {
    const tabProps = { registration, isEditing, editData, handleEditChange };

    if (activeTab === 'basic') return <DetailModalBasicTab {...tabProps} />;
    if (activeTab === 'academic') return <DetailModalAcademicTab {...tabProps} />;
    if (activeTab === 'special') return <DetailModalSpecialTab {...tabProps} />;
    if (activeTab === 'exam') return <DetailModalExamTab {...tabProps} />;
    if (activeTab === 'files') {
      return (
        <DetailModalFilesTab
          registration={registration}
          isEditing={isEditing}
          editFileInputs={editFileInputs}
          handleFileInputChange={handleFileInputChange}
          onUploadRegistrationFiles={onUploadRegistrationFiles}
        />
      );
    }

    return null;
  };

  const footerProps = {
    registration,
    onClose,
    onQuickStatusUpdate,
    onUpdateRegistration,
    token,
    isEditing,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleStatusChange,
    confirm,
    statusDropdownProps: {
      showStatusDropdown: statusDropdown.showStatusDropdown,
      setShowStatusDropdown: statusDropdown.setShowStatusDropdown,
      dropdownPosition: statusDropdown.dropdownPosition,
      statusDropdownRef: statusDropdown.statusDropdownRef,
      statusDropdownButtonRef: statusDropdown.statusDropdownButtonRef,
    },
  };

  if (isMobile) {
    return (
      <DetailModalMobileView
        registration={registration}
        onClose={onClose}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
        onAdjustSequence={onAdjustSequence}
        adjustingSequence={adjustingSequence}
        editState={{
          isEditing,
          editData,
          handleEditChange,
          editFileInputs,
          handleFileInputChange,
          onUploadRegistrationFiles,
        }}
        footerProps={footerProps}
      />
    );
  }

                        return (
    <DetailModalDesktopView
      registration={registration}
      onClose={onClose}
      isNarrow={isNarrow}
      positionLabel={positionLabel}
      onNavigatePrevious={onNavigatePrevious}
      onNavigateNext={onNavigateNext}
      canNavigatePrevious={canNavigatePrevious}
      canNavigateNext={canNavigateNext}
      onAdjustSequence={onAdjustSequence}
      adjustingSequence={adjustingSequence}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      renderActiveTab={renderActiveTab}
      footerProps={footerProps}
    />
  );
}
