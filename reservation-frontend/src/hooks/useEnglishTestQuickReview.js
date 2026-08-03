/**
 * 培力英檢「快速審核模式」。
 */
import { useState, useCallback, useEffect } from 'react';
import { fetchRegistrations } from '../services/englishTestApi';

export function useEnglishTestQuickReview({
  registrations,
  currentPage,
  totalPages,
  buildListParams,
  token,
  showToast,
  setRegistrations,
  setTotalPages,
  setTotal,
  setStats,
  setCurrentPage,
  selectedRegistration,
  setSelectedRegistration,
  performStatusUpdate,
  loadRegistrations
}) {
  const [showQuickReview, setShowQuickReview] = useState(false);
  const [quickReviewIndex, setQuickReviewIndex] = useState(-1);

  const handleOpenQuickReview = useCallback(() => {
    const pendingRegistrations = registrations.filter(reg => reg.status === 'pending');
    if (pendingRegistrations.length === 0) {
      showToast('目前沒有待審核的記錄', 'warning');
      return;
    }
    setQuickReviewIndex(0);
    setSelectedRegistration(pendingRegistrations[0]);
    setShowQuickReview(true);
  }, [registrations, showToast, setSelectedRegistration]);

  const fetchNextPageForQuickReview = useCallback(async () => {
    const nextPage = currentPage + 1;
    if (nextPage > totalPages) return false;
    const data = await fetchRegistrations(token, buildListParams(nextPage));
    const list = data.data || [];
    if (list.length === 0) return false;
    setRegistrations(list);
    setTotalPages(data.totalPages || 1);
    setTotal(data.total || 0);
    if (data.stats) setStats(data.stats);
    setCurrentPage(nextPage);
    setQuickReviewIndex(0);
    setSelectedRegistration(list[0]);
    return true;
  }, [currentPage, totalPages, buildListParams, token, setRegistrations, setTotalPages, setTotal, setStats, setCurrentPage, setSelectedRegistration]);

  const handleQuickReviewNext = useCallback(async () => {
    const pendingRegistrations = registrations.filter(reg => reg.status === 'pending');
    if (pendingRegistrations.length === 0) {
      const loaded = await fetchNextPageForQuickReview();
      if (!loaded) {
        showToast('已審核完所有待審核記錄', 'success');
        setShowQuickReview(false);
        setQuickReviewIndex(-1);
      }
      return;
    }
    const nextIndex = quickReviewIndex + 1;
    if (nextIndex < pendingRegistrations.length) {
      setQuickReviewIndex(nextIndex);
      setSelectedRegistration(pendingRegistrations[nextIndex]);
      return;
    }
    const loaded = await fetchNextPageForQuickReview();
    if (!loaded) {
      showToast('已審核完所有待審核記錄', 'success');
      setShowQuickReview(false);
      setQuickReviewIndex(-1);
    }
  }, [registrations, quickReviewIndex, fetchNextPageForQuickReview, showToast, setSelectedRegistration]);

  useEffect(() => {
    if (showQuickReview && quickReviewIndex >= 0 && registrations.length > 0) {
      const pendingRegistrations = registrations.filter(reg => reg.status === 'pending');
      if (pendingRegistrations.length > 0) {
        const validIndex = Math.min(quickReviewIndex, pendingRegistrations.length - 1);
        if (validIndex >= 0 && pendingRegistrations[validIndex]) {
          if (!selectedRegistration || selectedRegistration.id !== pendingRegistrations[validIndex].id) {
            setSelectedRegistration(pendingRegistrations[validIndex]);
          }
          if (validIndex !== quickReviewIndex) {
            setQuickReviewIndex(validIndex);
          }
        } else if (pendingRegistrations.length > 0) {
          setSelectedRegistration(pendingRegistrations[0]);
          setQuickReviewIndex(0);
        } else {
          setShowQuickReview(false);
          setQuickReviewIndex(-1);
        }
      } else {
        setShowQuickReview(false);
        setQuickReviewIndex(-1);
      }
    }
  }, [registrations, showQuickReview, quickReviewIndex, selectedRegistration, setSelectedRegistration]);

  const handleQuickReviewApprove = useCallback(async () => {
    if (!selectedRegistration) return;
    await performStatusUpdate('approved', null, null, selectedRegistration.id);
    await loadRegistrations();
  }, [selectedRegistration, performStatusUpdate, loadRegistrations]);

  const handleQuickReviewReject = useCallback(async (reasons, other) => {
    if (!selectedRegistration) return;
    await performStatusUpdate('revision', reasons, other, selectedRegistration.id);
    await loadRegistrations();
  }, [selectedRegistration, performStatusUpdate, loadRegistrations]);

  return {
    showQuickReview,
    setShowQuickReview,
    quickReviewIndex,
    setQuickReviewIndex,
    handleOpenQuickReview,
    fetchNextPageForQuickReview,
    handleQuickReviewNext,
    handleQuickReviewApprove,
    handleQuickReviewReject
  };
}
