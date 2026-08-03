// src/components/ClassOverview.js
import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Alert } from 'react-bootstrap';
import ImportCenterNotice from './admin/import/ImportCenterNotice';
import { buildAccessProfile, hasPermission } from '../utils/accessControl';
import { P } from '../constants/permissions';
import { useClassOverview } from '../hooks/useClassOverview';
import ClassOverviewToolbar from './admin/classes/ClassOverviewToolbar';
import ClassOverviewFilters from './admin/classes/ClassOverviewFilters';
import ClassOverviewChart from './admin/classes/ClassOverviewChart';
import ClassOverviewTable from './admin/classes/ClassOverviewTable';
import ClassOverviewDeleteModal from './admin/classes/ClassOverviewDeleteModal';
import ClassOverviewUploadModal from './admin/classes/ClassOverviewUploadModal';
import ClassOverviewUploadResultModal from './admin/classes/ClassOverviewUploadResultModal';

export default function ClassOverview() {
  const navigate = useNavigate();
  const { userRole, token, accessProfile: ctxAccess } = useOutletContext() || {};
  const accessProfile = ctxAccess || buildAccessProfile(token || '', userRole || '');
  const canManageClasses = hasPermission(accessProfile, P.CAN_MANAGE_CLASSES);
  const {
    data,
    loading,
    error,
    statusMessage,
    exporting,
    filters,
    pagination,
    handleFilterChange,
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
  } = useClassOverview({ token });

  const [searchTimeout, setSearchTimeout] = useState(null);
  const handleSearchChange = (value) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => handleFilterChange('q', value), 300));
  };

  const [studentIdTimeout, setStudentIdTimeout] = useState(null);
  const handleStudentIdChange = (value) => {
    if (studentIdTimeout) clearTimeout(studentIdTimeout);
    setStudentIdTimeout(setTimeout(() => handleFilterChange('studentId', value.trim()), 300));
  };

  const [teacherNameTimeout, setTeacherNameTimeout] = useState(null);
  const handleTeacherNameChange = (value) => {
    if (teacherNameTimeout) clearTimeout(teacherNameTimeout);
    setTeacherNameTimeout(setTimeout(() => handleFilterChange('teacherName', value.trim()), 300));
  };

  const semesterQuery = `semester=${filters.semester}`;

  return (
    <div className="container-fluid">
      {canManageClasses ? <ImportCenterNotice variant="import" /> : null}

      <ClassOverviewToolbar
        semester={filters.semester}
        canManageClasses={canManageClasses}
        exporting={exporting}
        hasData={data.length > 0}
        onDownloadSample={handleDownloadSample}
        onOpenUpload={() => setShowUploadModal(true)}
        onExport={handleExport}
      />

      {error && !showUploadModal && <Alert variant="danger">{error}</Alert>}
      {statusMessage && <Alert variant="success">{statusMessage}</Alert>}

      <ClassOverviewFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
        onTeacherNameChange={handleTeacherNameChange}
        onStudentIdChange={handleStudentIdChange}
      />

      <ClassOverviewChart data={data} />

      <ClassOverviewTable
        loading={loading}
        data={data}
        filters={filters}
        pagination={pagination}
        canManageClasses={canManageClasses}
        onFilterChange={handleFilterChange}
        onViewDetail={(classId) => navigate(`/admin/classes/${classId}?${semesterQuery}`)}
        onViewBestep={(classId) => navigate(`/admin/classes/${classId}/bestep?${semesterQuery}`)}
        onDelete={openDeleteModal}
      />

      <ClassOverviewDeleteModal
        show={showDeleteModal}
        targetClass={targetClass}
        deleteLoading={deleteLoading}
        deleteError={deleteError}
        onHide={closeDeleteModal}
        onConfirm={handleDeleteClass}
      />

      <ClassOverviewUploadModal
        show={showUploadModal}
        error={error}
        uploading={uploading}
        activeTab={uploadTab}
        onTabChange={setUploadTab}
        uploadSemester={uploadSemester}
        uploadCourseName={uploadCourseName}
        uploadCourseCode={uploadCourseCode}
        uploadTeacherName={uploadTeacherName}
        uploadFile={uploadFile}
        pdfFile={pdfFile}
        pdfPreview={pdfPreview}
        pdfPreviewLoading={pdfPreviewLoading}
        onHide={closeUploadModal}
        onSemesterChange={setUploadSemester}
        onCourseNameChange={setUploadCourseName}
        onCourseCodeChange={setUploadCourseCode}
        onTeacherNameChange={setUploadTeacherName}
        onFileChange={setUploadFile}
        onPdfFileChange={handlePdfFileChange}
        onPdfPreview={handlePdfPreview}
        onExcelSubmit={handleExcelSubmit}
        onPdfSubmit={handlePdfSubmit}
        onDownloadSample={handleDownloadSample}
      />

      <ClassOverviewUploadResultModal
        uploadResult={uploadResult}
        onHide={() => setUploadResult(null)}
      />
    </div>
  );
}
