/**
 * 培力英檢 Excel／證件照匯出 query：與列表 buildListParams 語意對齊（不含 page/limit）。
 */
import { appendSortQueryParams } from './englishTestSortConfig';

export function appendExportListParams(params, {
  statusFilter = 'all',
  searchTerm = '',
  advancedFilters = {},
  sortConfig = null,
  orderedIds = null,
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
  (advancedFilters.grades || []).forEach((g) => params.append('grades', g));
  if (advancedFilters.semester) params.append('semester', advancedFilters.semester);
  if (advancedFilters.isLowIncome) params.append('isLowIncome', advancedFilters.isLowIncome);
  if (advancedFilters.hasDisabilityCard) {
    params.append('hasDisabilityCard', advancedFilters.hasDisabilityCard);
  }
  if (sortConfig?.key || sortConfig?.levels?.length) {
    appendSortQueryParams(params, sortConfig);
  }
  if (Array.isArray(orderedIds) && orderedIds.length > 0) {
    params.set('orderedIds', orderedIds.map((id) => Number(id)).filter((n) => Number.isInteger(n) && n > 0).join(','));
  }
  return params;
}
