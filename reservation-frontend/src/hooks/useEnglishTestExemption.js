/**
 * 培力英檢抵免審核列表與提交。
 */
import { useState, useEffect, useCallback } from 'react';
import { getCurrentSemester } from '../utils/semesterUtils';
import { handleAPIError } from '../utils/errorHandler';
import { fetchExemptionReviewList, updateExemptionReview } from '../services/englishTestApi';

const LIMIT = 30;

export function useEnglishTestExemption({ token }) {
  const [semester, setSemester] = useState(getCurrentSemester() || '114-1');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pendingNav, setPendingNav] = useState(null);
  const [reviewAction, setReviewAction] = useState('approved');
  const [verifiedType, setVerifiedType] = useState('LRSW');
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        semester,
        page: String(page),
        limit: String(LIMIT),
      });
      if (appliedSearch.trim()) params.append('search', appliedSearch.trim());
      const data = await fetchExemptionReviewList(token, params);
      setRows(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      const errMsg = handleAPIError(e);
      setError(errMsg?.display || errMsg?.zh || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, semester, page, appliedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const openReview = useCallback((row) => {
    setSelected(row);
    setReviewAction(
      row.exemption_review_status === 'approved' ? 'approved' :
      row.exemption_review_status === 'rejected' ? 'rejected' :
      row.exemption_review_status === 'revision' ? 'revision' : 'pending'
    );
    setVerifiedType(row.exemption_verified_type || 'LRSW');
    setReviewNote(row.exemption_review_note || '');
    setShowModal(true);
  }, []);

  const submitReview = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateExemptionReview(token, selected.id, {
        exemption_review_status: reviewAction,
        exemption_verified_type: reviewAction === 'approved' ? verifiedType : null,
        exemption_review_note: reviewNote,
      });
      setShowModal(false);
      setSelected(null);
      load();
    } catch (e) {
      try {
        window.dispatchEvent(
          new CustomEvent('eears:toast', {
            detail: { message: handleAPIError(e)?.display || '操作失敗', variant: 'danger' },
          })
        );
      } catch (_) {}
    } finally {
      setSaving(false);
    }
  }, [selected, token, reviewAction, verifiedType, reviewNote, load]);

  const applySearch = useCallback(() => {
    setAppliedSearch(search);
    setPage(1);
  }, [search]);

  return {
    semester,
    setSemester,
    search,
    setSearch,
    appliedSearch,
    page,
    setPage,
    loading,
    error,
    rows,
    total,
    totalPages,
    limit: LIMIT,
    showModal,
    setShowModal,
    selected,
    setSelected,
    pendingNav,
    setPendingNav,
    reviewAction,
    setReviewAction,
    verifiedType,
    setVerifiedType,
    reviewNote,
    setReviewNote,
    saving,
    lightbox,
    setLightbox,
    load,
    openReview,
    submitReview,
    applySearch,
  };
}
