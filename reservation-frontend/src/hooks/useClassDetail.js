import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { handleAPIError } from '../utils/errorHandler';
import {
  downloadBlob,
  exportClassDetailOverview,
  fetchClassDetailOverview,
} from '../services/classAdminApi';

const DEFAULT_CLASS_INFO = {
  id: null,
  name: '載入中...',
  semester: '114-1',
  department: '',
  teacherName: '',
};

export function useClassDetail(classId) {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [classInfo, setClassInfo] = useState(DEFAULT_CLASS_INFO);
  const [filters, setFilters] = useState({
    semester: searchParams.get('semester') || '114-1',
    activityType: 'All',
    search: '',
    sortBy: 'studentId',
    sortOrder: 'asc',
    page: 1,
    pageSize: 50,
  });
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const searchTimeoutRef = useRef(null);

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const token = localStorage.getItem('token');
      const result = await fetchClassDetailOverview(token, classId, Object.fromEntries(params));
      setData(result.data || []);
      setPagination(result.pagination || { total: 0, totalPages: 0 });
      if (result.classInfo) {
        setClassInfo({
          id: result.classInfo.id,
          name: result.classInfo.name || '未知班級',
          semester: result.classInfo.semester || filters.semester,
          department: result.classInfo.department || '',
          teacherName: result.classInfo.teacherName || '',
        });
      }
    } catch (err) {
      const errMsg = handleAPIError(err);
      setError(errMsg?.display || errMsg?.zh || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [classId, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  }, []);

  const handleSearchChange = useCallback((value) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => handleFilterChange('search', value), 300);
  }, [handleFilterChange]);

  const handleExport = useCallback(async () => {
    if (!classId) return;
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const blob = await exportClassDetailOverview(token, classId, {
        semester: filters.semester,
        activityType: filters.activityType,
      });
      downloadBlob(blob, `${classInfo?.name || '班級'}_明細_${filters.semester}.xlsx`);
    } catch (err) {
      setError(`匯出失敗：${err.message}`);
    } finally {
      setExporting(false);
    }
  }, [classId, filters.semester, filters.activityType, classInfo?.name]);

  return {
    data,
    loading,
    error,
    exporting,
    classInfo,
    filters,
    pagination,
    handleFilterChange,
    handleSearchChange,
    handleExport,
  };
}
