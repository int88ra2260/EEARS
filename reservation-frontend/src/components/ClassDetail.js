// src/components/ClassDetail.js
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert } from 'react-bootstrap';
import { useClassDetail } from '../hooks/useClassDetail';
import ClassDetailToolbar from './admin/classes/ClassDetailToolbar';
import ClassDetailFilters from './admin/classes/ClassDetailFilters';
import ClassDetailStatisticsCards from './admin/classes/ClassDetailStatisticsCards';
import ClassDetailStudentsTable from './admin/classes/ClassDetailStudentsTable';

export default function ClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const {
    data,
    loading,
    error,
    exporting,
    classInfo,
    filters,
    pagination,
    handleFilterChange,
    handleSearchChange,
    handleExport,
  } = useClassDetail(classId);

  return (
    <div className="container-fluid">
      <ClassDetailToolbar
        classId={classId}
        classInfo={classInfo}
        semester={filters.semester}
        exporting={exporting}
        hasData={data.length > 0}
        onBack={() => navigate('/admin/classes')}
        onOpenBestep={(id, semester) =>
          navigate(`/admin/classes/${id}/bestep?semester=${semester}`)
        }
        onExport={handleExport}
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <ClassDetailFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
      />

      <ClassDetailStatisticsCards data={data} />

      <ClassDetailStudentsTable
        loading={loading}
        data={data}
        filters={filters}
        pagination={pagination}
        onFilterChange={handleFilterChange}
        onOpenStudentJourney={(studentId) =>
          navigate(
            `/admin/analytics/student/${encodeURIComponent(studentId)}?fromSemester=${encodeURIComponent(filters.semester)}&toSemester=${encodeURIComponent(filters.semester)}`
          )
        }
      />
    </div>
  );
}
