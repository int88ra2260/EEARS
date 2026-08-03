// src/components/ClassBestepOverview.js
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Button } from 'react-bootstrap';
import { useClassBestepOverview } from '../hooks/useClassBestepOverview';
import ClassBestepFilters from './admin/classes/ClassBestepFilters';
import ClassBestepStatisticsCards from './admin/classes/ClassBestepStatisticsCards';
import ClassBestepStudentsTable from './admin/classes/ClassBestepStudentsTable';
import ClassBestepStudentModal from './admin/classes/ClassBestepStudentModal';

export default function ClassBestepOverview() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const {
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
  } = useClassBestepOverview(classId);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Button
            variant="outline-secondary"
            onClick={() => navigate('/admin/classes')}
            className="me-3"
          >
            <i className="fas fa-arrow-left me-2" />
            返回班級列表
          </Button>
          <h2 className="d-inline-block mb-0">
            {classInfo?.className || '班級 BESTEP 概況'}
          </h2>
          <div className="text-muted mt-1">
            {classInfo?.teacherName && `授課教師：${classInfo.teacherName}`}
            {classInfo?.semester && ` | 學期：${classInfo.semester}`}
          </div>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <ClassBestepFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
      />

      <ClassBestepStatisticsCards statistics={statistics} />

      <ClassBestepStudentsTable
        loading={loading}
        students={students}
        filters={filters}
        pagination={pagination}
        exporting={exporting}
        onFilterChange={handleFilterChange}
        onExport={handleExportBestepExcel}
        onShowStudentDetail={handleShowStudentDetail}
        onOpenStudentJourney={(studentId) =>
          navigate(`/admin/analytics/student/${encodeURIComponent(studentId)}?fromSemester=${encodeURIComponent(filters.semester)}&toSemester=${encodeURIComponent(filters.semester)}`)
        }
      />

      <ClassBestepStudentModal
        show={showStudentModal}
        student={selectedStudent}
        onHide={closeStudentModal}
        onOpenRegistration={(regId) => navigate(`/admin/english-test?id=${regId}`)}
      />
    </div>
  );
}
