/**
 * 培力英檢管理頁：組合列表、詳情、狀態、批量、匯出、快速審核等 hooks。
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEnglishTestRegistrations } from './useEnglishTestRegistrations';
import { useEnglishTestDetail } from './useEnglishTestDetail';
import { useEnglishTestStatusUpdate } from './useEnglishTestStatusUpdate';
import { useEnglishTestRejection } from './useEnglishTestRejection';
import { useEnglishTestBulkActions } from './useEnglishTestBulkActions';
import { useEnglishTestExport } from './useEnglishTestExport';
import { useEnglishTestEmails } from './useEnglishTestEmails';
import { useEnglishTestQuickReview } from './useEnglishTestQuickReview';
import { useEnglishTestAdminUpdate } from './useEnglishTestAdminUpdate';
import { useEnglishTestAnalytics } from './useEnglishTestAnalytics';
import { useRegistrationSetting } from './useRegistrationSetting';
import { useConfirmModal } from './useConfirmModal';
import {
  adjustRegistrationSequence,
  deleteRegistration,
  fetchClassBestepLink,
  fetchRegistrationById,
} from '../services/englishTestApi';

export function useEnglishTestManagement({ token, canViewEnglishTests }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState('individual');
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [adjustingSequence, setAdjustingSequence] = useState(false);
  const tableContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const openRejectionModalRef = useRef(() => {});
  const setShowRejectionModalRef = useRef(() => {});
  const { confirmModal, openConfirm, closeConfirm } = useConfirmModal();

  const showToast = useCallback((message, variant = 'success') => {
    setToast({ show: true, message, variant });
  }, []);

  const list = useEnglishTestRegistrations({
    token,
    mainTab,
    canViewEnglishTests,
    showToast,
  });

  const settings = useRegistrationSetting({ token, showToast });
  const analytics = useEnglishTestAnalytics({ token, mainTab });
  const exportOps = useEnglishTestExport({ token, showToast });
  const bulk = useEnglishTestBulkActions({ token, showToast, loadRegistrations: list.loadRegistrations });
  const emails = useEnglishTestEmails({ token, openConfirm, showToast });

  const detail = useEnglishTestDetail({
    token,
    registrations: list.registrations,
    setRegistrations: list.setRegistrations,
    currentPage: list.currentPage,
    setCurrentPage: list.setCurrentPage,
    totalPages: list.totalPages,
    total: list.total,
    limit: list.limit,
    buildListParams: list.buildListParams,
    setLoading: list.setLoading,
    setTotalPages: list.setTotalPages,
    setTotal: list.setTotal,
    setStats: list.setStats,
    showToast,
    tableContainerRef,
    scrollPositionRef,
  });

  const status = useEnglishTestStatusUpdate({
    token,
    selectedRegistration: detail.selectedRegistration,
    setSelectedRegistration: detail.setSelectedRegistration,
    showToast,
    setRegistrations: list.setRegistrations,
    loadRegistrations: list.loadRegistrations,
    setSelectedRows: bulk.setSelectedRows,
    setShowRejectionModal: (...args) => setShowRejectionModalRef.current(...args),
    showDetailModal: detail.showDetailModal,
    handleViewDetail: detail.handleViewDetail,
    onOpenRejectionModal: () => openRejectionModalRef.current(),
  });

  const rejection = useEnglishTestRejection({
    pendingStatusUpdate: status.pendingStatusUpdate,
    setPendingStatusUpdate: status.setPendingStatusUpdate,
    performStatusUpdate: status.performStatusUpdate,
  });

  openRejectionModalRef.current = rejection.openRejectionModal;
  setShowRejectionModalRef.current = rejection.setShowRejectionModal;

  const adminUpdate = useEnglishTestAdminUpdate({
    selectedRegistration: detail.selectedRegistration,
    setSelectedRegistration: detail.setSelectedRegistration,
    registrations: list.registrations,
    setRegistrations: list.setRegistrations,
    loadRegistrations: list.loadRegistrations,
    showToast,
  });

  const quickReview = useEnglishTestQuickReview({
    registrations: list.registrations,
    currentPage: list.currentPage,
    totalPages: list.totalPages,
    buildListParams: list.buildListParams,
    token,
    showToast,
    setRegistrations: list.setRegistrations,
    setTotalPages: list.setTotalPages,
    setTotal: list.setTotal,
    setStats: list.setStats,
    setCurrentPage: list.setCurrentPage,
    selectedRegistration: detail.selectedRegistration,
    setSelectedRegistration: detail.setSelectedRegistration,
    performStatusUpdate: status.performStatusUpdate,
    loadRegistrations: list.loadRegistrations,
  });

  const {
    loadRegistrations,
    statusFilter,
    sortConfig,
    setSortConfig,
    setStatusFilter,
    setCurrentPage,
    setAdvancedFilters,
    loading: listLoading,
    registrations,
  } = list;
  const {
    showDetailModal,
    handleViewDetail,
    handleCloseDetailModal,
    selectedRegistration,
    setSelectedRegistration,
  } = detail;
  const {
    showStatusModal,
    setShowStatusModal,
  } = status;
  const {
    showRejectionModal,
    handleCloseRejectionModal,
  } = rejection;
  const {
    showQuickReview,
    setShowQuickReview,
    setQuickReviewIndex,
  } = quickReview;

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  useEffect(() => {
    if (statusFilter === 'success' && sortConfig.key !== 'successSequence') {
      setSortConfig({ key: 'successSequence', direction: 'ASC' });
    }
  }, [statusFilter, sortConfig.key, setSortConfig]);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const idFromUrl = urlParams.get('id');
    if (idFromUrl && mainTab === 'individual' && !showDetailModal && !listLoading && token) {
      const registrationId = parseInt(idFromUrl, 10);
      if (!isNaN(registrationId) && registrationId > 0) {
        const foundInList = registrations.find(reg => reg.id === registrationId);
        if (foundInList) {
          const foundIndex = registrations.findIndex(reg => reg.id === registrationId);
          handleViewDetail(registrationId, foundIndex);
        } else {
          handleViewDetail(registrationId);
        }
        urlParams.delete('id');
        const newSearch = urlParams.toString();
        const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
        navigate(newUrl, { replace: true });
      }
    }
  }, [
    location.search,
    location.pathname,
    showDetailModal,
    listLoading,
    token,
    registrations,
    mainTab,
    navigate,
    handleViewDetail,
  ]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (confirmModal.show) {
        closeConfirm();
        return;
      }
      if (showRejectionModal) {
        handleCloseRejectionModal();
        return;
      }
      if (showStatusModal) {
        setShowStatusModal(false);
        return;
      }
      if (showDetailModal) {
        handleCloseDetailModal();
        return;
      }
      if (showQuickReview) {
        setShowQuickReview(false);
        setQuickReviewIndex(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    confirmModal.show,
    showRejectionModal,
    handleCloseRejectionModal,
    showStatusModal,
    setShowStatusModal,
    showDetailModal,
    handleCloseDetailModal,
    showQuickReview,
    setShowQuickReview,
    setQuickReviewIndex,
    closeConfirm,
  ]);

  const handleGoToClassBestep = useCallback(async (registrationId) => {
    try {
      const data = await fetchClassBestepLink(token, registrationId);
      if (!data.classId) {
        showToast('此學期查無班級名冊對應，無法前往班級 BESTEP', 'warning');
        return;
      }
      navigate(`/admin/classes/${data.classId}/bestep?semester=${encodeURIComponent(data.semester || '')}`);
    } catch (e) {
      showToast(e.message || '無法前往', 'danger');
    }
  }, [token, navigate, showToast]);

  const handleDelete = useCallback((id) => {
    openConfirm({
      title: '確認刪除',
      message: '確定要刪除此報名資料嗎？此操作無法復原。',
      confirmLabel: '刪除',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteRegistration(token, id);
          showToast('刪除成功', 'success');
          loadRegistrations();
        } catch (error) {
          showToast(error.message || '刪除時發生錯誤', 'danger');
        }
      }
    });
  }, [token, openConfirm, showToast, loadRegistrations]);

  const handleAdjustSequence = useCallback(async (id, action, targetSequence = null) => {
    if (adjustingSequence) return;
    try {
      setAdjustingSequence(true);
      const body = { action };
      if (targetSequence !== null) body.targetSequence = targetSequence;
      const data = await adjustRegistrationSequence(token, id, body);
      const actionText = action === 'up' ? '上移' : action === 'down' ? '下移' : '移動';
      showToast(`${actionText}成功，新序號：${data.newSequence}`, 'success');
      if (statusFilter === 'success' && sortConfig.key !== 'successSequence') {
        setSortConfig({ key: 'successSequence', direction: 'ASC' });
      }
      await loadRegistrations();
      if (selectedRegistration && selectedRegistration.id === id) {
        const refreshed = await fetchRegistrationById(token, id);
        setSelectedRegistration(refreshed);
      }
    } catch (error) {
      showToast(error.message || '調整順序時發生錯誤', 'danger');
    } finally {
      setAdjustingSequence(false);
    }
  }, [
    adjustingSequence,
    token,
    showToast,
    statusFilter,
    sortConfig.key,
    setSortConfig,
    loadRegistrations,
    selectedRegistration,
    setSelectedRegistration,
  ]);

  const handleStatsCardClick = useCallback((filterType, filterValue) => {
    if (filterType === 'status') {
      setStatusFilter(filterValue);
      setCurrentPage(1);
      if (filterValue === 'success') {
        setSortConfig({ key: 'successSequence', direction: 'ASC' });
      }
    } else if (filterType === 'examType') {
      setAdvancedFilters(prev => ({ ...prev, examTypes: [filterValue] }));
      setCurrentPage(1);
    }
  }, [setStatusFilter, setCurrentPage, setSortConfig, setAdvancedFilters]);

  const getStatusText = useCallback((s) => {
    const statusMap = {
      pending: { text: '審核中', class: 'warning' },
      approved: { text: '已通過', class: 'success' },
      revision: { text: '請修正', class: 'danger' },
      success: { text: '報名成功', class: 'success' },
      failed: { text: '報名失敗', class: 'secondary' }
    };
    return statusMap[s] || { text: s, class: 'secondary' };
  }, []);

  return {
    mainTab,
    setMainTab,
    toast,
    setToast,
    adjustingSequence,
    tableContainerRef,
    confirmModal,
    closeConfirm,
    list,
    settings,
    analytics,
    exportOps,
    bulk,
    emails,
    detail,
    status,
    rejection,
    adminUpdate,
    quickReview,
    handleGoToClassBestep,
    handleDelete,
    handleAdjustSequence,
    handleStatsCardClick,
    getStatusText,
  };
}
