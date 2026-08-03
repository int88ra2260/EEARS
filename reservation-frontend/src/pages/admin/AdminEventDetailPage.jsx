import React, { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import Spinner from 'react-bootstrap/Spinner';
import useAdminEventWorkspace from '../../hooks/useAdminEventWorkspace';
import AdminEventDetailTabs from '../../components/admin/events/AdminEventDetailTabs';
import AdminEventDetailHeader from '../../components/admin/events/AdminEventDetailHeader';
import { EVENT_DETAIL_COPY } from '../../constants/adminEventDetailCopy';

export default function AdminEventDetailPage() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const { token, userRole, accessProfile } = useOutletContext();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'reservations');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);
  const ws = useAdminEventWorkspace({ token, userRole, accessProfile, eventId, activeTab });

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
      <AdminEventDetailHeader ws={ws} onGoCheckinTab={() => setActiveTab('checkin')} />

      <AdminEventDetailTabs
        activeKey={activeTab}
        onSelect={setActiveTab}
        reservationsTabProps={ws.reservationsTabProps}
        checkinTabProps={ws.checkinTabProps}
        importExportTabProps={ws.importExportTabProps}
        violationsTabProps={ws.violationsTabProps}
        groupingTabProps={ws.groupingTabProps}
        taskMarksTabProps={ws.taskMarksTabProps}
        violationModalProps={ws.violationModalProps}
      />
    </div>
  );
}
