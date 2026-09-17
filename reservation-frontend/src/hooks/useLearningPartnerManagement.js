import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentSemester, getDefaultLearningPartnerOpsSemester } from '../utils/semesterUtils';
import { getTeamStatusCounts } from '../utils/learningPartnerDisplayHelpers';
import {
  exportLearningPartnerTeamsCsv,
  fetchLearningPartnerTeamById,
  fetchLearningPartnerTeams,
  downloadLearningPartnerExport,
} from '../services/learningPartnerAdminApi';

const LIMIT = 20;
const VALID_ADMIN_VIEWS = new Set(['teams', 'funnel', 'ranking']);

function readLpViewFromSearch(search) {
  const view = new URLSearchParams(search).get('lpView');
  return VALID_ADMIN_VIEWS.has(view) ? view : null;
}

export default function useLearningPartnerManagement(token) {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminView, setAdminViewState] = useState(
    () => readLpViewFromSearch(window.location.search) || 'teams'
  );
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [semesterFilter, setSemesterFilter] = useState(
    () => getDefaultLearningPartnerOpsSemester() || ''
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const syncLpViewToUrl = useCallback((view) => {
    const params = new URLSearchParams(location.search);
    if (view && view !== 'teams') {
      params.set('lpView', view);
    } else {
      params.delete('lpView');
    }
    const next = params.toString();
    const newUrl = next ? `${location.pathname}?${next}` : location.pathname;
    const current = location.search.startsWith('?') ? location.search.slice(1) : location.search;
    if (current === next) return;
    navigate(newUrl, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const setAdminView = useCallback((view) => {
    setAdminViewState(view);
    syncLpViewToUrl(view);
  }, [syncLpViewToUrl]);

  useEffect(() => {
    const fromUrl = readLpViewFromSearch(location.search);
    if (fromUrl && fromUrl !== adminView) {
      setAdminViewState(fromUrl);
    }
  }, [location.search, adminView]);

  const loadTeams = useCallback(async () => {
    if (adminView !== 'teams') return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: LIMIT,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchTerm && { q: searchTerm }),
        ...(semesterFilter && { semester: semesterFilter }),
      });

      const data = await fetchLearningPartnerTeams(token, params);
      setTeams(data.teams || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('載入團體列表錯誤:', error);
      alert(error.message || '載入團體列表時發生錯誤');
    } finally {
      setLoading(false);
    }
  }, [adminView, currentPage, statusFilter, searchTerm, semesterFilter, token]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleViewDetail = async (teamId) => {
    try {
      const data = await fetchLearningPartnerTeamById(token, teamId);
      setSelectedTeam(data.team);
      setShowDetailModal(true);
    } catch (error) {
      console.error('載入團體詳情錯誤:', error);
      alert('載入團體詳情時發生錯誤');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportLearningPartnerTeamsCsv(token);
      downloadLearningPartnerExport(blob, `learning-partner-teams-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('匯出錯誤:', error);
      alert('匯出時發生錯誤');
    } finally {
      setExporting(false);
    }
  };

  const statusCounts = useMemo(() => getTeamStatusCounts(teams, total), [teams, total]);

  const rankingSemester = semesterFilter
    || getDefaultLearningPartnerOpsSemester()
    || getCurrentSemester()
    || '114-2';

  const resetPage = () => setCurrentPage(1);

  const handleSemesterChange = (value) => {
    setSemesterFilter(value);
    resetPage();
  };

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    resetPage();
  };

  const handleSearchTermChange = (value) => {
    setSearchTerm(value);
    resetPage();
  };

  const closeDetailModal = () => setShowDetailModal(false);

  return {
    adminView,
    setAdminView,
    teams,
    loading,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    semesterFilter,
    setSemesterFilter,
    currentPage,
    setCurrentPage,
    totalPages,
    total,
    selectedTeam,
    showDetailModal,
    setShowDetailModal,
    exporting,
    handleViewDetail,
    handleExport,
    statusCounts,
    rankingSemester,
    handleSemesterChange,
    handleStatusFilterChange,
    handleSearchTermChange,
    closeDetailModal,
  };
}
