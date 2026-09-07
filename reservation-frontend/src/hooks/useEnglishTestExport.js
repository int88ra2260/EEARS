/**
 * 培力英檢匯出：Excel / 證件照。
 * Excel 匯出範圍與列表一致（狀態＋進階篩選＋搜尋＋排序）。
 */
import { useCallback } from 'react';
import { exportRegistrationsExcel, exportRegistrationPhotos, downloadBlob } from '../services/englishTestApi';
import { appendExportListParams } from '../utils/englishTestExportParams';

const STATUS_FILE_LABEL = {
  pending: '待審核',
  approved: '已通過',
  revision: '請修正',
  success: '報名成功',
  failed: '報名失敗',
};

export function useEnglishTestExport({ token, showToast }) {
  const handleExport = useCallback(async (exportOptions = {}) => {
    // 相容舊呼叫：handleExport('approved') 或 handleExport({ statusFilter, ... })
    const options = typeof exportOptions === 'string'
      ? { statusFilter: exportOptions }
      : (exportOptions || {});

    try {
      const {
        statusFilter = 'all',
        searchTerm = '',
        advancedFilters = {},
        sortConfig = null,
      } = options;

      const params = new URLSearchParams();
      appendExportListParams(params, {
        statusFilter,
        searchTerm,
        advancedFilters,
        sortConfig,
      });

      const statusLabel = STATUS_FILE_LABEL[statusFilter];
      let fileName = statusLabel ? `培力英檢報名資料_${statusLabel}` : '培力英檢報名資料';
      if (advancedFilters.semester) {
        fileName += `_${advancedFilters.semester}`;
      }
      fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

      const blob = await exportRegistrationsExcel(token, params);
      downloadBlob(blob, fileName);
    } catch (error) {
      console.error('匯出錯誤:', error);
      showToast(error.message || '匯出時發生錯誤', 'danger');
    }
  }, [token, showToast]);

  const handleExportPhotos = useCallback(async (status = 'approved') => {
    try {
      const blob = await exportRegistrationPhotos(token, status);
      const statusText = status === 'success' ? '報名成功' : '已通過';
      downloadBlob(blob, `培力英檢${statusText}證件照_${new Date().toISOString().split('T')[0]}.zip`);
      showToast(`已匯出${statusText}證件照`, 'success');
    } catch (error) {
      console.error('匯出證件照錯誤:', error);
      showToast(error.message || '匯出證件照時發生錯誤', 'danger');
    }
  }, [token, showToast]);

  return {
    handleExport,
    handleExportPhotos,
  };
}
