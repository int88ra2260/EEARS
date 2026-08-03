/**
 * 違規／黑名單管理：列表、登記、刪除、搜尋排序。
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeAPICall, showErrorMessage } from '../utils/errorHandler';
import { getSemesterInfo, getSemesterOptions } from '../utils/adminReportUtils';
import {
  deleteViolation,
  fetchBlacklistRecords,
  recordViolation,
} from '../services/blacklistAdminApi';

export function useViolationManagement({
  token,
  userRole,
  canAccessViolations,
  canManageBlacklist,
  confirm,
}) {
  const actualUserRole = userRole || 'worker';

  const [blackListRecords, setBlackListRecords] = useState([]);
  const [blacklistLoading, setBlacklistLoading] = useState(true);
  const [selectedViolationSemester, setSelectedViolationSemester] = useState(() =>
    getSemesterInfo(new Date().toISOString().split('T')[0]),
  );
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('eventDate');
  const [sortOrder, setSortOrder] = useState('desc');

  const [violationStudentId, setViolationStudentId] = useState('');
  const [violationName, setViolationName] = useState('');
  const [violationReason, setViolationReason] = useState('');

  const loadBlacklistRecords = useCallback(async (semester = selectedViolationSemester) => {
    setBlacklistLoading(true);
    const result = await safeAPICall(async () =>
      fetchBlacklistRecords(token, actualUserRole, { semester }),
    );
    if (result.success) {
      setBlackListRecords(result.data || []);
      setError('');
    } else {
      setError(result.error || '載入黑名單紀錄失敗');
    }
    setBlacklistLoading(false);
  }, [token, actualUserRole, selectedViolationSemester]);

  const handleViolationSemesterChange = useCallback((semester) => {
    setSelectedViolationSemester(semester);
    loadBlacklistRecords(semester);
  }, [loadBlacklistRecords]);

  const handleRecordViolation = useCallback(async () => {
    if (!violationStudentId.trim() || !violationName.trim() || !violationReason.trim()) {
      showErrorMessage('請填寫所有必填欄位');
      return;
    }
    const result = await safeAPICall(async () =>
      recordViolation(token, actualUserRole, {
        studentId: violationStudentId.trim(),
        name: violationName.trim(),
        reason: violationReason.trim(),
      }),
    );
    if (result.success) {
      setViolationStudentId('');
      setViolationName('');
      setViolationReason('');
      loadBlacklistRecords(selectedViolationSemester);
      showErrorMessage('違規登記成功！');
    } else {
      showErrorMessage(result.error || '違規登記失敗');
    }
  }, [
    token,
    actualUserRole,
    violationStudentId,
    violationName,
    violationReason,
    loadBlacklistRecords,
    selectedViolationSemester,
  ]);

  const handleDeleteViolation = useCallback(async (violationId) => {
    if (!canManageBlacklist) {
      showErrorMessage('您沒有刪除違規紀錄的權限');
      return;
    }
    const ok = await confirm({
      title: '確認刪除違規紀錄？',
      description: '此操作無法復原。',
      confirmText: '刪除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) return;

    const result = await safeAPICall(async () =>
      deleteViolation(token, actualUserRole, violationId),
    );
    if (result.success) {
      loadBlacklistRecords(selectedViolationSemester);
      showErrorMessage('違規紀錄已刪除！');
    } else {
      showErrorMessage(result.error || '刪除失敗');
    }
  }, [confirm, token, actualUserRole, canManageBlacklist, loadBlacklistRecords, selectedViolationSemester]);

  const handleSort = useCallback((field) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('desc');
      return field;
    });
  }, []);

  const sortedAndFilteredRecords = useMemo(() => {
    let filtered = [...blackListRecords];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((record) => {
        const studentId = record.User?.studentId || '';
        const name = record.User?.name || '';
        return studentId.toLowerCase().includes(term) || name.toLowerCase().includes(term);
      });
    }
    filtered.sort((a, b) => {
      if (sortField === 'eventDate') {
        const aDate = a.eventDate ? new Date(a.eventDate) : new Date(0);
        const bDate = b.eventDate ? new Date(b.eventDate) : new Date(0);
        return sortOrder === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }
      if (sortField === 'date') {
        const aDate = new Date(a.recordedAt);
        const bDate = new Date(b.recordedAt);
        return sortOrder === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }
      if (sortField === 'studentId') {
        const aVal = (a.User?.studentId || '').toLowerCase();
        const bVal = (b.User?.studentId || '').toLowerCase();
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }
      return 0;
    });
    return filtered;
  }, [blackListRecords, searchTerm, sortField, sortOrder]);

  useEffect(() => {
    if (canAccessViolations) {
      loadBlacklistRecords(selectedViolationSemester);
    }
  }, [canAccessViolations]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    semesterOptions: getSemesterOptions(),
    selectedViolationSemester,
    handleViolationSemesterChange,
    error,
    searchTerm,
    setSearchTerm,
    sortField,
    sortOrder,
    handleSort,
    blackListRecords,
    sortedAndFilteredRecords,
    blacklistLoading,
    violationStudentId,
    setViolationStudentId,
    violationName,
    setViolationName,
    violationReason,
    setViolationReason,
    handleRecordViolation,
    handleDeleteViolation,
  };
}
