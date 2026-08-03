import React from 'react';
import {
  Alert, Badge, Button, Card, Form, Modal, Spinner, Table,
} from 'react-bootstrap';
import { labelSurveyStatus } from '../../../constants/surveyAdminUx';

export default function SurveyAdminVersionsModal({
  versionsUi,
  canPublish,
  onHide,
  onCreateDraft,
  onStartEdit,
  onCancelEdit,
  onFieldChange,
  onSave,
  onPublish,
}) {
  return (
    <Modal show={versionsUi.show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          編輯題目與發布 {versionsUi.survey ? `— ${versionsUi.survey.name}` : ''}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {versionsUi.loading ? (
          <div className="text-center py-4"><Spinner animation="border" /></div>
        ) : null}
        {!versionsUi.loading && versionsUi.error ? (
          <Alert variant="danger">{versionsUi.error}</Alert>
        ) : null}
        {!versionsUi.loading && !versionsUi.error ? (
          <>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div className="text-muted small">
                流程：先「建立草稿版本」→ 點「編輯」修改題目 → 確認無誤後「發布」。已發布版本不可再改，需新建草稿。
              </div>
              <Button
                size="sm"
                variant="outline-primary"
                onClick={onCreateDraft}
                disabled={versionsUi.saving}
              >
                建立草稿版本
              </Button>
            </div>
            <div className="table-responsive">
              <Table size="sm" hover className="align-middle">
                <thead className="table-light">
                  <tr>
                    <th>版號</th>
                    <th>狀態</th>
                    <th>變更說明</th>
                    <th>更新</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(versionsUi.rows || []).map((v) => (
                    <tr key={v.id}>
                      <td>第 {v.versionNumber} 版</td>
                      <td>
                        <Badge bg={v.status === 'published' ? 'success' : v.status === 'draft' ? 'secondary' : 'light'}>
                          {labelSurveyStatus(v.status)}
                        </Badge>
                        {versionsUi.survey?.currentPublishedVersionId === v.id ? (
                          <Badge bg="primary" className="ms-1">學生端使用中</Badge>
                        ) : null}
                      </td>
                      <td className="small">{v.changeSummary || '—'}</td>
                      <td className="small text-nowrap">
                        {v.updatedAt ? new Date(v.updatedAt).toLocaleString() : '—'}
                      </td>
                      <td className="d-flex gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => onStartEdit(v)}
                          disabled={v.status === 'published'}
                          title={v.status === 'published' ? '已發布版本不可修改' : ''}
                        >
                          編輯
                        </Button>
                        {canPublish ? (
                          <Button
                            size="sm"
                            variant="outline-success"
                            disabled={versionsUi.publishingVersionId === v.id || v.status === 'published'}
                            onClick={() => onPublish(v.id)}
                          >
                            {versionsUi.publishingVersionId === v.id ? '發布中…' : '發布'}
                          </Button>
                        ) : (
                          <span className="btn btn-sm btn-outline-secondary disabled">發布</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {versionsUi.editing ? (
              <Card className="border-0 shadow-sm mt-3">
                <Card.Header className="bg-white fw-semibold">
                  編輯版本 v{versionsUi.editing.versionNumber}（{versionsUi.editing.status}）
                </Card.Header>
                <Card.Body className="row g-2">
                  <div className="col-12">
                    <Form.Label>本次變更說明</Form.Label>
                    <Form.Control
                      value={versionsUi.changeSummary}
                      onChange={(e) => onFieldChange('changeSummary', e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <Form.Label>題目結構（JSON，進階）</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={12}
                      value={versionsUi.schemaText}
                      onChange={(e) => onFieldChange('schemaText', e.target.value)}
                      placeholder='{"id":"your_survey_key","title":"...","questions":[]}'
                    />
                    <Form.Text className="text-muted">
                      題目與選項以此 JSON 定義；若不熟悉格式，請洽系統管理員或參考已發布版本複製修改。已發布版本請新建草稿再改。
                    </Form.Text>
                  </div>
                  <div className="col-12 d-flex justify-content-end gap-2">
                    <Button variant="outline-secondary" onClick={onCancelEdit} disabled={versionsUi.saving}>
                      取消
                    </Button>
                    <Button onClick={onSave} disabled={versionsUi.saving}>
                      {versionsUi.saving ? '儲存中…' : '儲存'}
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            ) : null}
          </>
        ) : null}
      </Modal.Body>
    </Modal>
  );
}
