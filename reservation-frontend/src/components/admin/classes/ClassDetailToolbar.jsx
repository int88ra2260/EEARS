import React from 'react';
import { Button, Spinner } from 'react-bootstrap';

export default function ClassDetailToolbar({
  classId,
  classInfo,
  semester,
  exporting,
  hasData,
  onBack,
  onOpenBestep,
  onExport,
}) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-4">
      <div>
        <Button variant="outline-secondary" onClick={onBack} className="me-3">
          <i className="fas fa-arrow-left me-2" />
          返回總覽
        </Button>
        <div>
          <h3 className="mb-0 h4">
            <i className="fas fa-users me-2" />
            {classInfo.name} ({classInfo.semester})
          </h3>
          {classInfo.teacherName && (
            <p className="text-muted mb-0 mt-1">
              <i className="fas fa-chalkboard-teacher me-2" />
              {classInfo.teacherName}
            </p>
          )}
        </div>
      </div>
      <div>
        <Button
          variant="outline-info"
          onClick={() => onOpenBestep(classId, semester)}
          className="me-2"
        >
          <i className="fas fa-graduation-cap me-2" />
          BESTEP 概況
        </Button>
        <Button variant="outline-success" onClick={onExport} disabled={exporting || !hasData}>
          {exporting ? (
            <>
              <Spinner size="sm" className="me-2" />
              匯出中...
            </>
          ) : (
            <>
              <i className="fas fa-download me-2" />
              匯出 Excel
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
