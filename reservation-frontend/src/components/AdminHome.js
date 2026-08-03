// src/components/AdminHome.js
// 管理後台：活動列表（/admin/operations）
import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Nav from 'react-bootstrap/Nav';
import { buildAccessProfile, canAccessEventType, hasPermission } from '../utils/accessControl';
import { getEventTypeOptions } from '../utils/adminReportUtils';
import { P } from '../constants/permissions';
import useConfirm from './ui/useConfirm';
import { useAdminEventOperations } from '../hooks/useAdminEventOperations';
import AddEventForm from './admin/home/AddEventForm';
import BatchAddEventsModal from './admin/home/BatchAddEventsModal';
import DeleteEventConfirmModal from './admin/home/DeleteEventConfirmModal';
import EditEventModal from './admin/home/EditEventModal';
import EventReportTable from './admin/home/EventReportTable';
import AdminEtLeadersManagePanel from './admin/home/AdminEtLeadersManagePanel';

function AdminHome() {
  const { token, userRole, accessProfile: ctxProfile } = useOutletContext();
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  
  const canViewEventsAdmin = hasPermission(accessProfile, P.CAN_VIEW_EVENTS_ADMIN);
  const actualUserRole = userRole || 'worker';
  const isTeacher = actualUserRole === 'teacher';
  const canManageEvents = hasPermission(accessProfile, P.CAN_MANAGE_EVENTS);
  const canExportReports = hasPermission(accessProfile, P.CAN_EXPORT_REPORTS);
  const canExportReservations = hasPermission(accessProfile, P.CAN_EXPORT_RESERVATIONS);
  const canManageEtGrouping = hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);
  const [operationsTab, setOperationsTab] = useState('events');
  const eventTypeOptions = getEventTypeOptions().filter((opt) => {
    if (opt.value === 'all' || opt.value === '其他') return true;
    return canAccessEventType(accessProfile, opt.value);
  });

  const {
    summary,
    loading,
    error,
    selectedSemester,
    selectedEventType,
    dateFilterMode,
    filterDate,
    filterDateFrom,
    filterDateTo,
    handleSemesterChange,
    handleEventTypeChange,
    handleDateFilterModeChange,
    handleFilterDateChange,
    handleFilterDateFromChange,
    handleFilterDateToChange,
    applyDatePreset,
    clearFilterDate,
    setSelectedEventType,
    addFields,
    setAddFields,
    addLoading,
    addError,
    handleAddEvent,
    editModalShow,
    setEditModalShow,
    editFields,
    setEditFields,
    editLoading,
    editError,
    handleEditEvent,
    handleEditSubmit,
    deleteConfirmModalShow,
    setDeleteConfirmModalShow,
    deleteEventName,
    deletePassword,
    setDeletePassword,
    deleteLoading,
    handleDeleteEvent,
    handlePasswordConfirmDelete,
    showBatchAddModal,
    batchEvents,
    setBatchEvents,
    batchAddLoading,
    batchAddError,
    batchAddResult,
    showBatchDatePicker,
    batchSelectedDates,
    handleBatchAddEvents,
    handleBatchDateSelect,
    applyBatchDates,
    addDateToBatch,
    removeDateFromBatch,
    closeBatchDatePicker,
    clearBatchSelectedDates,
    handleParseBatchDates,
    openBatchAddModal,
    closeBatchAddModal,
    handleExport,
    handleExportAll,
    isEventToday,
  } = useAdminEventOperations({
    token,
    canViewEventsAdmin,
    canManageEvents,
    canExportReports,
    canExportReservations,
    confirm,
  });

  useEffect(() => {
    if (!eventTypeOptions.some((o) => o.value === selectedEventType)) {
      setSelectedEventType('all');
    }
  }, [eventTypeOptions, selectedEventType, setSelectedEventType]);

  const addEventForm = canManageEvents ? (
    <AddEventForm
      fields={addFields}
      onFieldsChange={setAddFields}
      loading={addLoading}
      error={addError}
      onSubmit={handleAddEvent}
      onOpenBatchAdd={openBatchAddModal}
    />
  ) : null;

              return (
    <>
      {canManageEtGrouping ? (
        <Nav variant="tabs" className="mb-3 admin-operations-tabs">
          <Nav.Item>
            <Nav.Link
              active={operationsTab === 'events'}
              onClick={() => setOperationsTab('events')}
              eventKey="events"
            >
              活動列表
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={operationsTab === 'leaders'}
              onClick={() => setOperationsTab('leaders')}
              eventKey="leaders"
            >
              管理 Leaders
            </Nav.Link>
          </Nav.Item>
        </Nav>
      ) : null}

      {operationsTab === 'events' || !canManageEtGrouping ? (
      <EventReportTable
        summary={summary}
        loading={loading}
        error={error}
        selectedSemester={selectedSemester}
        selectedEventType={selectedEventType}
        dateFilterMode={dateFilterMode}
        filterDate={filterDate}
        filterDateFrom={filterDateFrom}
        filterDateTo={filterDateTo}
        eventTypeOptions={eventTypeOptions}
        canExportReports={canExportReports}
        canExportReservations={canExportReservations}
        isTeacher={isTeacher}
        userRole={actualUserRole}
        onSemesterChange={handleSemesterChange}
        onEventTypeChange={handleEventTypeChange}
        onDateFilterModeChange={handleDateFilterModeChange}
        onFilterDateChange={handleFilterDateChange}
        onFilterDateFromChange={handleFilterDateFromChange}
        onFilterDateToChange={handleFilterDateToChange}
        onApplyDatePreset={applyDatePreset}
        onClearFilterDate={clearFilterDate}
        onExportAll={handleExportAll}
        onExport={handleExport}
        onEventDetail={(eventId) => navigate(`/admin/operations/${eventId}`)}
        onEditEvent={handleEditEvent}
        onDeleteEvent={handleDeleteEvent}
        isEventToday={isEventToday}
        middleContent={addEventForm}
      />
      ) : (
        <AdminEtLeadersManagePanel
          token={token}
          selectedSemester={selectedSemester}
          onSemesterChange={handleSemesterChange}
        />
      )}

      <EditEventModal
        show={editModalShow}
        event={editFields}
        loading={editLoading}
        error={editError}
        onClose={() => setEditModalShow(false)}
        onSubmit={handleEditSubmit}
        onFieldsChange={setEditFields}
      />

      <DeleteEventConfirmModal
        show={deleteConfirmModalShow}
        eventName={deleteEventName}
        password={deletePassword}
        onPasswordChange={setDeletePassword}
        loading={deleteLoading}
        onClose={() => setDeleteConfirmModalShow(false)}
        onSubmit={handlePasswordConfirmDelete}
      />

      <BatchAddEventsModal
        show={showBatchAddModal}
        events={batchEvents}
        onEventsChange={setBatchEvents}
        loading={batchAddLoading}
        error={batchAddError}
        result={batchAddResult}
        onClose={closeBatchAddModal}
        onSubmit={handleBatchAddEvents}
        showDatePicker={showBatchDatePicker}
        selectedDates={batchSelectedDates}
        onOpenDatePicker={handleBatchDateSelect}
        onCloseDatePicker={closeBatchDatePicker}
        onAddDate={addDateToBatch}
        onRemoveDate={removeDateFromBatch}
        onClearDates={clearBatchSelectedDates}
        onApplyDates={applyBatchDates}
        onParseAndAddDates={(text) => handleParseBatchDates({ value: text })}
      />
    </>
  );
}

export default AdminHome;
