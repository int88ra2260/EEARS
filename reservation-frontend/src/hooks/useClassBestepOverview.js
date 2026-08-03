import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { handleAPIError } from '../utils/errorHandler';
import { getCurrentSemester } from '../utils/semesterUtils';
import { downloadBlob, exportClassBestepOverview, fetchClassBestepOverview } from '../services/classAdminApi';
import { sanitizeFileName } from '../utils/classBestepDisplayHelpers';

export function useClassBestepOverview(classId) {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [classInfo, setClassInfo] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [filters, setFilters] = useState({
    semester: searchParams.get('semester') || getCurrentSemester(),
    examType: 'all',
    search: '',
    page: 1,
    pageSize: 50,
  });
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [searchTimeout, setSearchTimeout] = useState(null);

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('semester', filters.semester);
      params.append('examType', filters.examType);
      params.append('page', filters.page);
      params.append('pageSize', filters.pageSize);
      if (filters.search) params.append('search', filters.search);

      const token = localStorage.getItem('token');
      const result = await fetchClassBestepOverview(token, classId, Object.fromEntries(params));
      setClassInfo(result.classInfo);
      setStatistics(result.statistics);
      setStudents(result.students || []);
      setPagination(result.pagination || { total: 0, totalPages: 0 });
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

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  }, []);

  const handleSearchChange = useCallback((value) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => handleFilterChange('search', value), 300));
  }, [searchTimeout, handleFilterChange]);

  const handleShowStudentDetail = useCallback((student) => {
    setSelectedStudent(student);
    setShowStudentModal(true);
  }, []);

  const closeStudentModal = useCallback(() => setShowStudentModal(false), []);

  const handleExportBestepExcel = useCallback(async () => {
    if (exporting || !classId) return;
    setExporting(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const blob = await exportClassBestepOverview(token, classId, {
        semester: filters.semester,
        examType: filters.examType,
        search: filters.search,
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const safeClassName = sanitizeFileName(classInfo?.className || 'class');
      downloadBlob(blob, `班級參與概況_BESTEP_${safeClassName}_${dateStr}.xlsx`);
    } catch (err) {
      setError(`匯出失敗：${err.message || err}`);
    } finally {
      setExporting(false);
    }
  }, [exporting, classId, filters, classInfo]);

  return {
    loading,
    error,
    exporting,
    classInfo,
    statistics,
    students,
    selectedStudent,
    showStudentModal,
    filters,
    pagination,
    handleFilterChange,
    handleSearchChange,
    handleShowStudentDetail,
    closeStudentModal,
    handleExportBestepExcel,
  };
}
