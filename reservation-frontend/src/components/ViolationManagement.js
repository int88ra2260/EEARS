// src/components/ViolationManagement.js
// 違規管理頁面
import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import dayjs from 'dayjs';
import { safeAPICall } from '../utils/errorHandler';
import useConfirm from './ui/useConfirm';
import useToast from './ui/useToast';
import { P } from '../constants/permissions';
import { hasAnyPermission } from '../utils/accessControl';
import { fetchSemesterReservations } from '../services/blacklistAdminApi';
import { createEventViolation } from '../services/eventAdminService';
import ViolationReservationPickerModal from './admin/violations/ViolationReservationPickerModal';

// 學期日期範圍判斷函數
function getSemesterInfo(date) {
  const eventDate = new Date(date);
  const year = eventDate.getFullYear();
  const month = eventDate.getMonth() + 1; // getMonth() 返回 0-11
  
  // 113-2學期: 2025/02/01 到 2025/07/31
  if (year === 2025 && month >= 2 && month <= 7) {
    return '113-2';
  }
  // 114-1學期: 2025/08/01 到 2026/01/31
  if ((year === 2025 && month >= 8) || (year === 2026 && month <= 1)) {
    return '114-1';
  }
  // 114-2學期: 2026/02/01 到 2026/07/31
  if (year === 2026 && month >= 2 && month <= 7) {
    return '114-2';
  }
  // 115-1學期: 2026/09/01 到 2027/01/31
  if ((year === 2026 && month >= 9) || (year === 2027 && month <= 1)) {
    return '115-1';
  }
  // 115-2學期: 2027/02/01 到 2027/07/31
  if (year === 2027 && month >= 2 && month <= 7) {
    return '115-2';
  }
  
  return 'other';
}

// 學期選項
function getSemesterOptions() {
  return [
    { value: 'all', label: '全部學期' },
    { value: '113-2', label: '113-2 (2025/02-2025/07)' },
    { value: '114-1', label: '114-1 (2025/08-2026/01)' },
    { value: '114-2', label: '114-2 (2026/02-2026/07)' },
    { value: '115-1', label: '115-1 (2026/08-2027/01)' }
  ];
}

function ViolationManagement() {
  const { token, userRole, accessProfile } = useOutletContext();
  const { confirm } = useConfirm();
  const toast = useToast();
  
  // ===== 違規管理 =====
  const [blackListRecords, setBlackListRecords] = useState([]);
  const [blacklistLoading, setBlacklistLoading] = useState(true);
  const [selectedViolationSemester, setSelectedViolationSemester] = useState(() => {
    // 取得當前學期
    const now = new Date();
    return getSemesterInfo(now.toISOString().split('T')[0]);
  });
  const [error, setError] = useState('');
  
  // ===== 搜尋和排序 =====
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('eventDate'); // 'eventDate' | 'date' | 'studentId'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' 或 'desc'
  
  // ===== 違規登記 =====
  const [violationStudentId, setViolationStudentId] = useState('');
  const [violationName, setViolationName] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSubmitting, setPickerSubmitting] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerSemester, setPickerSemester] = useState('');
  const [pickerStudent, setPickerStudent] = useState(null);
  const [pickerReservations, setPickerReservations] = useState([]);
  const [selectedReservationId, setSelectedReservationId] = useState('');
  const [violationType, setViolationType] = useState('預約未到');
  const [violationDescription, setViolationDescription] = useState('');

  // 角色權限檢查
  const actualUserRole = userRole || 'worker';
  const canAccessViolations = hasAnyPermission(accessProfile, [
    P.CAN_MANAGE_VIOLATIONS,
    P.CAN_MANAGE_BLACKLIST,
    P.CAN_VIEW_BLACKLIST,
  ]);
  const canManageBlacklist = accessProfile?.permissionSet?.has(P.CAN_MANAGE_BLACKLIST);
  const canRecordEventViolation = accessProfile?.permissionSet?.has(P.CAN_MANAGE_VIOLATIONS);

  // 取得黑名單紀錄
  const fetchBlacklistRecords = async (semester = 'all') => {
    setBlacklistLoading(true);
    
    const result = await safeAPICall(async () => {
      const params = new URLSearchParams();
      if (semester !== 'all') params.append('semester', semester);
      
      const url = params.toString() 
        ? `/api/blacklist?${params.toString()}`
        : '/api/blacklist';
      
      const response = await fetch(url, { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-User-Role': actualUserRole
        } 
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { response: { status: response.status, data: errorData } };
      }
      
      return response.json();
    });
    
    if (result.success) {
      setBlackListRecords(result.data || []);
      setError('');
    } else {
      setError(result.error || '載入黑名單紀錄失敗');
      console.error('載入黑名單紀錄失敗:', result.error);
    }
    
    setBlacklistLoading(false);
  };

  // 學期篩選變更
  const handleViolationSemesterChange = (semester) => {
    setSelectedViolationSemester(semester);
    fetchBlacklistRecords(semester);
  };

  const resetPicker = () => {
    setPickerOpen(false);
    setPickerError('');
    setPickerSemester('');
    setPickerStudent(null);
    setPickerReservations([]);
    setSelectedReservationId('');
    setViolationType('預約未到');
    setViolationDescription('');
  };

  const handleLookupReservations = async () => {
    if (!canRecordEventViolation) {
      setLookupError('您沒有登記違規的權限');
      return;
    }
    const studentId = violationStudentId.trim();
    const name = violationName.trim();
    if (!studentId || !name) {
      setLookupError('請填寫學號與姓名');
      return;
    }

    setLookupError('');
    setPickerLoading(true);
    setPickerError('');
    try {
      const data = await fetchSemesterReservations(token, actualUserRole, { studentId, name });
      const rows = Array.isArray(data.reservations) ? data.reservations : [];
      setPickerStudent(data.student || { studentId, name });
      setPickerSemester(data.semester || '');
      setPickerReservations(rows);
      setSelectedReservationId('');
      setViolationType('預約未到');
      setViolationDescription('');
      setPickerOpen(true);
    } catch (error) {
      setLookupError(error.message || '查詢預約失敗');
    } finally {
      setPickerLoading(false);
    }
  };

  const handleRecordSelectedViolation = async () => {
    const selected = pickerReservations.find(
      (row) => String(row.reservationId) === String(selectedReservationId),
    );
    if (!selected?.selectable || !selected.eventId) {
      setPickerError('請選擇一筆尚未登記違規的預約');
      return;
    }
    if (violationType === '其他' && !violationDescription.trim()) {
      setPickerError('類型為「其他」時請填寫說明');
      return;
    }

    setPickerSubmitting(true);
    setPickerError('');
    try {
      await createEventViolation(token, selected.eventId, {
        studentId: violationStudentId.trim(),
        violationType,
        description: violationDescription.trim(),
      });
      toast.success('已將這筆預約登記為違規。當學期次數會在活動結束檢查時記入黑名單。');
      resetPicker();
      setViolationStudentId('');
      setViolationName('');
      fetchBlacklistRecords(selectedViolationSemester);
    } catch (error) {
      setPickerError(error.message || '登記違規失敗');
    } finally {
      setPickerSubmitting(false);
    }
  };

  // 刪除違規紀錄
  const handleDeleteViolation = async (violationId) => {
    if (!canManageBlacklist) {
      toast.error('您沒有刪除違規紀錄的權限');
      return;
    }
    const ok = await confirm({
      title: '確認刪除違規紀錄？',
      description: '此操作無法復原。',
      confirmText: '刪除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }

    const result = await safeAPICall(async () => {
      const response = await fetch(`/api/blacklist/${violationId}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}`,
          'X-User-Role': actualUserRole
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { response: { status: response.status, data: errorData } };
      }

      return response.json();
    });

    if (result.success) {
      fetchBlacklistRecords(selectedViolationSemester);
      toast.success('違規紀錄已刪除');
      if (result.data?.emailNotice && result.data.emailNotice.queued === false) {
        toast.warning(result.data.emailNotice.reason === 'no_email'
          ? '已刪除，但沒有可寄送的學生信箱，未寄出通知'
          : '已刪除，但通知信未能寄出');
      }
    } else {
      toast.error(result.error || '刪除失敗');
    }
  };

  // 處理排序
  const handleSort = (field) => {
    if (sortField === field) {
      // 如果點擊同一個欄位，切換排序順序
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 如果點擊不同欄位，設定新欄位並預設降序
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // 排序和篩選資料
  const getSortedAndFilteredRecords = () => {
    let filtered = [...blackListRecords];

    // 搜尋篩選
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(record => {
        const studentId = record.User?.studentId || '';
        const name = record.User?.name || '';
        return studentId.toLowerCase().includes(term) || name.toLowerCase().includes(term);
      });
    }

    // 排序
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
  };

  // 初始化載入
  useEffect(() => {
    if (canAccessViolations) {
      fetchBlacklistRecords(selectedViolationSemester);
    }
  }, [canAccessViolations]); // 只在組件掛載時執行一次

  // 如果沒有違規管理權限，顯示權限不足訊息
  if (!canAccessViolations) {
    return (
      <div className="alert alert-warning">
        <i className="fas fa-exclamation-triangle me-2"></i>
        您沒有權限訪問違規管理功能，請聯繫管理員。
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-end align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex align-items-center gap-2">
          <label className="form-label mb-0">學期篩選：</label>
          <select 
            className="form-select" 
            value={selectedViolationSemester} 
            onChange={(e) => handleViolationSemesterChange(e.target.value)}
            style={{ minWidth: '250px' }}
          >
            {getSemesterOptions().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
        </div>
      )}

      {/* 搜尋和排序控制區域 */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex align-items-center flex-wrap gap-3">
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0" htmlFor="violation-search">搜尋：</label>
            <input
              id="violation-search"
              type="text"
              className="form-control"
              placeholder="輸入學號或姓名"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ minWidth: '200px' }}
            />
          </div>
          <div className="d-flex align-items-center flex-wrap gap-2">
            <span className="form-label mb-0">排序：</span>
            <div className="btn-group flex-wrap" role="group">
              <button
                type="button"
                className={`btn btn-sm ${sortField === 'eventDate' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => handleSort('eventDate')}
              >
                活動日期 {sortField === 'eventDate' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${sortField === 'date' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => handleSort('date')}
              >
                日期 {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${sortField === 'studentId' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => handleSort('studentId')}
              >
                學號 {sortField === 'studentId' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>
        </div>
        <div className="text-muted small">
          顯示 {getSortedAndFilteredRecords().length} / {blackListRecords.length} 筆
        </div>
      </div>

      {canRecordEventViolation ? (
        <div className="mb-3">
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label visually-hidden" htmlFor="violation-student-id">學號</label>
              <input
                id="violation-student-id"
                className="form-control"
                placeholder="學號"
                value={violationStudentId}
                onChange={(e) => {
                  setViolationStudentId(e.target.value);
                  setLookupError('');
                }}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label visually-hidden" htmlFor="violation-student-name">姓名</label>
              <input
                id="violation-student-name"
                className="form-control"
                placeholder="姓名"
                value={violationName}
                onChange={(e) => {
                  setViolationName(e.target.value);
                  setLookupError('');
                }}
              />
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-danger w-100"
                onClick={handleLookupReservations}
                disabled={pickerLoading}
              >
                {pickerLoading ? '查詢中...' : '查詢預約並登記'}
              </button>
            </div>
          </div>
          {lookupError ? (
            <div className="alert alert-danger mt-2 mb-0" role="alert">{lookupError}</div>
          ) : (
            <p className="small text-muted mt-2 mb-0">
              先核對學號與姓名，再從當學期預約中選擇要登記的一筆。
            </p>
          )}
        </div>
      ) : (
        <p className="small text-muted mb-3">你沒有登記違規的權限，此頁只能查看紀錄。</p>
      )}

      {/* 黑名單紀錄表格 */}
      {blacklistLoading ? (
        <p>載入中...</p>
      ) : !Array.isArray(blackListRecords) || blackListRecords.length === 0 ? (
        <div className="alert alert-light border" role="status">
          <div className="fw-semibold mb-1">尚無違規紀錄</div>
          <p className="small text-muted mb-3">
            {canRecordEventViolation
              ? '活動結束後可從活動明細的「違規與未到處理」分頁登記，或在上方輸入學號與姓名，從當學期預約中選擇一筆。當學期黑名單次數會在活動結束檢查時計入。'
              : '活動結束後可從活動明細的「違規與未到處理」分頁查看登記結果。'}
          </p>
          <Link to="/admin/operations" className="btn btn-outline-primary btn-sm">
            前往活動列表
          </Link>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>學號</th>
                <th>姓名</th>
                <th>活動類型</th>
                <th>活動日期</th>
                <th>次數</th>
                <th>黑名單</th>
                <th>解鎖時間</th>
                <th>原因</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {getSortedAndFilteredRecords().length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center">沒有符合搜尋條件的紀錄</td>
                </tr>
              ) : (
                getSortedAndFilteredRecords().map((r) => (
                  <tr key={r.id}>
                    <td>{r.User?.studentId || '—'}</td>
                    <td>{r.User?.name || '—'}</td>
                    <td>{r.eventType || '—'}</td>
                    <td>{r.eventDate || '—'}</td>
                    <td>{r.User?.violationCount || 0}</td>
                    <td>{r.User?.isBlacklisted ? '是' : '否'}</td>
                    <td>{r.User?.blacklistUntil ? dayjs(r.User.blacklistUntil).format('YYYY/MM/DD HH:mm') : '—'}</td>
                    <td>{r.reason || '—'}</td>
                    <td>
                      {canManageBlacklist ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteViolation(r.id)}
                        >
                          刪除
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ViolationReservationPickerModal
        show={pickerOpen}
        student={pickerStudent}
        semester={pickerSemester}
        reservations={pickerReservations}
        selectedReservationId={selectedReservationId}
        violationType={violationType}
        description={violationDescription}
        loading={pickerSubmitting}
        error={pickerError}
        onSelectReservation={setSelectedReservationId}
        onViolationTypeChange={setViolationType}
        onDescriptionChange={setViolationDescription}
        onClose={resetPicker}
        onSubmit={handleRecordSelectedViolation}
      />
    </>
  );
}

export default ViolationManagement;
