/**
 * 培力英檢匯出：Excel / 證件照。
 * 匯出範圍與列表一致（狀態＋進階篩選＋搜尋＋排序＋可選手動順序）。
 * 證件照另限制狀態須為已通過／報名成功。
 */
import { useCallback, useRef, useState } from 'react';
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
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPhotos, setExportingPhotos] = useState(false);
  const busyRef = useRef({ excel: false, photos: false });

  const handleExport = useCallback(async (exportOptions = {}) => {
    if (busyRef.current.excel || busyRef.current.photos) return;

    const options = typeof exportOptions === 'string'
      ? { statusFilter: exportOptions }
      : (exportOptions || {});

    busyRef.current.excel = true;
    setExportingExcel(true);
    try {
      const {
        statusFilter = 'all',
        searchTerm = '',
        advancedFilters = {},
        sortConfig = null,
        orderedIds = null,
      } = options;

      const params = new URLSearchParams();
      appendExportListParams(params, {
        statusFilter,
        searchTerm,
        advancedFilters,
        sortConfig,
        orderedIds,
      });

      const statusLabel = STATUS_FILE_LABEL[statusFilter];
      let fileName = statusLabel ? `培力英檢報名資料_${statusLabel}` : '培力英檢報名資料';
      if (advancedFilters.semester) {
        fileName += `_${advancedFilters.semester}`;
      }
      fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

      const blob = await exportRegistrationsExcel(token, params);
      downloadBlob(blob, fileName);
      showToast('Excel 已開始下載', 'success');
    } catch (error) {
      console.error('匯出錯誤:', error);
      showToast(error.message || '匯出時發生錯誤', 'danger');
    } finally {
      busyRef.current.excel = false;
      setExportingExcel(false);
    }
  }, [token, showToast]);

  const handleExportPhotos = useCallback(async (exportOptions = {}) => {
    if (busyRef.current.excel || busyRef.current.photos) return;

    const options = typeof exportOptions === 'string'
      ? { statusFilter: exportOptions }
      : (exportOptions || {});

    const {
      statusFilter = 'approved',
      searchTerm = '',
      advancedFilters = {},
      sortConfig = null,
      orderedIds = null,
    } = options;

    if (!['approved', 'success'].includes(statusFilter)) {
      showToast('請先切換狀態為「已通過」或「報名成功」再匯出證件照', 'warning');
      return;
    }

    busyRef.current.photos = true;
    setExportingPhotos(true);
    try {
      const params = new URLSearchParams();
      appendExportListParams(params, {
        statusFilter,
        searchTerm,
        advancedFilters,
        sortConfig,
        orderedIds,
      });

      const statusText = statusFilter === 'success' ? '報名成功' : '已通過';
      let fileName = `培力英檢${statusText}證件照`;
      if (advancedFilters.semester) {
        fileName += `_${advancedFilters.semester}`;
      }
      fileName += `_${new Date().toISOString().split('T')[0]}.zip`;

      const blob = await exportRegistrationPhotos(token, params);
      downloadBlob(blob, fileName);
      showToast(`已匯出${statusText}證件照`, 'success');
    } catch (error) {
      console.error('匯出證件照錯誤:', error);
      showToast(error.message || '匯出證件照時發生錯誤', 'danger');
    } finally {
      busyRef.current.photos = false;
      setExportingPhotos(false);
    }
  }, [token, showToast]);

  return {
    handleExport,
    handleExportPhotos,
    exportingExcel,
    exportingPhotos,
  };
}
