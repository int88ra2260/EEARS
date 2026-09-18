// components/EnglishTestManagement.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import EnglishTestStudentRosterTab from './english-test/EnglishTestStudentRosterTab';
import EnglishTestLegacyDetailModal from './english-test/EnglishTestLegacyDetailModal';
import EnglishTestStatusModal from './english-test/EnglishTestStatusModal';
import EnglishTestRejectionModal from './english-test/EnglishTestRejectionModal';
import EnglishTestFormBuilderTab from './english-test/form-builder/EnglishTestFormBuilderTab';
import { buildAccessProfile, hasPermission } from '../utils/accessControl';
import { P } from '../constants/permissions';
import { createPrimarySortConfig, normalizeSortConfig } from '../utils/englishTestSortConfig';
import { ENGLISH_TEST_MAX_PAGE_SIZE } from '../hooks/useEnglishTestRegistrations';
import { moveIdInExportOrder } from '../utils/englishTestExportOrder';
import useLearningPartnerOpsAttention from '../hooks/useLearningPartnerOpsAttention';
import UnreadAttentionDot from './learning-partner/UnreadAttentionDot';

export default function EnglishTestManagement() {
  const { token, userRole, accessProfile: ctxProfile, username } = useOutletContext();
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');
  const canViewEnglishTests = hasPermission(accessProfile, P.CAN_VIEW_ENGLISH_TESTS);
  const canReviewEnglishTests = hasPermission(accessProfile, P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS);
  const canExportEnglishTestData = hasPermission(accessProfile, P.CAN_EXPORT_ENGLISH_TEST_DATA);
  const canManageSettings = hasPermission(accessProfile, P.CAN_MANAGE_SETTINGS);
  const canManageEnglishTests = hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TESTS);
  const canManageLearningPartner = hasPermission(accessProfile, P.CAN_MANAGE_LEARNING_PARTNER_ADMIN);
  const canToggleRegistrationSettings = canManageSettings || canManageEnglishTests;
  const { showAttention: showLpOpsAttention } = useLearningPartnerOpsAttention(accessProfile, username);

  const m = useEnglishTestManagement({ token, canViewEnglishTests });

  const {
    mainTab, setMainTab, toast, setToast, adjustingSequence, tableContainerRef,
    confirmModal, closeConfirm, handleGoToClassBestep, handleDelete, handleAdjustSequence,
    handleStatsCardClick, getStatusText,
  } = m;

  const {
    registrations, loading, currentPage, setCurrentPage, totalPages, total, limit,
    pageSize, setPageSize,
    statusFilter, setStatusFilter, searchTerm, setSearchTerm, advancedFilters, setAdvancedFilters,
    sortConfig, setSortConfig, stats, todayNewCount, loadRegistrations,
  } = m.list;

  const {
    registrationEnabled, registrationGroupEnabled, registrationEditEnabled, isUpdatingSetting,
    handleToggleRegistration, handleToggleRegistrationGroup, handleToggleRegistrationEdit,
  } = m.settings;

  const { infoSourceStats, departmentStats, gradeStats, analyticsLoading, analyticsError, semester, setSemester, availableSemesters, semesterCounts, activeSemester } = m.analytics;
  const { handleExport, handleExportPhotos, exportingExcel, exportingPhotos } = m.exportOps;
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

  const [exportArrangeMode, setExportArrangeMode] = useState(false);
  const [orderedIds, setOrderedIds] = useState([]);

  const clearExportArrange = useCallback((notify = false) => {
    setExportArrangeMode(false);
    setOrderedIds([]);
    if (notify) {
      setToast({
        show: true,
        message: '篩選或排序已變更，已關閉匯出順序微調',
        variant: 'info',
      });
    }
  }, [setToast]);

  const arrangeScopeKey = useMemo(() => JSON.stringify({
    statusFilter,
    searchTerm,
    advancedFilters,
    sortBy: sortConfig?.levels || [{ key: sortConfig?.key, direction: sortConfig?.direction }],
  }), [statusFilter, searchTerm, advancedFilters, sortConfig]);

  const arrangeScopeKeyRef = useRef(arrangeScopeKey);
  useEffect(() => {
    if (!exportArrangeMode) {
      arrangeScopeKeyRef.current = arrangeScopeKey;
      return;
    }
    if (arrangeScopeKeyRef.current !== arrangeScopeKey) {
      arrangeScopeKeyRef.current = arrangeScopeKey;
      clearExportArrange(true);
    }
  }, [arrangeScopeKey, exportArrangeMode, clearExportArrange]);

  const displayRegistrations = useMemo(() => {
    if (!exportArrangeMode || orderedIds.length === 0) return registrations;
    const byId = new Map(registrations.map((row) => [row.id, row]));
    const used = new Set();
    const ordered = [];
    orderedIds.forEach((id) => {
      const row = byId.get(id);
      if (!row || used.has(id)) return;
      ordered.push(row);
      used.add(id);
    });
    registrations.forEach((row) => {
      if (!used.has(row.id)) ordered.push(row);
    });
    return ordered;
  }, [exportArrangeMode, orderedIds, registrations]);

  const handleToggleExportArrange = useCallback(() => {
    if (exportArrangeMode) {
      clearExportArrange(false);
      return;
    }
    if (total === 0) {
      setToast({ show: true, message: '目前沒有可微調的資料', variant: 'warning' });
      return;
    }
    if (total > ENGLISH_TEST_MAX_PAGE_SIZE) {
      setToast({
        show: true,
        message: `符合條件共 ${total} 筆，超過一次載入上限 ${ENGLISH_TEST_MAX_PAGE_SIZE}。請先縮小篩選後再開啟微調。`,
        variant: 'warning',
      });
      return;
    }
    if (registrations.length < total) {
      setPageSize(Math.min(ENGLISH_TEST_MAX_PAGE_SIZE, Math.max(total, pageSize)));
      setCurrentPage(1);
      setToast({
        show: true,
        message: '已調整每頁筆數以載入全部符合條件的資料，請待列表更新後再按一次「匯出順序微調」。',
        variant: 'info',
      });
      return;
    }
    setOrderedIds(registrations.map((row) => row.id));
    setExportArrangeMode(true);
    setToast({
      show: true,
      message: '已開啟匯出順序微調：可拖曳，或用 ↑↓／輸入序號精確調整單筆位置後再匯出',
      variant: 'success',
    });
  }, [
    exportArrangeMode,
    clearExportArrange,
    total,
    registrations,
    setPageSize,
    pageSize,
    setCurrentPage,
    setToast,
  ]);

  const handleArrangeDragEnd = useCallback((activeId, overId) => {
    if (activeId === overId) return;
    setOrderedIds((prev) => {
      const base = prev.length
        ? prev.slice()
        : registrations.map((row) => row.id);
      const oldIndex = base.indexOf(Number(activeId));
      const newIndex = base.indexOf(Number(overId));
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = base.slice();
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  }, [registrations]);

  const handleArrangeMove = useCallback((id, action, targetOneBased) => {
    setOrderedIds((prev) => {
      const base = prev.length
        ? prev
        : registrations.map((row) => row.id);
      return moveIdInExportOrder(base, id, action, targetOneBased);
    });
  }, [registrations]);

  const handleStatusFilterChange = (key) => {
    setStatusFilter(key);
    setCurrentPage(1);
    if (key === 'success') {
      setSortConfig(createPrimarySortConfig('successSequence', 'ASC'));
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters({ dateFrom: '', dateTo: '', examTypes: [], grades: [], isLowIncome: '', hasDisabilityCard: '' });
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
          className={`nav-link fw-semibold flex-shrink-0 d-inline-flex align-items-center ${mainTab === 'group' ? 'active' : ''}`}
          onClick={() => setMainTab('group')}
          role="tab"
          aria-selected={mainTab === 'group'}
          disabled={!canManageLearningPartner}
          title={!canManageLearningPartner ? '您沒有團體報名管理權限' : undefined}
        >
          團體報名
          {showLpOpsAttention && canManageLearningPartner ? (
            <UnreadAttentionDot className="lp-ops-attention-dot--inline" label="請查看學習有伴營運成效" />
          ) : null}
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
        {canManageEnglishTests && (
          <button
            className={`nav-link fw-semibold flex-shrink-0 ${mainTab === 'roster' ? 'active' : ''}`}
            onClick={() => setMainTab('roster')}
            role="tab"
            aria-selected={mainTab === 'roster'}
          >
            在學名單比對
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

      {canManageEnglishTests && mainTab === 'roster' && (
        <EnglishTestStudentRosterTab token={token} />
      )}

      {canManageLearningPartner && mainTab === 'group' && (
        <LearningPartnerManagement token={token} accessProfile={accessProfile} />
      )}

      {!canManageLearningPartner && mainTab === 'group' && (
        <div className="alert alert-warning">您沒有團體報名管理權限。</div>
      )}

      {canViewEnglishTests && mainTab === 'analytics' && (
        <AnalyticsSection
          loading={analyticsLoading}
          error={analyticsError}
          semester={semester}
          onSemesterChange={setSemester}
          availableSemesters={availableSemesters}
          semesterCounts={semesterCounts}
          activeSemester={activeSemester}
          infoSource={infoSourceStats}
          department={departmentStats}
          grade={gradeStats}
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
          onOpenQuickReview={handleOpenQuickReview}
          onExport={() => handleExport({
            statusFilter,
            searchTerm,
            advancedFilters,
            sortConfig,
            orderedIds: exportArrangeMode ? orderedIds : null,
          })}
          onExportPhotos={() => handleExportPhotos({
            statusFilter,
            searchTerm,
            advancedFilters,
            sortConfig,
            orderedIds: exportArrangeMode ? orderedIds : null,
          })}
          onSendStatusEmails={handleSendStatusEmails}
          sendingEmails={sendingEmails}
          exportingExcel={exportingExcel}
          exportingPhotos={exportingPhotos}
          exportArrangeMode={exportArrangeMode}
          onToggleExportArrange={handleToggleExportArrange}
          onArrangeMove={handleArrangeMove}
          registrationEnabled={registrationEnabled}
          registrationGroupEnabled={registrationGroupEnabled}
          registrationEditEnabled={registrationEditEnabled}
          isUpdatingSetting={isUpdatingSetting}
          onToggleRegistration={handleToggleRegistration}
          onToggleRegistrationGroup={handleToggleRegistrationGroup}
          onToggleRegistrationEdit={handleToggleRegistrationEdit}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={(filters) => {
            setAdvancedFilters(filters);
            setCurrentPage(1);
          }}
          sortConfig={sortConfig}
          onSortChange={(nextSort) => { setSortConfig(normalizeSortConfig(nextSort)); setCurrentPage(1); }}
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
          registrations={displayRegistrations}
          onSort={(nextConfig, meta = {}) => {
            if (meta.capped) {
              setToast({ show: true, message: '排序最多五層，請先移除一層再疊加', variant: 'warning' });
            }
            setSortConfig(normalizeSortConfig(nextConfig));
            setCurrentPage(1);
            setTimeout(() => loadRegistrations(), 100);
          }}
          onRowSelect={setSelectedRows}
          onViewDetail={handleViewDetail}
          onQuickStatusUpdate={handleQuickStatusUpdate}
          onDelete={handleDelete}
          onClassBestep={handleGoToClassBestep}
          onDragEnd={exportArrangeMode
            ? handleArrangeDragEnd
            : async (activeId, overId) => {
              if (activeId === overId) return;
              const overIndex = registrations.findIndex((r) => r.id === parseInt(overId, 10));
              if (overIndex === -1) return;
              const targetSequence = registrations[overIndex].successSequence;
              if (targetSequence) {
                await handleAdjustSequence(parseInt(activeId, 10), 'move', targetSequence);
              }
            }}
          enableDragSort={exportArrangeMode || statusFilter === 'success'}
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
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
