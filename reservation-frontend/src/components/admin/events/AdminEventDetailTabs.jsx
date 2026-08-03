import React, { useCallback, useState } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import AdminEventDetailModals from './AdminEventDetailModals';
import AdminEventCheckinTab from './tabs/AdminEventCheckinTab';
import AdminEventImportExportTab from './tabs/AdminEventImportExportTab';
import AdminEventReservationsTab from './tabs/AdminEventReservationsTab';
import AdminEventViolationsTab from './tabs/AdminEventViolationsTab';
import AdminEventGroupingTab from './tabs/AdminEventGroupingTab';
import AdminEventTaskMarksTab from './tabs/AdminEventTaskMarksTab';

/**
 * 活動明細：預約 → 簽到 → 匯入／匯出 → 違規／未到（現場流程優先）
 * 各分頁以 memo + 分組 props 降低 re-render 範圍。
 */
export default function AdminEventDetailTabs({
  activeKey,
  onSelect,
  reservationsTabProps,
  checkinTabProps,
  importExportTabProps,
  violationsTabProps,
  groupingTabProps,
  taskMarksTabProps,
  violationModalProps,
}) {
  const [internalKey, setInternalKey] = useState('reservations');
  const tabKey = activeKey !== undefined ? activeKey : internalKey;
  const setTabKey = onSelect || setInternalKey;

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelVerificationCode, setCancelVerificationCode] = useState('');
  const [cancelCodeError, setCancelCodeError] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const openCancelReservationModal = useCallback((reservation) => {
    setCancelTarget(reservation);
    setCancelVerificationCode('');
    setCancelCodeError('');
  }, []);

  const closeCancelReservationModal = useCallback(() => {
    if (cancelSubmitting) return;
    setCancelTarget(null);
    setCancelVerificationCode('');
    setCancelCodeError('');
  }, [cancelSubmitting]);

  const submitCancelReservation = useCallback(async () => {
    if (!cancelTarget) return;
    const code = cancelVerificationCode.trim();
    if (!code) {
      setCancelCodeError('請輸入該筆預約的取消驗證碼。');
      return;
    }

    setCancelSubmitting(true);
    setCancelCodeError('');
    const ok = await reservationsTabProps.handleDeleteReservation(
      cancelTarget.id,
      cancelTarget.studentId,
      cancelTarget.studentName || cancelTarget.name,
      code,
    );
    setCancelSubmitting(false);
    if (ok) {
      setCancelTarget(null);
      setCancelVerificationCode('');
    }
  }, [cancelTarget, cancelVerificationCode, reservationsTabProps]);

  const handleOpenViolationTab = useCallback(
    (studentId) => {
      setTabKey('violations');
      violationsTabProps.openViolationModal(studentId);
    },
    [setTabKey, violationsTabProps],
  );

  return (
    <>
      <Tabs
        activeKey={tabKey}
        onSelect={(k) => setTabKey(k || 'reservations')}
        className="mb-3 admin-event-detail-tabs"
        mountOnEnter
        unmountOnExit
      >
        <Tab eventKey="reservations" title="預約名單">
          <AdminEventReservationsTab
            tabProps={reservationsTabProps}
            onOpenViolationTab={handleOpenViolationTab}
            onOpenCancel={openCancelReservationModal}
          />
        </Tab>

        <Tab eventKey="checkin" title="簽到管理">
          <AdminEventCheckinTab tabProps={checkinTabProps} />
        </Tab>

        {groupingTabProps?.visible ? (
          <Tab eventKey="grouping" title="能力分組">
            <AdminEventGroupingTab tabProps={groupingTabProps} />
          </Tab>
        ) : null}

        {taskMarksTabProps?.visible ? (
          <Tab eventKey="taskMarks" title="任務成效">
            <AdminEventTaskMarksTab tabProps={taskMarksTabProps} />
          </Tab>
        ) : null}

        <Tab eventKey="importExport" title="匯入與匯出">
          <AdminEventImportExportTab tabProps={importExportTabProps} />
        </Tab>

        <Tab eventKey="violations" title="違規與未到處理">
          <AdminEventViolationsTab tabProps={violationsTabProps} />
        </Tab>
      </Tabs>

      <AdminEventDetailModals
        cancelTarget={cancelTarget}
        cancelVerificationCode={cancelVerificationCode}
        cancelCodeError={cancelCodeError}
        cancelSubmitting={cancelSubmitting}
        onCancelCodeChange={(value) => {
          setCancelVerificationCode(value);
          if (cancelCodeError) setCancelCodeError('');
        }}
        onCloseCancel={closeCancelReservationModal}
        onSubmitCancel={submitCancelReservation}
        violationModalProps={violationModalProps}
      />
    </>
  );
}
