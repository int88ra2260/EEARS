import React, { memo } from 'react';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import ImportCenterNotice from '../../import/ImportCenterNotice';
import ImportUploadPanel from '../../import/ImportUploadPanel';
import ImportResultSummary from '../../import/ImportResultSummary';
import ImportErrorList from '../../import/ImportErrorList';
import { collectCardExcelImportIssues } from './collectCardExcelImportIssues';

function AdminEventImportExportTab({ tabProps }) {
  const p = tabProps;

  return (
    <div className="pt-3">
      <p className="small text-muted mb-3">工具型操作：下載名單或匯入刷卡檔，與簽到流程分開。</p>
      <Card className="mb-3 border-primary">
        <Card.Header className="bg-primary text-white py-2 small fw-semibold">匯出</Card.Header>
        <Card.Body>
          <p className="text-muted small mb-2">下載此活動預約清單 Excel（次要操作）。</p>
          <div className="d-flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={p.handleExport} disabled={!p.canExportReservations}>
              匯出活動 Excel
            </Button>
            {(p.currentEventType || 'English Table') === 'English Table' && p.canExportEtGrouping ? (
              <Button variant="outline-primary" size="sm" onClick={p.handleExportEtGrouping}>
                匯出 ET 分組／任務 Excel
              </Button>
            ) : null}
          </div>
        </Card.Body>
      </Card>
      {p.canImportExcel ? (
        <Card className="border-secondary">
          <Card.Header className="bg-secondary text-white py-2 small fw-semibold">匯入</Card.Header>
          <Card.Body>
            <ImportCenterNotice variant="import" compact />
            <Alert variant="warning" className="py-2 small mb-3">
              匯入會依刷卡檔比對學號並寫入簽到；請確認<strong>刷卡日期與活動日相同</strong>，檔案勿超過系統限制。
            </Alert>
            <p className="text-muted small mb-2">
              使用欄位：姓名、工號／學號、刷卡日期、刷卡時間（.xls / .xlsx）。
            </p>
            {p.importError && <div className="alert alert-danger py-2 mb-3">{p.importError}</div>}
            <ImportUploadPanel
              title="刷卡 Excel 匯入簽到"
              description="選擇刷卡 Excel 檔案後開始匯入。"
              acceptedFileTypes=".xls,.xlsx"
              selectedFile={p.importFile}
              onFileChange={(file) => {
                p.handleImportFileChange({ target: { files: file ? [file] : [] } });
              }}
              onSubmit={(event) => p.handleImportExcel(event)}
              isSubmitting={p.importLoading}
              submitLabel={p.importLoading ? '匯入中…' : '開始匯入'}
              disabled={!p.canImportExcel || p.importLoading}
              className="border"
            />
            {p.importResult ? (() => {
              const { warnings, errors, skipped } = collectCardExcelImportIssues(p.importResult);
              return (
                <div className="mt-3">
                  <ImportResultSummary
                    result={p.importResult}
                    successCount={p.importResult.successCount ?? p.importResult.imported}
                    skippedCount={p.importResult.skipped}
                    failedCount={
                      p.importResult.failed ??
                      p.importResult.errorCount ??
                      (Array.isArray(p.importResult.errors) ? p.importResult.errors.length : errors.length)
                    }
                    totalCount={p.importResult.totalImported ?? p.importResult.totalRows}
                    message={p.importResult.message ? <div className="small">{p.importResult.message}</div> : ''}
                    className="mb-2"
                  />
                  <ImportErrorList errors={warnings} title="warnings 明細" variant="warning" className="mb-2" />
                  <ImportErrorList errors={skipped} title="略過明細" variant="info" className="mb-2" />
                  <ImportErrorList errors={errors} title="錯誤明細" className="mb-0" />
                </div>
              );
            })() : null}
          </Card.Body>
        </Card>
      ) : (
        <p className="small text-muted">您的身分無法使用刷卡機匯入，請洽管理員。</p>
      )}
    </div>
  );
}

export default memo(AdminEventImportExportTab);
