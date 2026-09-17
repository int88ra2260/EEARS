import React, { useCallback, useEffect, useMemo } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import Spinner from 'react-bootstrap/Spinner';
import useAdminEventWorkspace from '../../hooks/useAdminEventWorkspace';
import AdminEventDetailTabs from '../../components/admin/events/AdminEventDetailTabs';
import AdminEventDetailHeader from '../../components/admin/events/AdminEventDetailHeader';
import { EVENT_DETAIL_COPY } from '../../constants/adminEventDetailCopy';
import {
  buildEventDetailSearchParams,
  resolveEventDetailTab,
} from '../../utils/eventDetailTabs';

export default function AdminEventDetailPage() {
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, userRole, accessProfile, setAdminPageMeta } = useOutletContext();

  const requestedTab = searchParams.get('tab') || 'reservations';
  // 先以請求值餵 workspace（lazy load）；可見性就緒後再校正非法 tab
  const ws = useAdminEventWorkspace({
    token,
    userRole,
    accessProfile,
    eventId,
    activeTab: requestedTab,
  });

  const tabVisibility = useMemo(
    () => ({
      groupingVisible: Boolean(ws.groupingTabProps?.visible),
      taskMarksVisible: Boolean(ws.taskMarksTabProps?.visible),
      checkinVisible: Boolean(ws.canCheckinStudents),
      importExportVisible: Boolean(
        ws.canExportReservations || ws.canImportExcel || ws.canExportEtGrouping,
      ),
      violationsVisible: Boolean(ws.canManageViolations || ws.canViewBlacklist),
    }),
    [
      ws.groupingTabProps?.visible,
      ws.taskMarksTabProps?.visible,
      ws.canCheckinStudents,
      ws.canExportReservations,
      ws.canImportExcel,
      ws.canExportEtGrouping,
      ws.canManageViolations,
      ws.canViewBlacklist,
    ],
  );

  const activeTab = useMemo(
    () => resolveEventDetailTab(requestedTab, tabVisibility),
    [requestedTab, tabVisibility],
  );

  const setActiveTab = useCallback(
    (key) => {
      const next = resolveEventDetailTab(key, tabVisibility);
      setSearchParams((prev) => buildEventDetailSearchParams(prev, next), { replace: true });
    },
    [setSearchParams, tabVisibility],
  );

  // 深連結到不可見分頁時，校正 URL
  useEffect(() => {
    if (ws.detailLoading) return;
    if (requestedTab === activeTab) return;
    setSearchParams((prev) => buildEventDetailSearchParams(prev, activeTab), { replace: true });
  }, [ws.detailLoading, requestedTab, activeTab, setSearchParams]);

  useEffect(() => {
    if (!setAdminPageMeta) return undefined;
    if (ws.currentEventName) {
      setAdminPageMeta({
        pageTitle: ws.currentEventName,
        breadcrumbLeaf: ws.currentEventName,
      });
    }
    return () => setAdminPageMeta(null);
  }, [setAdminPageMeta, ws.currentEventName]);

  if (ws.detailLoading) {
    return (
      <div className="d-flex align-items-center gap-2 py-4">
        <Spinner animation="border" size="sm" />
        <span>{EVENT_DETAIL_COPY.pageLoading}</span>
      </div>
    );
  }

  if (ws.detailError) {
    return (
      <div className="alert alert-danger">
        {ws.detailError}
        <div className="mt-2">
          <Link to="/admin/operations" className="btn btn-outline-primary btn-sm">
            返回活動列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminEventDetailHeader
        ws={ws}
        onGoCheckinTab={tabVisibility.checkinVisible ? () => setActiveTab('checkin') : null}
        onGoViolationsTab={tabVisibility.violationsVisible ? () => setActiveTab('violations') : null}
      />

      <AdminEventDetailTabs
        activeKey={activeTab}
        onSelect={setActiveTab}
        pendingCheckinCount={ws.noShowReservationCount}
        violationRecordCount={ws.violationsLoaded ? (ws.eventViolations?.length || 0) : null}
        reservationsTabProps={ws.reservationsTabProps}
        checkinTabProps={ws.checkinTabProps}
        importExportTabProps={ws.importExportTabProps}
        violationsTabProps={ws.violationsTabProps}
        groupingTabProps={ws.groupingTabProps}
        taskMarksTabProps={ws.taskMarksTabProps}
        violationModalProps={ws.violationModalProps}
        showCheckin={tabVisibility.checkinVisible}
        showImportExport={tabVisibility.importExportVisible}
        showViolations={tabVisibility.violationsVisible}
      />
    </div>
  );
}
