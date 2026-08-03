/**
 * 班級參與概況：篩選、載入、匯出、名冊匯入、刪除。
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { handleAPIError } from '../utils/errorHandler';
import { getCurrentSemester } from '../utils/semesterUtils';
import {
  fetchClassOverview,
  exportClassOverview,
  downloadClassRosterSample,
  importClassRoster,
  previewClassRosterPdf,
  importClassRosterPdf,
  deleteClass,
  downloadBlob,
} from '../services/classAdminApi';

const DEFAULT_FILTERS = {
  semester: getCurrentSemester() || '114-1',
  q: '',
  studentId: '',
  teacherName: '',
  sortBy: 'coverage',
  sortOrder: 'desc',
  page: 1,
  pageSize: 20,
};

function buildClassName(courseName, courseCode) {
  const name = String(courseName || '').trim();
  const code = String(courseCode || '').trim();
  if (name && code) return `${name} ${code}`;
  return name || code || '';
}

export function useClassOverview({ token }) {
  const location = useLocation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTab, setUploadTab] = useState('excel');
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCourseName, setUploadCourseName] = useState('');
  const [uploadCourseCode, setUploadCourseCode] = useState('');
  const [uploadTeacherName, setUploadTeacherName] = useState('');
  const [uploadSemester, setUploadSemester] = useState(getCurrentSemester() || '114-1');
  const [uploadResult, setUploadResult] = useState(null);

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetClass, setTargetClass] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchClassOverview(token, filters);
      setData(result.data);
      setPagination(result.pagination);
    } catch (err) {
      const errMsg = handleAPIError(err);
      setError(errMsg?.display || errMsg?.zh || err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (location.pathname === '/admin/classes') {
      loadData();
    }
  }, [location.pathname, loadData]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  }, []);

  const debouncedFilterChange = useCallback((key, value, delay = 300) => {
    const timer = setTimeout(() => handleFilterChange(key, value), delay);
    return () => clearTimeout(timer);
  }, [handleFilterChange]);

  const handleExport = useCallback(async () => {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await exportClassOverview(token, filters.semester);
      downloadBlob(blob, `班級參與概況_${filters.semester}.xlsx`);
    } catch (err) {
      setError(err.message || '匯出失敗');
    } finally {
      setExporting(false);
    }
  }, [token, filters.semester]);

  const handleDownloadSample = useCallback(async () => {
    if (!token) return;
    try {
      const blob = await downloadClassRosterSample(token);
      downloadBlob(blob, '班級名單範例.xlsx');
    } catch (err) {
      setError(err.message || '下載範例檔案失敗');
    }
  }, [token]);

  const resetUploadModalFields = useCallback(() => {
    setUploadFile(null);
    setPdfFile(null);
    setPdfPreview(null);
    setUploadCourseName('');
    setUploadCourseCode('');
    setUploadTeacherName('');
    setUploadSemester(getCurrentSemester() || '114-1');
    setUploadTab('excel');
    setError('');
  }, []);

  const closeUploadModal = useCallback(() => {
    setShowUploadModal(false);
    resetUploadModalFields();
  }, [resetUploadModalFields]);

  const validateCourseMeta = useCallback((fileToUpload) => {
    if (!fileToUpload) {
      setError('請選擇檔案');
      return false;
    }
    if (!String(uploadCourseName || '').trim()) {
      setError('請輸入課程名稱');
      return false;
    }
    if (!String(uploadCourseCode || '').trim()) {
      setError('請輸入課程代碼');
      return false;
    }
    if (!String(uploadTeacherName || '').trim()) {
      setError('請輸入老師姓名');
      return false;
    }
    if (!uploadSemester) {
      setError('請選擇學期');
      return false;
    }
    setError('');
    return true;
  }, [uploadCourseName, uploadCourseCode, uploadTeacherName, uploadSemester]);

  const performClassRosterImport = useCallback(async (fileToUpload) => {
    if (!token) return;
    setUploading(true);
    setError('');
    try {
      const result = await importClassRoster(token, {
        file: fileToUpload,
        semester: uploadSemester,
        courseName: uploadCourseName,
        courseCode: uploadCourseCode,
        teacherName: uploadTeacherName,
        className: buildClassName(uploadCourseName, uploadCourseCode),
      });
      setUploadResult(result);
      setShowUploadModal(false);
      resetUploadModalFields();
      loadData();
    } catch (err) {
      setError(err.message || '上傳失敗');
    } finally {
      setUploading(false);
    }
  }, [
    token,
    uploadSemester,
    uploadCourseName,
    uploadCourseCode,
    uploadTeacherName,
    resetUploadModalFields,
    loadData,
  ]);

  const handleExcelSubmit = useCallback(async (event, fileFromPanel) => {
    event.preventDefault();
    const fileToUpload = fileFromPanel || uploadFile;
    if (!validateCourseMeta(fileToUpload)) return;
    await performClassRosterImport(fileToUpload);
  }, [uploadFile, validateCourseMeta, performClassRosterImport]);

  const handlePdfFileChange = useCallback((file) => {
    setPdfFile(file || null);
    setPdfPreview(null);
    setError('');
  }, []);

  const handlePdfPreview = useCallback(async (event, fileFromPanel) => {
    event.preventDefault();
    if (!token) return;
    const fileToParse = fileFromPanel || pdfFile;
    if (!fileToParse) {
      setError('請選擇 PDF 檔案');
      return;
    }
    setPdfPreviewLoading(true);
    setError('');
    try {
      const result = await previewClassRosterPdf(token, fileToParse);
      setPdfPreview(result);
      setPdfFile(fileToParse);
      if (result.course?.semester) setUploadSemester(result.course.semester);
      if (result.course?.courseName) setUploadCourseName(result.course.courseName);
      if (result.course?.courseCode) setUploadCourseCode(result.course.courseCode);
      if (result.course?.teacherName) setUploadTeacherName(result.course.teacherName);
    } catch (err) {
      setPdfPreview(null);
      setError(err.message || 'PDF 解析失敗');
    } finally {
      setPdfPreviewLoading(false);
    }
  }, [token, pdfFile]);

  const handlePdfSubmit = useCallback(async () => {
    if (!token) return;
    if (!pdfFile || !pdfPreview) {
      setError('請先解析預覽 PDF');
      return;
    }
    if (!validateCourseMeta(pdfFile)) return;
    setUploading(true);
    setError('');
    try {
      const result = await importClassRosterPdf(token, {
        file: pdfFile,
        semester: uploadSemester,
        courseName: uploadCourseName,
        courseCode: uploadCourseCode,
        teacherName: uploadTeacherName,
      });
      setUploadResult(result);
      setShowUploadModal(false);
      resetUploadModalFields();
      loadData();
    } catch (err) {
      setError(err.message || 'PDF 匯入失敗');
    } finally {
      setUploading(false);
    }
  }, [
    token,
    pdfFile,
    pdfPreview,
    validateCourseMeta,
    uploadSemester,
    uploadCourseName,
    uploadCourseCode,
    uploadTeacherName,
    resetUploadModalFields,
    loadData,
  ]);

  const openDeleteModal = useCallback((classItem) => {
    setTargetClass(classItem);
    setDeleteError('');
    setShowDeleteModal(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setTargetClass(null);
    setDeleteError('');
  }, []);

  const handleDeleteClass = useCallback(async () => {
    if (!targetClass || !token) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const result = await deleteClass(token, targetClass.classId);
      setStatusMessage(result.message || `班級「${targetClass.className}」已刪除`);
      setError('');
      closeDeleteModal();
      loadData();
    } catch (err) {
      setDeleteError(err.message || '刪除班級失敗');
    } finally {
      setDeleteLoading(false);
    }
  }, [targetClass, token, closeDeleteModal, loadData]);

  return {
    data,
    loading,
    error,
    setError,
    statusMessage,
    setStatusMessage,
    exporting,
    filters,
    pagination,
    handleFilterChange,
    debouncedFilterChange,
    loadData,
    handleExport,
    handleDownloadSample,
    showUploadModal,
    setShowUploadModal,
    uploadTab,
    setUploadTab,
    uploading,
    uploadFile,
    setUploadFile,
    uploadCourseName,
    setUploadCourseName,
    uploadCourseCode,
    setUploadCourseCode,
    uploadTeacherName,
    setUploadTeacherName,
    uploadSemester,
    setUploadSemester,
    uploadResult,
    setUploadResult,
    pdfFile,
    pdfPreview,
    pdfPreviewLoading,
    handlePdfFileChange,
    handlePdfPreview,
    handlePdfSubmit,
    closeUploadModal,
    handleExcelSubmit,
    showDeleteModal,
    targetClass,
    deleteLoading,
    deleteError,
    openDeleteModal,
    closeDeleteModal,
    handleDeleteClass,
  };
}
