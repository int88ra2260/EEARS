/**
 * 培力英檢匯出：Excel / 證件照。
 */
import { useState, useCallback } from 'react';
import { exportRegistrationsExcel, exportRegistrationPhotos, downloadBlob } from '../services/englishTestApi';

export function useEnglishTestExport({ token, showToast }) {
  const [exportStatusFilter, setExportStatusFilter] = useState('all');

  const handleExport = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (exportStatusFilter !== 'all') {
        params.append('status', exportStatusFilter);
      }

      let fileName = '培力英檢報名資料';
      if (exportStatusFilter === 'pending') fileName = '培力英檢報名資料_待審核';
      else if (exportStatusFilter === 'approved') fileName = '培力英檢報名資料_已通過';
      else if (exportStatusFilter === 'revision') fileName = '培力英檢報名資料_請修正';
      else if (exportStatusFilter === 'success') fileName = '培力英檢報名資料_報名成功';
      else if (exportStatusFilter === 'failed') fileName = '培力英檢報名資料_報名失敗';
      fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

      const blob = await exportRegistrationsExcel(token, params);
      downloadBlob(blob, fileName);
    } catch (error) {
      console.error('匯出錯誤:', error);
      showToast(error.message || '匯出時發生錯誤', 'danger');
    }
  }, [exportStatusFilter, token, showToast]);

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
    exportStatusFilter,
    setExportStatusFilter,
    handleExport,
    handleExportPhotos
  };
}
