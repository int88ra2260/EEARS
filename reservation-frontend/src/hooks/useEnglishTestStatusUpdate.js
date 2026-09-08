/**
 * 培力英檢報名狀態更新。
 */
import { useState, useCallback } from 'react';
import { fetchRegistrationById, updateRegistration } from '../services/englishTestApi';
import useConfirm from '../components/ui/useConfirm';
import { getEnglishTestStatusEmailConfirm } from '../utils/englishTestStatusEmailConfirm';

export function useEnglishTestStatusUpdate({
  token,
  selectedRegistration,
  setSelectedRegistration,
  showToast,
  setRegistrations,
  loadRegistrations,
  setSelectedRows,
  setShowRejectionModal,
  showDetailModal = false,
  handleViewDetail,
  onOpenRejectionModal
}) {
  const { confirm } = useConfirm();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState({ status: '', notes: '' });
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState(null);

  const performStatusUpdate = useCallback(async (newStatus, reasons, other, targetId = null) => {
    const id = targetId || selectedRegistration?.id;
    if (!id) return;

    if (newStatus === 'revision' || newStatus === 'failed') {
      const ok = await confirm(getEnglishTestStatusEmailConfirm({ status: newStatus, count: 1 }));
      if (!ok) return;
    }

    try {
      const requestBody = {
        status: newStatus,
        notes: selectedRegistration?.notes || ''
      };
      if (newStatus === 'revision' || newStatus === 'failed') {
        requestBody.rejectionReasons = reasons || [];
        requestBody.rejectionOther = other || '';
      }

      const result = await updateRegistration(token, id, requestBody);
      const statusText = { pending: '審核中', approved: '已通過', revision: '請修正', success: '報名成功', failed: '報名失敗' }[newStatus] || newStatus;
      const emailHint = (newStatus === 'revision' || newStatus === 'failed') ? '，已寄送通知信' : '';
      showToast(`狀態已更新為「${statusText}」${emailHint}`, 'success');
      if (selectedRegistration && selectedRegistration.id === id) {
        const updatedData = result.registration || result;
        setSelectedRegistration(updatedData);
      }
      setRegistrations(prev =>
        prev.map(reg => reg.id === id ? { ...reg, status: newStatus } : reg)
      );
      loadRegistrations();
      setShowRejectionModal(false);
      setPendingStatusUpdate(null);
      setSelectedRows(prev => prev.filter(rowId => rowId !== id));
    } catch (error) {
      console.error('更新狀態錯誤:', error);
      showToast(error.message || '更新狀態時發生錯誤', 'danger');
    }
  }, [token, selectedRegistration, setSelectedRegistration, showToast, setRegistrations, loadRegistrations, setSelectedRows, setShowRejectionModal, confirm]);

  const handleQuickStatusUpdate = useCallback(async (id, newStatus) => {
    const targetId = id || selectedRegistration?.id;
    if (!targetId) return;

    if (newStatus === 'revision' || newStatus === 'failed') {
      if (id && !selectedRegistration) {
        try {
          const data = await fetchRegistrationById(token, id);
          setSelectedRegistration(data);
        } catch (_) {}
      }
      setPendingStatusUpdate(newStatus);
      onOpenRejectionModal();
      return;
    }
    await performStatusUpdate(newStatus, null, null, targetId);
  }, [selectedRegistration, setSelectedRegistration, token, performStatusUpdate, onOpenRejectionModal]);

  const handleUpdateStatus = useCallback(async () => {
    if (!selectedRegistration) return;

    if (statusUpdate.status === 'revision' || statusUpdate.status === 'failed') {
      setPendingStatusUpdate(statusUpdate.status);
      setShowStatusModal(false);
      onOpenRejectionModal();
      return;
    }

    try {
      await updateRegistration(token, selectedRegistration.id, statusUpdate);
      showToast('狀態更新成功', 'success');
      setShowStatusModal(false);
      setStatusUpdate({ status: '', notes: '' });
      loadRegistrations();
      if (showDetailModal && handleViewDetail) {
        handleViewDetail(selectedRegistration.id);
      }
    } catch (error) {
      console.error('更新狀態錯誤:', error);
      showToast(error.message || '狀態更新失敗', 'danger');
    }
  }, [selectedRegistration, statusUpdate, token, showDetailModal, handleViewDetail, loadRegistrations, onOpenRejectionModal, showToast]);

  const handleStatusSelectChange = useCallback((newStatus) => {
    setStatusUpdate(prev => ({ ...prev, status: newStatus }));
    if (newStatus === 'revision' || newStatus === 'failed') {
      setPendingStatusUpdate(newStatus);
      setShowStatusModal(false);
      onOpenRejectionModal();
    }
  }, [onOpenRejectionModal]);

  return {
    showStatusModal,
    setShowStatusModal,
    statusUpdate,
    setStatusUpdate,
    pendingStatusUpdate,
    setPendingStatusUpdate,
    performStatusUpdate,
    handleQuickStatusUpdate,
    handleUpdateStatus,
    handleStatusSelectChange
  };
}
