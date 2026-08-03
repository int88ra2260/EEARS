import React from 'react';
import ImportCenterNotice from '../../components/admin/import/ImportCenterNotice';
import LearningJourneyDataHealthPanel from '../../components/learningJourneyV3/LearningJourneyDataHealthPanel';
import FreshnessSummary from '../../components/learningJourneyV3/operations/FreshnessSummary';
import OperationRunsDetailModal from '../../components/learningJourneyV3/operations/OperationRunsDetailModal';
import OperationRunsFilters from '../../components/learningJourneyV3/operations/OperationRunsFilters';
import OperationRunsTable from '../../components/learningJourneyV3/operations/OperationRunsTable';
import RetentionPolicyCard from '../../components/learningJourneyV3/operations/RetentionPolicyCard';
import useLearningJourneyOperations from '../../hooks/useLearningJourneyOperations';
import LearningJourneyQualityPanel from '../../components/learningJourneyTimeline/LearningJourneyQualityPanel';
import AnalyticsSnapshotGovernanceCard from '../../components/learningJourneyV3/operations/AnalyticsSnapshotGovernanceCard';

export default function LearningJourneyOperationsPage() {
  const {
    token,
    canManageLj,
    appliedParams,
    filters,
    setFilters,
    rows,
    pagination,
    loading,
    error,
    summaryLoading,
    summaryError,
    freshnessSummary,
    detail,
    detailLoading,
    detailError,
    copyMessage,
    exportingFiltered,
    exportError,
    cleanupCriteria,
    setCleanupCriteria,
    cleanupLoading,
    cleanupError,
    cleanupResult,
    archiveForm,
    setArchiveForm,
    archiveLoading,
    archiveError,
    archiveResult,
    hasNextPage,
    loadSummary,
    reloadAll,
    applyFilters,
    applyQuickFilter,
    setPageOffset,
    openDetail,
    closeDetail,
    copyRequestId,
    exportCurrentPageCsv,
    exportFilteredCsv,
    runCleanupDryRun,
    runCleanupArchive,
  } = useLearningJourneyOperations();

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 className="h4 mb-1">資料維運紀錄</h2>
          <div className="text-muted small">查詢匯入與 projection 操作紀錄；指定學期後可進行資料健康檢查與 projection 重建。</div>
        </div>
        <button type="button" className="btn btn-outline-secondary" onClick={reloadAll}>
          重新整理
        </button>
      </div>
      <ImportCenterNotice variant="sync" />
      {copyMessage ? <div className="alert alert-success py-2">{copyMessage}</div> : null}

      <FreshnessSummary
        loading={summaryLoading}
        error={summaryError}
        summary={freshnessSummary}
        onReload={loadSummary}
      />

      {appliedParams.semesterId ? (
        <LearningJourneyDataHealthPanel
          token={token}
          semesterId={appliedParams.semesterId}
          canManage={canManageLj}
        />
      ) : (
        <div className="alert alert-secondary mb-3">
          請在下方篩選條件指定<strong>學期</strong>，以顯示資料健康檢查與重建 projection。
        </div>
      )}

      <LearningJourneyQualityPanel token={token} canManage={canManageLj} semesterId={appliedParams.semesterId} />

      <AnalyticsSnapshotGovernanceCard token={token} canManage={canManageLj} />

      <RetentionPolicyCard
        canManage={canManageLj}
        criteria={cleanupCriteria}
        onCriteriaChange={setCleanupCriteria}
        loading={cleanupLoading}
        error={cleanupError}
        result={cleanupResult}
        onDryRun={runCleanupDryRun}
        archiveForm={archiveForm}
        onArchiveFormChange={setArchiveForm}
        archiveLoading={archiveLoading}
        archiveError={archiveError}
        archiveResult={archiveResult}
        onArchive={runCleanupArchive}
      />

      <OperationRunsFilters
        canManageLj={canManageLj}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={applyFilters}
        onQuickFilter={applyQuickFilter}
        exportError={exportError}
      />

      <OperationRunsTable
        rows={rows}
        loading={loading}
        error={error}
        pagination={pagination}
        appliedParams={appliedParams}
        hasNextPage={hasNextPage}
        onOpenDetail={openDetail}
        onCopyRequestId={copyRequestId}
        onSetPageOffset={setPageOffset}
        onExportCurrentPageCsv={exportCurrentPageCsv}
        onExportFilteredCsv={exportFilteredCsv}
        exportingFiltered={exportingFiltered}
      />

      <OperationRunsDetailModal
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDetail}
        onCopyRequestId={copyRequestId}
      />
    </div>
  );
}
