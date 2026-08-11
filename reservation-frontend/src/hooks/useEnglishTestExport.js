/**
 * 培力英檢匯出：Excel / 證件照。
 * 匯出範圍由呼叫端傳入（與列表狀態篩選同步）。
 */
import { useCallback } from 'react';
import { exportRegistrationsExcel, exportRegistrationPhotos, downloadBlob } from '../services/englishTestApi';

const STATUS_FILE_LABEL = {
  pending: '待審核',
  approved: '已通過',
  revision: '請修正',
  success: '報名成功',
  failed: '報名失敗',
};

export function useEnglishTestExport({ token, showToast }) {
  const handleExport = useCallback(async (statusFilter = 'all') => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const statusLabel = STATUS_FILE_LABEL[statusFilter];
      let fileName = statusLabel ? `培力英檢報名資料_${statusLabel}` : '培力英檢報名資料';
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
