import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import ImportResultSummary from '../import/ImportResultSummary';
import ImportErrorList from '../import/ImportErrorList';
import { collectClassImportIssues } from '../../../utils/classOverviewImportHelpers';

export default function ClassOverviewUploadResultModal({ uploadResult, onHide }) {
  if (!uploadResult) return null;
  const { warnings: importWarnings, errors: importErrors } = collectClassImportIssues(uploadResult);

  return (
    <Modal show onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>上傳結果</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ImportResultSummary
          result={uploadResult}
          successCount={uploadResult.membersUpserted}
          skippedCount={uploadResult.skipped}
          failedCount={importErrors.length}
          message={(
            <div className="small">
              <div>學期：{uploadResult.semester ?? '—'}</div>
              <div>新增班級：{uploadResult.classesCreated ?? 0} 個</div>
              <div>更新班級：{uploadResult.classesUpdated ?? 0} 個</div>
              <div>處理學生：{uploadResult.membersUpserted ?? 0} 人</div>
            </div>
          )}
          className="mb-3"
        />
        <ImportErrorList errors={importWarnings} title="警告" variant="warning" className="mb-3" />
        <ImportErrorList errors={importErrors} title="錯誤明細" className="mb-0" />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={onHide}>確定</Button>
      </Modal.Footer>
    </Modal>
  );
}
