/**
 * 培力英檢批量操作。
 */
import { useState, useCallback } from 'react';
import { bulkUpdateRegistrations, deleteRegistration } from '../services/englishTestApi';
import { isValidSemester } from '../utils/semesterUtils';

export function useEnglishTestBulkActions({ token, showToast, loadRegistrations, semester }) {
  const [selectedRows, setSelectedRows] = useState([]);

  const requireSemester = useCallback(() => {
    const semesterCode = String(semester || '').trim();
    if (!isValidSemester(semesterCode)) {
      showToast('請先在篩選條件指定單一學期（例如 115-1），再批次更新，避免改到其他學期並寄出通知信。', 'warning');
      return '';
    }
    return semesterCode;
  }, [semester, showToast]);

  const handleBulkApprove = useCallback(async () => {
    if (selectedRows.length === 0) return;
    const semesterCode = requireSemester();
    if (!semesterCode) return;
    try {
      await bulkUpdateRegistrations(token, { ids: selectedRows, status: 'approved', semester: semesterCode });
      showToast(`成功批量通過 ${selectedRows.length} 筆記錄`, 'success');
      setSelectedRows([]);
      loadRegistrations();
    } catch (error) {
      console.error('批量更新錯誤:', error);
      showToast(error.message || '批量更新失敗', 'danger');
    }
  }, [selectedRows, token, showToast, loadRegistrations, requireSemester]);

  const handleBulkReject = useCallback(async (reasons, other, status = 'revision') => {
    if (selectedRows.length === 0) return;
    const semesterCode = requireSemester();
    if (!semesterCode) return;
    try {
      const result = await bulkUpdateRegistrations(token, {
        ids: selectedRows,
        status,
        rejectionReasons: reasons,
        rejectionOther: other,
        semester: semesterCode,
      });
      const emailSent = result?.emailSent || 0;
      const emailFailed = result?.emailFailed || 0;
      const baseMsg = `成功批量${status === 'revision' ? '請修正' : '設為審核中'} ${selectedRows.length} 筆記錄`;
      const emailMsg = status === 'revision'
        ? `，已寄信 ${emailSent} 封${emailFailed > 0 ? `（失敗 ${emailFailed}）` : ''}`
        : '';
      showToast(
        `${baseMsg}${emailMsg}`,
        emailFailed > 0 ? 'warning' : 'success'
      );
      setSelectedRows([]);
      loadRegistrations();
    } catch (error) {
      console.error('批量更新錯誤:', error);
      showToast(error.message || '批量更新失敗', 'danger');
    }
  }, [selectedRows, token, showToast, loadRegistrations, requireSemester]);

  const handleBulkSetSuccess = useCallback(async () => {
    if (selectedRows.length === 0) return;
    const semesterCode = requireSemester();
    if (!semesterCode) return;
    try {
      await bulkUpdateRegistrations(token, { ids: selectedRows, status: 'success', semester: semesterCode });
      showToast(`已將 ${selectedRows.length} 筆設為「報名成功」`, 'success');
      setSelectedRows([]);
      loadRegistrations();
    } catch (error) {
      console.error('批量設為報名成功錯誤:', error);
      showToast(error.message || '批量更新失敗', 'danger');
    }
  }, [selectedRows, token, showToast, loadRegistrations, requireSemester]);

  const handleBulkSetFailed = useCallback(async (reasons, other) => {
    if (selectedRows.length === 0) return;
    const semesterCode = requireSemester();
    if (!semesterCode) return;
    try {
      const result = await bulkUpdateRegistrations(token, {
        ids: selectedRows,
        status: 'failed',
        rejectionReasons: reasons,
        rejectionOther: other,
        semester: semesterCode,
      });
      const emailSent = result?.emailSent || 0;
      const emailFailed = result?.emailFailed || 0;
      showToast(
        `已將 ${selectedRows.length} 筆設為「報名失敗」，已寄信 ${emailSent} 封${emailFailed > 0 ? `（失敗 ${emailFailed}）` : ''}`,
        emailFailed > 0 ? 'warning' : 'success'
      );
      setSelectedRows([]);
      loadRegistrations();
    } catch (error) {
      console.error('批量設為報名失敗錯誤:', error);
      showToast(error.message || '批量更新失敗', 'danger');
    }
  }, [selectedRows, token, showToast, loadRegistrations, requireSemester]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.length === 0) return;
    try {
      let successCount = 0;
      let failCount = 0;
      for (const id of selectedRows) {
        try {
          await deleteRegistration(token, id);
          successCount++;
        } catch (_) {
          failCount++;
        }
      }
      if (successCount > 0) {
        showToast(`成功刪除 ${successCount} 筆記錄${failCount > 0 ? `，${failCount} 筆失敗` : ''}`, failCount > 0 ? 'warning' : 'success');
        setSelectedRows([]);
        loadRegistrations();
      } else {
        showToast('刪除失敗', 'danger');
      }
    } catch (error) {
      console.error('批量刪除錯誤:', error);
      showToast('批量刪除時發生錯誤', 'danger');
    }
  }, [selectedRows, token, showToast, loadRegistrations]);

  return {
    selectedRows,
    setSelectedRows,
    handleBulkApprove,
    handleBulkReject,
    handleBulkSetSuccess,
    handleBulkSetFailed,
    handleBulkDelete
  };
}
