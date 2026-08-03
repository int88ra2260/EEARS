// components/EnglishTestManagement.js
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useEnglishTestManagement } from '../hooks/useEnglishTestManagement';
import DetailModalWithTabs from './english-test/DetailModalWithTabs';
import QuickReviewMode from './english-test/QuickReviewMode';
import ToastMessage from './english-test/ToastMessage';
import ConfirmModal from './english-test/ConfirmModal';
import AnalyticsSection from './english-test/AnalyticsSection';
import LearningPartnerManagement from './LearningPartnerManagement';
import ExemptionReviewSection from './english-test/ExemptionReviewSection';
import EnglishTestIndividualTab from './english-test/EnglishTestIndividualTab';
import EnglishTestLegacyDetailModal from './english-test/EnglishTestLegacyDetailModal';
import EnglishTestStatusModal from './english-test/EnglishTestStatusModal';
import EnglishTestRejectionModal from './english-test/EnglishTestRejectionModal';
import EnglishTestFormBuilderTab from './english-test/form-builder/EnglishTestFormBuilderTab';
import { buildAccessProfile, hasPermission } from '../utils/accessControl';
import { P } from '../constants/permissions';

export default function EnglishTestManagement() {
  const { token, userRole, accessProfile: ctxProfile } = useOutletContext();
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');
  const canViewEnglishTests = hasPermission(accessProfile, P.CAN_VIEW_ENGLISH_TESTS);
  const canReviewEnglishTests = hasPermission(accessProfile, P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS);
  const canExportEnglishTestData = hasPermission(accessProfile, P.CAN_EXPORT_ENGLISH_TEST_DATA);
  const canManageSettings = hasPermission(accessProfile, P.CAN_MANAGE_SETTINGS);
  const canManageEnglishTests = hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TESTS);
  const canManageLearningPartner = hasPermission(accessProfile, P.CAN_MANAGE_LEARNING_PARTNER_ADMIN);
  const canToggleRegistrationSettings = canManageSettings || canManageEnglishTests;

  const m = useEnglishTestManagement({ token, canViewEnglishTests });

  const {
    mainTab, setMainTab, toast, setToast, adjustingSequence, tableContainerRef,
    confirmModal, closeConfirm, handleGoToClassBestep, handleDelete, handleAdjustSequence,
    handleStatsCardClick, getStatusText,
  } = m;

  const {
    registrations, loading, currentPage, setCurrentPage, totalPages, total, limit,
    statusFilter, setStatusFilter, searchTerm, setSearchTerm, advancedFilters, setAdvancedFilters,
    sortConfig, setSortConfig, stats, todayNewCount, loadRegistrations,
  } = m.list;

  const {
    registrationEnabled, registrationGroupEnabled, isUpdatingSetting,
    handleToggleRegistration, handleToggleRegistrationGroup,
  } = m.settings;

  const { infoSourceStats, analyticsLoading } = m.analytics;
  const { exportStatusFilter, setExportStatusFilter, handleExport, handleExportPhotos } = m.exportOps;
  const {
    selectedRows, setSelectedRows, handleBulkApprove, handleBulkReject,
    handleBulkDelete, handleBulkSetSuccess, handleBulkSetFailed,
  } = m.bulk;
  const { sendingEmails, handleSendStatusEmails } = m.emails;

  const {
    selectedRegistration, showDetailModal, currentRegistrationIndex,
    handleViewDetail, handleNavigatePrevious, handleNavigateNext,
    canNavigatePrevious, canNavigateNext, handleCloseDetailModal,
  } = m.detail;

  const {
    showStatusModal, setShowStatusModal, statusUpdate, setStatusUpdate,
    pendingStatusUpdate, handleQuickStatusUpdate, handleUpdateStatus, handleStatusSelectChange,
  } = m.status;

  const {
    showRejectionModal, rejectionReasons, rejectionOther, setRejectionOther,
    handleRejectionReasonChange, handleConfirmRejection, handleCloseRejectionModal,
  } = m.rejection;

  const { handleUpdateRegistration, handleUploadRegistrationFiles } = m.adminUpdate;

  const {
    showQuickReview, setShowQuickReview, setQuickReviewIndex,
    handleOpenQuickReview, handleQuickReviewNext, handleQuickReviewApprove, handleQuickReviewReject,
  } = m.quickReview;

  const handleStatusFilterChange = (key) => {
    setStatusFilter(key);
    setCurrentPage(1);
    if (key === 'success') {
      setSortConfig({ key: 'successSequence', direction: 'ASC' });
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters({ dateFrom: '', dateTo: '', examTypes: [], isLowIncome: '', hasDisabilityCard: '' });
    setCurrentPage(1);
    loadRegistrations();
  };

  return (
    <div className="container-fluid px-2 px-md-3">
      <div
        className="nav nav-tabs nav-tabs--main mb-3 overflow-auto flex-nowrap gap-1"
        style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
        role="tablist"
      >
        {canViewEnglishTests && (
          <button
            className={`nav-link fw-semibold flex-shrink-0 ${mainTab === 'individual' ? 'active' : ''}`}
            onClick={() => { setMainTab('individual'); setCurrentPage(1); }}
            role="tab"
            aria-selected={mainTab === 'individual'}
          >
            個人報名
          </button>
        )}
        <button
          className={`nav-link fw-semibold flex-shrink-0 ${mainTab === 'group' ? 'active' : ''}`}
          onClick={() => setMainTab('group')}
          role="tab"
          aria-selected={mainTab === 'group'}
          disabled={!canManageLearningPartner}
          title={!canManageLearningPartner ? '您沒有團體報名管理權限' : undefined}
        >
          團體報名
        </button>
        {canViewEnglishTests && (
          <button
            className={`nav-link fw-semibold flex-shrink-0 ${mainTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setMainTab('analytics')}
            role="tab"
            aria-selected={mainTab === 'analytics'}
          >
            數據分析
          </button>
        )}
        {canViewEnglishTests && (
          <button
            className={`nav-link fw-semibold flex-shrink-0 ${mainTab === 'exemption' ? 'active' : ''}`}
            onClick={() => setMainTab('exemption')}
            role="tab"
            aria-selected={mainTab === 'exemption'}
          >
            抵免審核
          </button>
        )}
        {canViewEnglishTests && (
          <button
            className={`nav-link fw-semibold flex-shrink-0 ${mainTab === 'form' ? 'active' : ''}`}
            onClick={() => setMainTab('form')}
            role="tab"
            aria-selected={mainTab === 'form'}
          >
            報名表單
          </button>
        )}
      </div>

      {!canViewEnglishTests && mainTab !== 'group' && (
        <div className="alert alert-warning">您目前僅有英檢指標或團體管理權限，無法檢視個人報名清單。</div>
      )}

      {canViewEnglishTests && mainTab === 'exemption' && (
        <ExemptionReviewSection token={token} />
      )}

      {canViewEnglishTests && mainTab === 'form' && (
        <EnglishTestFormBuilderTab token={token} canManage={canManageEnglishTests} />
      )}

      {canManageLearningPartner && mainTab === 'group' && (
        <LearningPartnerManagement token={token} />
      )}

      {!canManageLearningPartner && mainTab === 'group' && (
        <div className="alert alert-warning">您沒有團體報名管理權限。</div>
      )}

      {canViewEnglishTests && mainTab === 'analytics' && (
        <AnalyticsSection
          loading={analyticsLoading}
          data={infoSourceStats.data || []}
          total={infoSourceStats.total || 0}
        />
      )}

      {mainTab === 'individual' && (
        <EnglishTestIndividualTab
          stats={stats}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          canReviewEnglishTests={canReviewEnglishTests}
          canExportEnglishTestData={canExportEnglishTestData}
          canManageSettings={canToggleRegistrationSettings}
          exportStatusFilter={exportStatusFilter}
          onExportStatusFilterChange={setExportStatusFilter}
          onOpenQuickReview={handleOpenQuickReview}
          onExport={handleExport}
          onExportPhotos={handleExportPhotos}
          onSendStatusEmails={handleSendStatusEmails}
          sendingEmails={sendingEmails}
          registrationEnabled={registrationEnabled}
          registrationGroupEnabled={registrationGroupEnabled}
          isUpdatingSetting={isUpdatingSetting}
          onToggleRegistration={handleToggleRegistration}
          onToggleRegistrationGroup={handleToggleRegistrationGroup}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={(filters) => { setAdvancedFilters(filters); setCurrentPage(1); }}
          sortConfig={sortConfig}
          onSortChange={(nextSort) => { setSortConfig(nextSort); setCurrentPage(1); }}
          searchTerm={searchTerm}
          onSearchChange={(value) => { setSearchTerm(value); setCurrentPage(1); }}
          selectedRows={selectedRows}
          onBulkApprove={handleBulkApprove}
          onBulkReject={handleBulkReject}
          onBulkDelete={handleBulkDelete}
          onBulkSetSuccess={handleBulkSetSuccess}
          onBulkSetFailed={handleBulkSetFailed}
          todayNewCount={todayNewCount}
          onStatsCardClick={handleStatsCardClick}
          tableContainerRef={tableContainerRef}
          loading={loading}
          registrations={registrations}
          onSort={(key, direction) => {
            setSortConfig({ key, direction });
            setCurrentPage(1);
            setTimeout(() => loadRegistrations(), 100);
          }}
          onRowSelect={setSelectedRows}
          onViewDetail={handleViewDetail}
          onQuickStatusUpdate={handleQuickStatusUpdate}
          onDelete={handleDelete}
          onClassBestep={handleGoToClassBestep}
          onDragEnd={async (activeId, overId) => {
            if (activeId === overId) return;
            const overIndex = registrations.findIndex((r) => r.id === parseInt(overId, 10));
            if (overIndex === -1) return;
            const targetSequence = registrations[overIndex].successSequence;
            if (targetSequence) {
              await handleAdjustSequence(parseInt(activeId, 10), 'move', targetSequence);
            }
          }}
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setCurrentPage}
          onClearFilters={handleClearFilters}
        />
      )}

      {showDetailModal && selectedRegistration && (
        mainTab === 'individual' ? (
          <DetailModalWithTabs
            registration={selectedRegistration}
            onClose={handleCloseDetailModal}
            onQuickStatusUpdate={handleQuickStatusUpdate}
            onNavigatePrevious={handleNavigatePrevious}
            onNavigateNext={handleNavigateNext}
            canNavigatePrevious={canNavigatePrevious}
            canNavigateNext={canNavigateNext}
            positionLabel={total > 0 ? `第 ${(currentPage - 1) * limit + currentRegistrationIndex + 1} / ${total} 筆` : null}
            onAdjustSequence={handleAdjustSequence}
            token={token}
            adjustingSequence={adjustingSequence}
            onUpdateRegistration={handleUpdateRegistration}
            onUploadRegistrationFiles={handleUploadRegistrationFiles}
          />
        ) : (
          <EnglishTestLegacyDetailModal
            registration={selectedRegistration}
            currentRegistrationIndex={currentRegistrationIndex}
            registrationsLength={registrations.length}
            getStatusText={getStatusText}
            onClose={handleCloseDetailModal}
            onNavigatePrevious={handleNavigatePrevious}
            onNavigateNext={handleNavigateNext}
            onQuickStatusUpdate={handleQuickStatusUpdate}
          />
        )
      )}

      <EnglishTestStatusModal
        show={showStatusModal && !!selectedRegistration}
        statusUpdate={statusUpdate}
        onClose={() => setShowStatusModal(false)}
        onStatusChange={handleStatusSelectChange}
        onNotesChange={(notes) => setStatusUpdate((prev) => ({ ...prev, notes }))}
        onConfirm={handleUpdateStatus}
      />

      <EnglishTestRejectionModal
        show={showRejectionModal && !!selectedRegistration}
        pendingStatusUpdate={pendingStatusUpdate}
        rejectionReasons={rejectionReasons}
        rejectionOther={rejectionOther}
        onClose={handleCloseRejectionModal}
        onReasonChange={handleRejectionReasonChange}
        onOtherChange={setRejectionOther}
        onConfirm={handleConfirmRejection}
      />

      {showQuickReview && selectedRegistration && (
        <QuickReviewMode
          registration={selectedRegistration}
          onApprove={handleQuickReviewApprove}
          onReject={handleQuickReviewReject}
          onNext={handleQuickReviewNext}
          onClose={() => {
            setShowQuickReview(false);
            setQuickReviewIndex(-1);
          }}
          autoNext
        />
      )}

      <ToastMessage
        show={toast.show}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {confirmModal.show && confirmModal.config && (
        <ConfirmModal
          show
          title={confirmModal.config.title}
          message={confirmModal.config.message}
          confirmLabel={confirmModal.config.confirmLabel}
          cancelLabel={confirmModal.config.cancelLabel}
          variant={confirmModal.config.variant}
          onConfirm={confirmModal.config.onConfirm}
          onCancel={() => closeConfirm()}
        />
      )}
    </div>
  );
}
