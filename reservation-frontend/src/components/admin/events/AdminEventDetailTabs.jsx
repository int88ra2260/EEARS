import React, { useCallback, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import AdminEventDetailModals from './AdminEventDetailModals';
import AdminEventCheckinTab from './tabs/AdminEventCheckinTab';
import AdminEventImportExportTab from './tabs/AdminEventImportExportTab';
import AdminEventReservationsTab from './tabs/AdminEventReservationsTab';
import AdminEventViolationsTab from './tabs/AdminEventViolationsTab';
import AdminEventGroupingTab from './tabs/AdminEventGroupingTab';
import AdminEventTaskMarksTab from './tabs/AdminEventTaskMarksTab';
import { EVENT_DETAIL_COPY } from '../../../constants/adminEventDetailCopy';

function TabTitle({ label, count, variant = 'secondary' }) {
  return (
    <span className="d-inline-flex align-items-center gap-1">
      {label}
      {count > 0 ? (
        <Badge bg={variant} pill className="fw-normal">
          {count}
        </Badge>
      ) : null}
    </span>
  );
}

/**
 * 活動明細分頁：
 * 預約 →（ET）能力分組 → 簽到 →（ET）任務成效 → 匯入／匯出 → 違規／未到
 */
export default function AdminEventDetailTabs({
  activeKey,
  onSelect,
  pendingCheckinCount = 0,
  violationRecordCount = null,
  reservationsTabProps,
  checkinTabProps,
  importExportTabProps,
  violationsTabProps,
  groupingTabProps,
  taskMarksTabProps,
  violationModalProps,
  showCheckin = true,
  showImportExport = true,
  showViolations = true,
}) {
  const [internalKey, setInternalKey] = useState('reservations');
  const tabKey = activeKey !== undefined ? activeKey : internalKey;
  const setTabKey = onSelect || setInternalKey;

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const showGrouping = Boolean(groupingTabProps?.visible);
  const showTaskMarks = Boolean(taskMarksTabProps?.visible);

  const openCancelReservationModal = useCallback((reservation) => {
    setCancelTarget(reservation);
  }, []);

  const closeCancelReservationModal = useCallback(() => {
    if (cancelSubmitting) return;
    setCancelTarget(null);
  }, [cancelSubmitting]);

  const submitCancelReservation = useCallback(async () => {
    if (!cancelTarget) return;

    setCancelSubmitting(true);
    const ok = await reservationsTabProps.handleDeleteReservation(cancelTarget.id);
    setCancelSubmitting(false);
    if (ok) {
      setCancelTarget(null);
    }
  }, [cancelTarget, reservationsTabProps]);

  const handleOpenViolationTab = useCallback(
    (studentId) => {
      setTabKey('violations');
      violationsTabProps.openViolationModal(studentId);
    },
    [setTabKey, violationsTabProps],
  );

  const goCheckinTab = useCallback(() => setTabKey('checkin'), [setTabKey]);

  return (
    <>
      <p className="text-muted small mb-2">
        {showGrouping || showTaskMarks
          ? EVENT_DETAIL_COPY.tabFlowHintEt
          : EVENT_DETAIL_COPY.tabFlowHint}
      </p>
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
            onGoCheckinTab={goCheckinTab}
          />
        </Tab>

        {showGrouping ? (
          <Tab eventKey="grouping" title="能力分組">
            <AdminEventGroupingTab tabProps={groupingTabProps} />
          </Tab>
        ) : null}

        {showCheckin ? (
          <Tab
            eventKey="checkin"
            title={<TabTitle label="簽到管理" count={pendingCheckinCount} variant="danger" />}
          >
            <AdminEventCheckinTab tabProps={checkinTabProps} />
          </Tab>
        ) : null}

        {showTaskMarks ? (
          <Tab eventKey="taskMarks" title="任務成效">
            <AdminEventTaskMarksTab tabProps={taskMarksTabProps} />
          </Tab>
        ) : null}

        {showImportExport ? (
          <Tab eventKey="importExport" title="匯入與匯出">
            <AdminEventImportExportTab
              tabProps={importExportTabProps}
              onGoCheckinTab={goCheckinTab}
            />
          </Tab>
        ) : null}

        {showViolations ? (
          <Tab
            eventKey="violations"
            title={(
              <TabTitle
                label="違規與未到處理"
                count={violationRecordCount || 0}
                variant="danger"
              />
            )}
          >
            <AdminEventViolationsTab tabProps={violationsTabProps} />
          </Tab>
        ) : null}
      </Tabs>

      <AdminEventDetailModals
        cancelTarget={cancelTarget}
        cancelSubmitting={cancelSubmitting}
        onCloseCancel={closeCancelReservationModal}
        onSubmitCancel={submitCancelReservation}
        violationModalProps={violationModalProps}
      />
    </>
  );
}
