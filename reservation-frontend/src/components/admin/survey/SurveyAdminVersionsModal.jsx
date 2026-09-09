import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, ButtonGroup, Card, Form, Modal, Spinner, Table,
} from 'react-bootstrap';
import { labelSurveyStatus } from '../../../constants/surveyAdminUx';
import SurveyQuestionEditor from './SurveyQuestionEditor';

function VersionEditor({ versionsUi, onFieldChange, onCancelEdit, onSave }) {
  const [editorMode, setEditorMode] = useState('visual');
  const [jsonError, setJsonError] = useState('');

  const schemaObject = useMemo(() => {
    try {
      return JSON.parse(versionsUi.schemaText || '{}');
    } catch {
      return null;
    }
  }, [versionsUi.schemaText]);

  useEffect(() => {
    try {
      JSON.parse(versionsUi.schemaText || '{}');
      setJsonError('');
    } catch (e) {
      setJsonError(`JSON 格式錯誤：${e.message}`);
    }
  }, [versionsUi.schemaText]);

  const handleSchemaChange = (newSchema) => {
    try {
      onFieldChange('schemaText', JSON.stringify(newSchema, null, 2));
      setJsonError('');
    } catch (e) {
      setJsonError(`無法轉換為 JSON：${e.message}`);
    }
  };

  const handleJsonTextChange = (text) => {
    onFieldChange('schemaText', text);
  };

  return (
    <Card className="border-0 shadow-sm mt-3">
      <Card.Header className="bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="fw-semibold">
          視覺化編輯 — v{versionsUi.editing.versionNumber}（{versionsUi.editing.status}）
        </span>
        <ButtonGroup size="sm">
          <Button
            variant={editorMode === 'visual' ? 'primary' : 'outline-primary'}
            onClick={() => setEditorMode('visual')}
            disabled={!!jsonError && editorMode === 'json'}
            title={jsonError && editorMode === 'json' ? '請先修正 JSON 再切換' : ''}
          >
            視覺化編輯
          </Button>
          <Button
            variant={editorMode === 'json' ? 'primary' : 'outline-primary'}
            onClick={() => setEditorMode('json')}
          >
            {'{ }'} JSON
          </Button>
        </ButtonGroup>
      </Card.Header>
      <Card.Body>
        <div className="mb-3">
          <Form.Label>本次變更說明</Form.Label>
          <Form.Control
            value={versionsUi.changeSummary}
            onChange={(e) => onFieldChange('changeSummary', e.target.value)}
            placeholder="例：新增滿意度題目、調整選項順序"
          />
        </div>

        {jsonError && editorMode === 'visual' ? (
          <Alert variant="warning" className="small">
            {jsonError}
            <br />
            <span className="text-muted">請切換到 JSON 模式修正格式後再回來視覺化編輯。</span>
          </Alert>
        ) : null}

        {editorMode === 'visual' && schemaObject ? (
          <SurveyQuestionEditor
            schema={schemaObject}
            onChange={handleSchemaChange}
            showPreview
          />
        ) : null}

        {editorMode === 'json' ? (
          <div>
            {jsonError ? (
              <Alert variant="danger" className="small py-2">{jsonError}</Alert>
            ) : null}
            <Form.Control
              as="textarea"
              rows={16}
              value={versionsUi.schemaText}
              onChange={(e) => handleJsonTextChange(e.target.value)}
              placeholder='{"id":"your_survey_key","title":"...","questions":[]}'
              className="font-monospace small"
              style={{ fontSize: '12px' }}
            />
            <Form.Text className="text-muted">
              進階使用者可直接編輯 JSON；格式須正確才能切換回視覺化編輯。
            </Form.Text>
          </div>
        ) : null}

        <div className="d-flex justify-content-end gap-2 mt-3 pt-3 border-top">
          <Button variant="outline-secondary" onClick={onCancelEdit} disabled={versionsUi.saving}>
            取消
          </Button>
          <Button
            onClick={onSave}
            disabled={versionsUi.saving || !!jsonError}
          >
            {versionsUi.saving ? '儲存中…' : '儲存草稿'}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

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
  const isEditing = !!versionsUi.editing;

  return (
    <Modal
      show={versionsUi.show}
      onHide={onHide}
      centered={!isEditing}
      size="xl"
      fullscreen={isEditing ? true : 'lg-down'}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {isEditing ? '視覺化問卷編輯器' : '編輯題目與發布'}
          {versionsUi.survey ? ` — ${versionsUi.survey.name}` : ''}
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
            {!isEditing ? (
              <>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div className="text-muted small">
                    流程：建立草稿（會帶入上一版題目）→ 視覺化編輯 → 儲存 → 發布。已發布版本不可再改。
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
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
                              title={v.status === 'published' ? '已發布版本不可修改' : '開啟視覺化編輯器'}
                            >
                              視覺化編輯
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
              </>
            ) : (
              <VersionEditor
                versionsUi={versionsUi}
                onFieldChange={onFieldChange}
                onCancelEdit={onCancelEdit}
                onSave={onSave}
              />
            )}
          </>
        ) : null}
      </Modal.Body>
    </Modal>
  );
}
