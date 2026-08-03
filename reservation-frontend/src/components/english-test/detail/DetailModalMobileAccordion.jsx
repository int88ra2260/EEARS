import React from 'react';
import { DETAIL_MODAL_TABS } from './detailModalConstants';
import DetailModalAccordionItem from './DetailModalAccordionItem';
import DetailModalAcademicTab from './DetailModalAcademicTab';
import DetailModalBasicTab from './DetailModalBasicTab';
import DetailModalExamTab from './DetailModalExamTab';
import DetailModalFilesTab from './DetailModalFilesTab';
import DetailModalSpecialTab from './DetailModalSpecialTab';

const TAB_COMPONENTS = {
  basic: DetailModalBasicTab,
  academic: DetailModalAcademicTab,
  special: DetailModalSpecialTab,
  exam: DetailModalExamTab,
  files: DetailModalFilesTab,
};

export default function DetailModalMobileAccordion({
  registration,
  expandedSections,
  toggleSection,
  isEditing,
  editData,
  handleEditChange,
  editFileInputs,
  handleFileInputChange,
  onUploadRegistrationFiles,
}) {
  const tabProps = {
    registration,
    isEditing,
    editData,
    handleEditChange,
    embedded: true,
  };

  return (
    <div className="accordion" id="detailAccordion">
      {DETAIL_MODAL_TABS.map((tab) => {
        const TabComponent = TAB_COMPONENTS[tab.key];
        return (
          <DetailModalAccordionItem
            key={tab.key}
            section={tab.key}
            icon={tab.icon}
            title={tab.label}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
          >
            {tab.key === 'files' ? (
              <DetailModalFilesTab
                registration={registration}
                isEditing={isEditing}
                editFileInputs={editFileInputs}
                handleFileInputChange={handleFileInputChange}
                onUploadRegistrationFiles={onUploadRegistrationFiles}
                embedded
              />
            ) : (
              <TabComponent {...tabProps} />
            )}
          </DetailModalAccordionItem>
        );
      })}
    </div>
  );
}
