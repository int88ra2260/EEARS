/**
 * 培力英檢報名詳情：單筆載入、Modal 開關、上一筆/下一筆導航、關閉時還原捲動。
 */
import { useState, useCallback } from 'react';
import { fetchRegistrations, fetchRegistrationById } from '../services/englishTestApi';

export function useEnglishTestDetail({
  token,
  registrations,
  setRegistrations,
  currentPage,
  setCurrentPage,
  totalPages,
  total,
  limit,
  buildListParams,
  setLoading,
  setTotalPages,
  setTotal,
  setStats,
  showToast,
  tableContainerRef,
  scrollPositionRef
}) {
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentRegistrationIndex, setCurrentRegistrationIndex] = useState(-1);

  const handleViewDetail = useCallback(async (id, index = null) => {
    if (tableContainerRef?.current) {
      scrollPositionRef.current = tableContainerRef.current.scrollTop ?? 0;
    }
    try {
      const data = await fetchRegistrationById(token, id);
      setSelectedRegistration(data);
      if (index !== null) {
        setCurrentRegistrationIndex(index);
      } else {
        const foundIndex = registrations.findIndex(reg => reg.id === id);
        setCurrentRegistrationIndex(foundIndex);
      }
      setShowDetailModal(true);
    } catch (error) {
      console.error('載入詳細資料錯誤:', error);
      if (showToast) showToast('載入詳細資料時發生錯誤', 'danger');
    }
  }, [token, registrations, scrollPositionRef, tableContainerRef, showToast]);

  const fetchPageAndOpenAt = useCallback(async (page, indexInPage) => {
    setLoading(true);
    try {
      const data = await fetchRegistrations(token, buildListParams(page));
      const list = data.data || [];
      const index = indexInPage !== undefined ? indexInPage : Math.max(0, list.length - 1);
      const reg = list[index];
      if (!reg) return;
      setRegistrations(list);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      if (data.stats) setStats(data.stats);
      setCurrentPage(page);
      setCurrentRegistrationIndex(index);
      const detail = await fetchRegistrationById(token, reg.id);
      setSelectedRegistration(detail);
      setShowDetailModal(true);
    } catch (e) {
      console.error(e);
      if (showToast) showToast('載入上一筆/下一筆時發生錯誤', 'danger');
    } finally {
      setLoading(false);
    }
  }, [token, buildListParams, setRegistrations, setCurrentPage, setTotalPages, setTotal, setStats, setLoading, showToast]);

  const handleNavigatePrevious = useCallback(() => {
    if (currentRegistrationIndex > 0) {
      const prev = registrations[currentRegistrationIndex - 1];
      handleViewDetail(prev.id, currentRegistrationIndex - 1);
      return;
    }
    if (currentPage > 1) {
      fetchPageAndOpenAt(currentPage - 1, undefined);
    }
  }, [currentRegistrationIndex, registrations, currentPage, handleViewDetail, fetchPageAndOpenAt]);

  const handleNavigateNext = useCallback(() => {
    if (currentRegistrationIndex < registrations.length - 1) {
      const next = registrations[currentRegistrationIndex + 1];
      handleViewDetail(next.id, currentRegistrationIndex + 1);
      return;
    }
    if (currentPage < totalPages) {
      fetchPageAndOpenAt(currentPage + 1, 0);
    }
  }, [currentRegistrationIndex, registrations, currentPage, totalPages, handleViewDetail, fetchPageAndOpenAt]);

  const canNavigatePrevious = total > 0 && (currentPage > 1 || currentRegistrationIndex > 0);
  const canNavigateNext = total > 0 && (currentPage < totalPages || currentRegistrationIndex < registrations.length - 1);

  const handleCloseDetailModal = useCallback(() => {
    setShowDetailModal(false);
    setCurrentRegistrationIndex(-1);
    requestAnimationFrame(() => {
      if (tableContainerRef?.current && scrollPositionRef?.current !== undefined) {
        tableContainerRef.current.scrollTop = scrollPositionRef.current;
      }
    });
  }, [tableContainerRef, scrollPositionRef]);

  return {
    selectedRegistration,
    setSelectedRegistration,
    showDetailModal,
    setShowDetailModal,
    currentRegistrationIndex,
    setCurrentRegistrationIndex,
    handleViewDetail,
    fetchPageAndOpenAt,
    handleNavigatePrevious,
    handleNavigateNext,
    canNavigatePrevious,
    canNavigateNext,
    handleCloseDetailModal
  };
}
