import { useState, useEffect, useCallback, useMemo } from 'react';
import { getCurrentSemester } from '../utils/semesterUtils';
import { getTeamStatusCounts } from '../utils/learningPartnerDisplayHelpers';
import {
  exportLearningPartnerTeamsCsv,
  fetchLearningPartnerTeamById,
  fetchLearningPartnerTeams,
  downloadLearningPartnerExport,
} from '../services/learningPartnerAdminApi';

const LIMIT = 20;

export default function useLearningPartnerManagement(token) {
  const [adminView, setAdminView] = useState('teams');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [semesterFilter, setSemesterFilter] = useState(getCurrentSemester() || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadTeams = useCallback(async () => {
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
  }, [currentPage, statusFilter, searchTerm, semesterFilter, token]);

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

  const rankingSemester = semesterFilter || getCurrentSemester() || '114-1';

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
