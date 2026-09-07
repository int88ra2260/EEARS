/**
 * 培力英檢報名列表：載入、分頁、篩選、排序、統計。
 */
import { useState, useCallback, useEffect } from 'react';
import { getCurrentSemester } from '../utils/semesterUtils';
import { fetchRegistrations } from '../services/englishTestApi';

const SORT_CONFIG_KEY = 'englishTestSortConfig';
const PAGE_SIZE_KEY = 'englishTestPageSize';
const DEFAULT_SORT = { key: 'id', direction: 'ASC' };
const DEFAULT_PAGE_SIZE = 100;
/** 「顯示全部」時送給 API 的上限（避免一次拉過大） */
export const ENGLISH_TEST_ALL_PAGE_SIZE = 5000;
export const ENGLISH_TEST_PAGE_SIZE_OPTIONS = [
  { value: 50, label: '50 筆' },
  { value: 100, label: '100 筆' },
  { value: 200, label: '200 筆' },
  { value: 'all', label: '顯示全部' },
];
const VALID_STATUS = new Set(['all', 'pending', 'approved', 'success', 'revision', 'failed']);
const VALID_PAGE_SIZES = new Set(ENGLISH_TEST_PAGE_SIZE_OPTIONS.map((o) => String(o.value)));

const defaultStats = () => ({
  total: 0,
  pending: 0,
  approved: 0,
  revision: 0,
  success: 0,
  failed: 0,
  nonExam: 0,
  listeningReading: 0,
  speakingWriting: 0
});

const defaultAdvancedFilters = () => ({
  dateFrom: '',
  dateTo: '',
  examTypes: [],
  isLowIncome: '',
  hasDisabilityCard: '',
  semester: getCurrentSemester() || ''
});

function getInitialSortConfig() {
  try {
    const saved = localStorage.getItem(SORT_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return DEFAULT_SORT;
}

function normalizePageSize(raw) {
  const key = String(raw ?? '');
  if (!VALID_PAGE_SIZES.has(key)) return DEFAULT_PAGE_SIZE;
  return key === 'all' ? 'all' : Number(key);
}

function resolveApiLimit(pageSize) {
  return pageSize === 'all' ? ENGLISH_TEST_ALL_PAGE_SIZE : pageSize;
}

function getInitialPageSize() {
  try {
    return normalizePageSize(localStorage.getItem(PAGE_SIZE_KEY));
  } catch (e) {
    return DEFAULT_PAGE_SIZE;
  }
}

/**
 * @param {Object} options
 * @param {string} options.token
 * @param {string} options.mainTab
 * @param {boolean} [options.canViewEnglishTests=true]
 * @param {(message: string, variant?: string) => void} [options.showToast]
 */
export function useEnglishTestRegistrations({
  token,
  mainTab,
  canViewEnglishTests = true,
  showToast,
  initialStatusFilter = 'all',
}) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSizeState] = useState(() => getInitialPageSize());
  const [statusFilter, setStatusFilter] = useState(
    VALID_STATUS.has(initialStatusFilter) ? initialStatusFilter : 'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState(defaultAdvancedFilters());
  const [sortConfig, setSortConfig] = useState(() => getInitialSortConfig());
  const [stats, setStats] = useState(defaultStats());
  const [todayNewCount, setTodayNewCount] = useState(0);

  const apiLimit = resolveApiLimit(pageSize);

  const setPageSize = useCallback((next) => {
    const normalized = normalizePageSize(next);
    setPageSizeState(normalized);
    setCurrentPage(1);
  }, []);

  const buildListParams = useCallback((pageOverride = null) => {
    const p = new URLSearchParams();
    const page = pageOverride !== null ? pageOverride : currentPage;
    p.set('page', String(pageSize === 'all' ? 1 : page));
    p.set('limit', String(apiLimit));
    if (statusFilter && statusFilter !== 'all') p.set('status', statusFilter);
    if (searchTerm) p.set('search', searchTerm);
    if (mainTab === 'individual' && advancedFilters.dateFrom) p.set('dateFrom', advancedFilters.dateFrom);
    if (mainTab === 'individual' && advancedFilters.dateTo) p.set('dateTo', advancedFilters.dateTo);
    (advancedFilters.examTypes || []).forEach(t => p.append('examTypes', t));
    if (mainTab === 'individual' && advancedFilters.semester) p.set('semester', advancedFilters.semester);
    if (mainTab === 'individual' && advancedFilters.isLowIncome) p.set('isLowIncome', advancedFilters.isLowIncome);
    if (mainTab === 'individual' && advancedFilters.hasDisabilityCard) p.set('hasDisabilityCard', advancedFilters.hasDisabilityCard);
    if (mainTab === 'individual' && sortConfig.key) {
      p.set('sortBy', sortConfig.key);
      p.set('sortOrder', sortConfig.direction);
    }
    return p;
  }, [currentPage, pageSize, apiLimit, statusFilter, searchTerm, mainTab, advancedFilters, sortConfig]);

  const loadRegistrations = useCallback(async () => {
    if (mainTab !== 'individual') {
      setLoading(false);
      return;
    }
    if (!canViewEnglishTests) {
      setRegistrations([]);
      setTotalPages(1);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchRegistrations(token, buildListParams());
      setRegistrations(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      if (data.stats) setStats(data.stats);
      if (mainTab === 'individual' && data.data) {
        const today = new Date().toISOString().split('T')[0];
        const count = data.data.filter(reg => {
          const regDate = new Date(reg.createdAt).toISOString().split('T')[0];
          return regDate === today;
        }).length;
        setTodayNewCount(count);
      }
    } catch (error) {
      console.error('載入報名列表錯誤:', error);
      const message = error.message || '載入報名列表失敗';
      if (showToast) {
        showToast(`載入報名列表時發生錯誤: ${message}`, 'danger');
      }
    } finally {
      setLoading(false);
    }
  }, [buildListParams, mainTab, token, canViewEnglishTests, showToast]);

  useEffect(() => {
    localStorage.setItem(SORT_CONFIG_KEY, JSON.stringify(sortConfig));
  }, [sortConfig]);

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_KEY, String(pageSize));
  }, [pageSize]);

  return {
    limit: apiLimit,
    pageSize,
    setPageSize,
    registrations,
    setRegistrations,
    loading,
    setLoading,
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
    total,
    setTotal,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    advancedFilters,
    setAdvancedFilters,
    sortConfig,
    setSortConfig,
    stats,
    setStats,
    todayNewCount,
    loadRegistrations,
    buildListParams
  };
}
