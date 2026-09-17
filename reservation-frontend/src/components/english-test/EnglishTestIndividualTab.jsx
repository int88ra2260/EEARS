import React, { useMemo, useState } from 'react';
import AdvancedFilterPanel from './AdvancedFilterPanel';
import StatsVisualization from './StatsVisualization';
import BulkActionToolbar from './BulkActionToolbar';
import EnhancedTable from './EnhancedTable';
import { ENGLISH_TEST_PAGE_SIZE_OPTIONS } from '../../hooks/useEnglishTestRegistrations';

const SUB_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '審核中' },
  { key: 'approved', label: '已通過' },
  { key: 'success', label: '報名成功' },
  { key: 'revision', label: '請修正' },
  { key: 'failed', label: '報名失敗' },
];

const STATUS_LABEL = {
  all: '全部',
  pending: '審核中',
  approved: '已通過',
  success: '報名成功',
  revision: '請修正',
  failed: '報名失敗',
};

function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1, 2, totalPages - 1]);
  const sorted = [...items].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const withGaps = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) withGaps.push('…');
    withGaps.push(sorted[i]);
  }
  return withGaps;
}

export default function EnglishTestIndividualTab({
  stats,
  statusFilter,
  onStatusFilterChange,
  canReviewEnglishTests,
  canExportEnglishTestData,
  canManageSettings,
  onOpenQuickReview,
  onExport,
  onExportPhotos,
  onSendStatusEmails,
  sendingEmails,
  exportingExcel = false,
  exportingPhotos = false,
  exportArrangeMode = false,
  onToggleExportArrange,
  onArrangeMove,
  registrationEnabled,
  registrationGroupEnabled,
  registrationEditEnabled = true,
  isUpdatingSetting,
  onToggleRegistration,
  onToggleRegistrationGroup,
  onToggleRegistrationEdit,
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
  enableDragSort = false,
  currentPage,
  totalPages,
  total,
  limit,
  pageSize = 100,
  onPageSizeChange,
  onPageChange,
  onClearFilters,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const pageItems = useMemo(() => buildPageItems(currentPage, totalPages), [currentPage, totalPages]);
  const canExportPhotos = statusFilter === 'approved' || statusFilter === 'success';
  const exportBusy = exportingExcel || exportingPhotos;
  const panelBusy = exportBusy || sendingEmails;
  const exportScopeLabel = STATUS_LABEL[statusFilter] || '全部';
  const semesterFilterLabel = advancedFilters?.semester
    ? String(advancedFilters.semester).trim()
    : '';
  const exportExcelLabel = semesterFilterLabel
    ? `${exportScopeLabel} · ${semesterFilterLabel}`
    : exportScopeLabel;
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const rangeEnd = Math.min(currentPage * limit, total);
  const rangeLabel = `第 ${rangeStart}–${rangeEnd} 筆，共 ${total} 筆`;

  const confirmToggle = (kind, nextEnabled, apply) => {
    if (kind === 'individual' && nextEnabled && !registrationEditEnabled) {
      window.alert('請先開啟「檢視與修正」，才能開啟個人報名。\n允許狀態：兩者皆開／僅檢視與修正／兩者皆關。');
      return;
    }
    if (kind === 'edit' && !nextEnabled && registrationEnabled) {
      window.alert('請先關閉「個人報名」，才能關閉「檢視與修正」。\n允許狀態：兩者皆開／僅檢視與修正／兩者皆關。');
      return;
    }

    const labels = {
      individual: '個人報名',
      group: '團體報名（學習有伴）',
      edit: '檢視與修正',
    };
    const label = labels[kind] || kind;
    const action = nextEnabled ? '啟用' : '停用';
    let impact = '這會立即影響學生端能否報名。';
    if (kind === 'edit') {
      impact = nextEnabled
        ? 'Header 將顯示培力英檢入口；若個人報名關閉，文案為「培力英檢(資料修正)」。'
        : 'Header 培力英檢入口將隱藏，學生無法從導覽進入檢視與修正。';
    } else if (kind === 'individual') {
      impact = nextEnabled
        ? 'Header 文案將顯示「培力英檢(考試報名)」。'
        : '個人報名關閉後，Header 文案改為「培力英檢(資料修正)」（若檢視與修正仍開啟）。';
    }
    if (!window.confirm(`確定要${action}「${label}」嗎？\n${impact}`)) {
      return;
    }
    apply(nextEnabled);
  };

  return (
    <>
      {/* 工作佇列：狀態 */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <ul className="nav nav-pills overflow-auto flex-nowrap gap-1 mb-0" style={{ scrollbarWidth: 'thin' }} role="tablist">
          {SUB_TABS.map(({ key, label }) => (
            <li key={key} className="nav-item flex-shrink-0" role="presentation">
              <button
                type="button"
                className={`nav-link ${statusFilter === key ? 'active' : ''}`}
                onClick={() => onStatusFilterChange(key)}
                role="tab"
                aria-selected={statusFilter === key}
              >
                {label}
                <span className="badge bg-secondary ms-1">
                  {statusFilter === key
                    ? total
                    : (stats[key === 'all' ? 'total' : key] ?? 0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="d-flex flex-wrap gap-2">
          {canReviewEnglishTests && stats.pending > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (statusFilter !== 'pending') onStatusFilterChange('pending');
                onOpenQuickReview();
              }}
            >
              <i className="fas fa-bolt me-1" aria-hidden />
              快速審核證件照（{stats.pending}）
            </button>
          )}
          {canExportEnglishTestData && typeof onToggleExportArrange === 'function' && (
            <button
              type="button"
              className={`btn btn-sm ${exportArrangeMode ? 'btn-warning' : 'btn-outline-warning'}`}
              disabled={exportBusy}
              onClick={onToggleExportArrange}
              title={exportArrangeMode ? '關閉匯出順序微調' : '開啟後可拖曳或指定序號，完全控制匯出 Excel／證件照順序'}
            >
              <i className={`fas fa-${exportArrangeMode ? 'check' : 'arrows-alt-v'} me-1`} aria-hidden />
              {exportArrangeMode ? '關閉順序微調' : '匯出順序微調'}
            </button>
          )}
          <button
            type="button"
            className={`btn btn-outline-secondary btn-sm ${showExportPanel ? 'active' : ''}`}
            onClick={() => setShowExportPanel((v) => !v)}
          >
            匯出與通知
          </button>
          {canManageSettings && (
            <button
              type="button"
              className={`btn btn-outline-warning btn-sm ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings((v) => !v)}
            >
              報名設定
            </button>
          )}
        </div>
      </div>

      {exportArrangeMode && (
        <div className="alert alert-warning py-2 px-3 mb-3 small" role="status">
          <i className="fas fa-arrows-alt-v me-1" aria-hidden />
          匯出順序微調已開啟：列表「匯出序」欄可 ↑↓／輸入數字調整單筆位置，也可拖曳；此時匯出 Excel／證件照會依此順序。
        </div>
      )}

      {showExportPanel && (
        <div className="card mb-3 border-primary-subtle">
          <div className="card-body py-3">
            <div className="fw-semibold mb-1">匯出與通知</div>
            <p className="small text-muted mb-3 mb-md-2">
              匯出範圍與目前列表一致：狀態「{exportScopeLabel}」加下方進階篩選（含學期、日期、測驗類型等）。
              Excel「序號」與證件照檔名前綴會依此次匯出結果重編為 1、2、3…（兩者對齊；與列表報名編號可不相同）。
              證件照僅「已通過／報名成功」可匯出；成功信／失敗信需切到對應狀態。
              {exportArrangeMode
                ? ' 目前為「匯出順序微調」：可拖曳列，或用「匯出序」欄的 ↑↓／輸入數字移至指定位置；匯出會完全依此順序。'
                : ' 建議先用進階篩選多層排序，再開「匯出順序微調」逐筆精調，即可完全控制 Excel／證件照順序。'}
            </p>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              {canExportEnglishTestData && (
                <button
                  type="button"
                  className={`btn btn-sm ${exportArrangeMode ? 'btn-warning' : 'btn-outline-warning'}`}
                  disabled={panelBusy}
                  onClick={onToggleExportArrange}
                >
                  <i className={`fas fa-${exportArrangeMode ? 'check' : 'arrows-alt-v'} me-1`} aria-hidden />
                  {exportArrangeMode ? '關閉匯出順序微調' : '匯出順序微調'}
                </button>
              )}
              {canExportEnglishTestData && (
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  disabled={panelBusy}
                  aria-busy={exportingExcel || undefined}
                  onClick={onExport}
                >
                  {exportingExcel ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                      Excel 匯出中…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-file-excel me-1" aria-hidden />
                      匯出 Excel（{exportExcelLabel}）
                    </>
                  )}
                </button>
              )}
              {canExportEnglishTestData && (
                <button
                  type="button"
                  className="btn btn-info btn-sm"
                  disabled={panelBusy || !canExportPhotos}
                  aria-busy={exportingPhotos || undefined}
                  title={
                    exportingPhotos
                      ? '證件照打包中，請稍候'
                      : canExportPhotos
                        ? `匯出「${exportScopeLabel}」證件照（含目前學期／進階篩選）`
                        : '請先切換狀態為「已通過」或「報名成功」'
                  }
                  onClick={() => canExportPhotos && !panelBusy && onExportPhotos()}
                >
                  {exportingPhotos ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                      證件照打包中…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-images me-1" aria-hidden />
                      匯出證件照
                    </>
                  )}
                </button>
              )}
              {canReviewEnglishTests && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={panelBusy || statusFilter !== 'success' || (stats.success || 0) === 0}
                    title={statusFilter !== 'success' ? '請先切到「報名成功」再寄信' : undefined}
                    onClick={() => onSendStatusEmails('success')}
                  >
                    {sendingEmails ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                        發送中…
                      </>
                    ) : (
                      '寄報名成功信'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-info btn-sm"
                    disabled={panelBusy || statusFilter !== 'success'}
                    title={statusFilter !== 'success' ? '請先切到「報名成功」' : '對四項皆報考者發送團體推廣信'}
                    onClick={() => onSendStatusEmails('group_promo')}
                  >
                    {sendingEmails ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                        發送中…
                      </>
                    ) : (
                      '寄團體推廣信'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={panelBusy || statusFilter !== 'failed' || (stats.failed || 0) === 0}
                    title={statusFilter !== 'failed' ? '請先切到「報名失敗」再寄信' : undefined}
                    onClick={() => onSendStatusEmails('failed')}
                  >
                    {sendingEmails ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                        發送中…
                      </>
                    ) : (
                      '寄報名失敗信'
                    )}
                  </button>
                </>
              )}
            </div>
            {exportBusy && (
              <div className="form-text text-primary mt-2 mb-0" role="status">
                {exportingPhotos
                  ? '證件照 ZIP 產生中，檔案較大時可能需要一分鐘以上，請勿關閉頁面或重複點擊。'
                  : 'Excel 產生中，請稍候…'}
              </div>
            )}
          </div>
        </div>
      )}

      {canManageSettings && showSettings && (
        <div className="card mb-3 border-warning">
          <div className="card-body py-3">
            <div className="fw-semibold text-warning-emphasis mb-1">報名窗口設定（高風險）</div>
            <p className="small text-muted mb-3">
              開關會立即影響學生端。個人報名與「檢視與修正」僅允許三種組合：兩者皆開（Header：考試報名）、僅檢視與修正（Header：資料修正）、兩者皆關（Header 不顯示）。不可只開個人報名。
            </p>
            <div className="d-flex flex-column flex-sm-row gap-3 flex-wrap">
              <div className="d-flex align-items-center gap-2">
                <span className="small">個人報名</span>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="registrationEnabled"
                    checked={registrationEnabled}
                    onChange={(e) => confirmToggle('individual', e.target.checked, onToggleRegistration)}
                    disabled={isUpdatingSetting || (!registrationEnabled && !registrationEditEnabled)}
                    title={!registrationEnabled && !registrationEditEnabled ? '請先開啟「檢視與修正」' : undefined}
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
                    onChange={(e) => confirmToggle('group', e.target.checked, onToggleRegistrationGroup)}
                    disabled={isUpdatingSetting}
                  />
                  <label className="form-check-label small" htmlFor="registrationGroupEnabled">
                    {registrationGroupEnabled ? '已啟用' : '已停用'}
                  </label>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="small">檢視與修正</span>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="registrationEditEnabled"
                    checked={registrationEditEnabled}
                    onChange={(e) => confirmToggle('edit', e.target.checked, onToggleRegistrationEdit)}
                    disabled={isUpdatingSetting || (registrationEditEnabled && registrationEnabled)}
                    title={registrationEditEnabled && registrationEnabled ? '請先關閉「個人報名」' : undefined}
                  />
                  <label className="form-check-label small" htmlFor="registrationEditEnabled">
                    {registrationEditEnabled ? '已啟用' : '已停用'}
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
        currentExamTypes={advancedFilters?.examTypes || []}
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

      {/* 不再對列表設 maxHeight + overflow：內層捲動區會把「更多」絕對定位選單算進 scrollHeight，列數少時出現大片可捲動留白 */}
      <div ref={tableContainerRef} className="et-individual-table-anchor">
        {loading ? (
          <div className="card">
            <div className="card-body py-5 text-center">
              <div className="spinner-border text-primary" role="status" aria-label="載入中">
                <span className="visually-hidden">載入中...</span>
              </div>
              <p className="mt-2 text-muted small">載入報名列表中...</p>
            </div>
          </div>
        ) : registrations.length === 0 ? (
          <div className="card border-light">
            <div className="card-body text-center py-5">
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
              enableDragSort={enableDragSort}
              onDragEnd={onDragEnd}
              exportArrangeMode={exportArrangeMode}
              onArrangeMove={onArrangeMove}
            />
            <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <small className="text-muted">{rangeLabel}</small>
                {typeof onPageSizeChange === 'function' && (
                  <label className="d-inline-flex align-items-center gap-1 mb-0 small text-muted">
                    <span className="visually-hidden">每頁筆數</span>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 'auto' }}
                      value={String(pageSize)}
                      onChange={(e) => {
                        onPageSizeChange(Number(e.target.value));
                      }}
                      aria-label="每頁筆數"
                    >
                      {ENGLISH_TEST_PAGE_SIZE_OPTIONS.map((opt) => (
                        <option key={String(opt.value)} value={String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {totalPages > 1 && (
                <nav aria-label="分頁導覽">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button
                        type="button"
                        className="page-link"
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        aria-label="上一頁"
                      >
                        上一頁
                      </button>
                    </li>
                    {pageItems.map((item, idx) =>
                      item === '…' ? (
                        <li key={`gap-${idx}`} className="page-item disabled">
                          <span className="page-link">…</span>
                        </li>
                      ) : (
                        <li key={item} className={`page-item ${currentPage === item ? 'active' : ''}`}>
                          <button
                            type="button"
                            className="page-link"
                            onClick={() => onPageChange(item)}
                            aria-label={`第 ${item} 頁`}
                            aria-current={currentPage === item ? 'page' : undefined}
                          >
                            {item}
                          </button>
                        </li>
                      )
                    )}
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button
                        type="button"
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
