/**
 * 培力英檢 Excel 匯出 query：與列表 buildListParams 語意對齊（不含 page/limit）。
 */
export function appendExportListParams(params, {
  statusFilter = 'all',
  searchTerm = '',
  advancedFilters = {},
  sortConfig = null,
} = {}) {
  if (statusFilter && statusFilter !== 'all') {
    params.append('status', statusFilter);
  }
  if (searchTerm) {
    params.append('search', searchTerm);
  }
  if (advancedFilters.dateFrom) params.append('dateFrom', advancedFilters.dateFrom);
  if (advancedFilters.dateTo) params.append('dateTo', advancedFilters.dateTo);
  (advancedFilters.examTypes || []).forEach((t) => params.append('examTypes', t));
  if (advancedFilters.semester) params.append('semester', advancedFilters.semester);
  if (advancedFilters.isLowIncome) params.append('isLowIncome', advancedFilters.isLowIncome);
  if (advancedFilters.hasDisabilityCard) {
    params.append('hasDisabilityCard', advancedFilters.hasDisabilityCard);
  }
  if (sortConfig?.key) {
    params.append('sortBy', sortConfig.key);
    params.append('sortOrder', sortConfig.direction || 'DESC');
  }
  return params;
}
