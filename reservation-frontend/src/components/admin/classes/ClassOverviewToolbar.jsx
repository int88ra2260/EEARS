import React from 'react';
import { Button, Spinner } from 'react-bootstrap';

export default function ClassOverviewToolbar({
  semester,
  canManageClasses,
  exporting,
  hasData,
  onDownloadSample,
  onOpenUpload,
  onExport,
}) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-4">
      <div className="text-muted">
        <i className="fas fa-calendar-alt me-2" aria-hidden="true" />
        學期：{semester}
      </div>
      <div>
        {canManageClasses && (
          <>
            <Button variant="outline-secondary" onClick={onDownloadSample} className="me-2">
              <i className="fas fa-file-download me-2" />
              下載範例
            </Button>
            <Button variant="outline-primary" onClick={onOpenUpload} className="me-2">
              <i className="fas fa-upload me-2" />
              匯入名單
            </Button>
          </>
        )}
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
