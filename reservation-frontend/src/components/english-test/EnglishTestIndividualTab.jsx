import React from 'react';
import AdvancedFilterPanel from './AdvancedFilterPanel';
import StatsVisualization from './StatsVisualization';
import BulkActionToolbar from './BulkActionToolbar';
import EnhancedTable from './EnhancedTable';

const SUB_TABS = [
  { key: 'all', label: '總報名人數' },
  { key: 'pending', label: '審核中' },
  { key: 'approved', label: '已通過' },
  { key: 'success', label: '報名成功' },
  { key: 'revision', label: '請修正' },
  { key: 'failed', label: '報名失敗' },
];

export default function EnglishTestIndividualTab({
  stats,
  statusFilter,
  onStatusFilterChange,
  canReviewEnglishTests,
  canExportEnglishTestData,
  canManageSettings,
  exportStatusFilter,
  onExportStatusFilterChange,
  onOpenQuickReview,
  onExport,
  onExportPhotos,
  onSendStatusEmails,
  sendingEmails,
  registrationEnabled,
  registrationGroupEnabled,
  isUpdatingSetting,
  onToggleRegistration,
  onToggleRegistrationGroup,
  advancedFilters,
  onAdvancedFiltersChange,
  sortConfig,
  onSortChange,
  searchTerm,
  onSearchChange,
  selectedRows,
  onBulkApprove,
  onBulkReject,
  onBulkDelete,
  onBulkSetSuccess,
  onBulkSetFailed,
  todayNewCount,
  onStatsCardClick,
  tableContainerRef,
  loading,
  registrations,
  onSort,
  onRowSelect,
  onViewDetail,
  onQuickStatusUpdate,
  onDelete,
  onClassBestep,
  onDragEnd,
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
  onClearFilters,
}) {
  return (
    <>
      <ul className="nav nav-pills mb-3 overflow-auto flex-nowrap gap-1" style={{ scrollbarWidth: 'thin' }} role="tablist">
        {SUB_TABS.map(({ key, label }) => (
          <li key={key} className="nav-item flex-shrink-0" role="presentation">
            <button
              className={`nav-link ${statusFilter === key ? 'active' : ''}`}
              onClick={() => onStatusFilterChange(key)}
              role="tab"
              aria-selected={statusFilter === key}
            >
              {label}
              <span className="badge bg-secondary ms-1">{stats[key === 'all' ? 'total' : key] ?? 0}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <span />
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {canReviewEnglishTests && stats.pending > 0 && statusFilter === 'pending' && (
            <button className="btn btn-primary" onClick={onOpenQuickReview}>
              <i className="fas fa-bolt me-2" />
              快速審核模式 ({stats.pending} 筆)
            </button>
          )}
          <select
            className="form-select form-select-sm"
            value={exportStatusFilter}
            onChange={(e) => onExportStatusFilterChange(e.target.value)}
            style={{ width: 'auto', minWidth: '140px' }}
            aria-label="匯出篩選狀態"
          >
            <option value="all">全部</option>
            <option value="pending">審核中</option>
            <option value="approved">已通過</option>
            <option value="revision">請修正</option>
            <option value="success">報名成功</option>
            <option value="failed">報名失敗</option>
          </select>
          {canExportEnglishTestData && (
            <button className="btn btn-success btn-sm" onClick={onExport}>
              <i className="fas fa-file-excel me-1" />
              匯出 Excel
            </button>
          )}
          {canExportEnglishTestData && (exportStatusFilter === 'approved' || exportStatusFilter === 'success') && (
            <button className="btn btn-info btn-sm" onClick={() => onExportPhotos(exportStatusFilter)}>
              <i className="fas fa-images me-1" />
              匯出證件照
            </button>
          )}
          {canReviewEnglishTests && statusFilter === 'success' && (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onSendStatusEmails('success')}
                disabled={sendingEmails || stats.success === 0}
              >
                <i className="fas fa-envelope me-1" />
                {sendingEmails ? '發送中...' : '一鍵發送報名成功信'}
              </button>
              <button
                className="btn btn-info btn-sm"
                onClick={() => onSendStatusEmails('group_promo')}
                disabled={sendingEmails}
                title="對報名成功且四項皆報考者發送團體推廣信"
              >
                <i className="fas fa-users me-1" />
                {sendingEmails ? '發送中...' : '一鍵發送團體推廣信'}
              </button>
            </>
          )}
          {canReviewEnglishTests && statusFilter === 'failed' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onSendStatusEmails('failed')}
              disabled={sendingEmails || stats.failed === 0}
            >
              <i className="fas fa-envelope me-1" />
              {sendingEmails ? '發送中...' : '一鍵發送報名失敗信'}
            </button>
          )}
        </div>
      </div>

      {canManageSettings && (
        <div className="card mb-4 border-light">
          <div className="card-body py-2">
            <div className="text-muted small mb-2">個人報名與團體報名功能開關（截止時間不同，請分別控制）</div>
            <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-3 flex-wrap">
              <div className="d-flex align-items-center gap-2">
                <span className="small">個人報名</span>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="registrationEnabled"
                    checked={registrationEnabled}
                    onChange={(e) => onToggleRegistration(e.target.checked)}
                    disabled={isUpdatingSetting}
                    aria-label={registrationEnabled ? '個人報名已啟用' : '個人報名已停用'}
                  />
                  <label className="form-check-label small" htmlFor="registrationEnabled">
                    {registrationEnabled ? '已啟用' : '已停用'}
                  </label>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="small">團體報名（學習有伴）</span>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="registrationGroupEnabled"
                    checked={registrationGroupEnabled}
                    onChange={(e) => onToggleRegistrationGroup(e.target.checked)}
                    disabled={isUpdatingSetting}
                    aria-label={registrationGroupEnabled ? '團體報名已啟用' : '團體報名已停用'}
                  />
                  <label className="form-check-label small" htmlFor="registrationGroupEnabled">
                    {registrationGroupEnabled ? '已啟用' : '已停用'}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AdvancedFilterPanel
        onFilterChange={onAdvancedFiltersChange}
        sortConfig={sortConfig}
        onSortChange={onSortChange}
        initialFilters={advancedFilters}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        currentStatusFilter={statusFilter}
      />

      <StatsVisualization
        stats={stats}
        onFilterClick={onStatsCardClick}
        todayNewCount={todayNewCount}
        currentStatusFilter={statusFilter}
      />

      {canReviewEnglishTests && (
        <BulkActionToolbar
          selectedCount={selectedRows.length}
          onBulkApprove={onBulkApprove}
          onBulkReject={onBulkReject}
          onBulkDelete={onBulkDelete}
          onBulkSetSuccess={onBulkSetSuccess}
          onBulkSetFailed={onBulkSetFailed}
          showBulkSetSuccess={statusFilter === 'approved'}
        />
      )}

      <div ref={tableContainerRef} className="overflow-auto" style={{ maxHeight: 'min(70vh, 600px)' }}>
        {loading ? (
          <div className="card">
            <div className="card-body py-5">
              <div className="text-center">
                <div className="spinner-border text-primary" role="status" aria-label="載入中">
                  <span className="visually-hidden">載入中...</span>
                </div>
                <p className="mt-2 text-muted small">載入報名列表中...</p>
              </div>
              <div className="mt-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="placeholder-glow mb-2">
                    <span className="placeholder col-12 rounded" style={{ height: '40px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : registrations.length === 0 ? (
          <div className="card border-light">
            <div className="card-body text-center py-5">
              <i className="fas fa-inbox fa-3x text-muted mb-3" aria-hidden="true" />
              <p className="text-muted mb-2">目前此篩選下沒有報名資料</p>
              <p className="small text-muted mb-3">可嘗試切換上方狀態標籤或清除篩選條件</p>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={onClearFilters}>
                清除篩選條件
              </button>
            </div>
          </div>
        ) : (
          <>
            <EnhancedTable
              data={registrations}
              onSort={onSort}
              sortConfig={sortConfig}
              onRowSelect={onRowSelect}
              selectedRows={selectedRows}
              onViewDetail={onViewDetail}
              onQuickStatusUpdate={onQuickStatusUpdate}
              onDelete={onDelete}
              onClassBestep={onClassBestep}
              searchTerm={searchTerm}
              enableDragSort={statusFilter === 'success'}
              onDragEnd={onDragEnd}
            />
            <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
              <small className="text-muted">
                第 {(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, total)} 筆，共 {total} 筆
              </small>
              {totalPages > 1 && (
                <nav aria-label="分頁導覽">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        aria-label="上一頁"
                      >
                        上一頁
                      </button>
                    </li>
                    {[...Array(totalPages)].map((_, i) => (
                      <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => onPageChange(i + 1)}
                          aria-label={`第 ${i + 1} 頁`}
                          aria-current={currentPage === i + 1 ? 'page' : undefined}
                        >
                          {i + 1}
                        </button>
                      </li>
                    ))}
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        aria-label="下一頁"
                      >
                        下一頁
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
