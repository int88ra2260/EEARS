/**
 * 產品級問卷模組：總覽（串接 GET /api/admin/surveys）
 */
import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import StatusBadge from '../../components/ui/StatusBadge';
import Dropdown from 'react-bootstrap/Dropdown';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { canAccessAdminRoute } from '../../constants/adminRouteAccess';
import { P } from '../../constants/permissions';
import { labelSurveyStatus } from '../../constants/surveyAdminUx';
import { surveyModuleStatusToVariant } from '../../utils/statusBadgeUtils';
import useToast from '../../components/ui/useToast';
import { useSurveyAdminModule } from '../../hooks/useSurveyAdminModule';
import {
  formatShortUpdatedAt,
  SurveyRuleSummary,
  SURVEY_ACTION_MENU_POPPER,
} from '../../utils/surveyAdminModuleHelpers';
import SurveyAdminCreateModal from '../../components/admin/survey/SurveyAdminCreateModal';
import SurveyAdminVersionsModal from '../../components/admin/survey/SurveyAdminVersionsModal';
import './surveyAdminModule.css';

export default function SurveyAdminModulePage({ embedded = false }) {
  const toast = useToast();
  const { token, userRole, accessProfile: ctxProfile } = useOutletContext();
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');
  const canView = hasPermission(accessProfile, P.CAN_VIEW_SURVEYS);
  const canManage = hasPermission(accessProfile, P.CAN_MANAGE_SURVEYS);
  const canPublish = hasPermission(accessProfile, P.CAN_PUBLISH_SURVEYS);
  const canResponses = hasPermission(accessProfile, P.CAN_VIEW_SURVEY_RESPONSES);
  const canAnalytics = hasPermission(accessProfile, P.CAN_VIEW_SURVEY_ANALYTICS);
  const canExportNew = hasPermission(accessProfile, P.CAN_EXPORT_SURVEY_RESPONSES);
  const canAccessImportCenter = canAccessAdminRoute(accessProfile, '/admin/import-center');

  const {
    loading,
    error,
    q,
    setQ,
    filteredRows,
    load,
    showCreate,
    createForm,
    setCreateForm,
    createSubmitting,
    openCreate,
    closeCreate,
    submitCreate,
    versionsUi,
    openVersions,
    closeVersions,
    createDraftVersion,
    startEditVersion,
    cancelEditVersion,
    updateVersionsField,
    saveVersion,
    publishVersion,
    exportSurveyJson,
  } = useSurveyAdminModule({
    token,
    canView,
    canPublish,
    role: accessProfile.role,
    toast,
  });

  const pageWrapClass = embedded ? 'survey-admin-module' : 'container py-4';

  if (!canView) {
    return (
      <div className={pageWrapClass}>
        <Alert variant="warning">您沒有檢視問卷模組的權限。</Alert>
      </div>
    );
  }

  return (
    <div className={pageWrapClass}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3 survey-admin-toolbar">
        <div className="flex-grow-1" style={{ minWidth: '12rem' }}>
          <h2 className="h4 mb-1 text-primary">問卷中心</h2>
          <p className="text-muted small mb-0">
            管理問卷主檔、題目版本與發布；<strong>已發布</strong>的版本才是學生與前台看到的正式內容。
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap flex-shrink-0">
          <Form.Control
            size="sm"
            className="survey-admin-search"
            style={{ width: 'min(100%, 240px)' }}
            placeholder="搜尋問卷名稱或代碼"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline-secondary" size="sm" onClick={load} disabled={loading}>
            重新整理
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" onClick={openCreate}>
              新增問卷
            </Button>
          )}
        </div>
      </div>

      <Card className="border-0 shadow-sm survey-admin-card">
        <Card.Body className="p-0 position-relative">
          {loading && (
            <div className="text-center py-5 px-3">
              <Spinner animation="border" role="status" variant="primary" />
            </div>
          )}
          {!loading && error && <Alert variant="danger" className="m-3">{error}</Alert>}
          {!loading && !error && filteredRows.length === 0 && (
            <Alert variant="info" className="m-3 mb-0">
              {q ? (
                '查無符合搜尋條件的問卷。'
              ) : (
                <>
                  <div className="fw-semibold mb-1">尚無問卷</div>
                  <div className="small">
                    請按右上角「新增問卷」建立第一份問卷；建立後請用「編輯與發布」新增草稿並發布，再到
                    {' '}
                    <Link to="/admin/survey-rules">啟用規則</Link>
                    {' '}
                    指定學期與活動何時要填。
                  </div>
                </>
              )}
            </Alert>
          )}
          {!loading && !error && filteredRows.length > 0 && (
            <div className="survey-admin-table-scroll px-2 px-md-3 pb-2 pt-2">
              <Table hover size="sm" className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>問卷名稱</th>
                    <th>問卷代碼</th>
                    <th className="text-center">狀態</th>
                    <th className="text-center">版號</th>
                    <th>啟用規則</th>
                    <th className="text-end">作答數</th>
                    <th>最後更新</th>
                    <th className="text-end">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id}>
                      <td className="survey-admin-name-cell" title={r.name}>{r.name}</td>
                      <td>
                        <code className="survey-admin-code text-danger">{r.surveyKey}</code>
                      </td>
                      <td className="text-center">
                        <StatusBadge variant={surveyModuleStatusToVariant(r.status)} size="sm">
                          {labelSurveyStatus(r.status)}
                        </StatusBadge>
                      </td>
                      <td className="text-center">{r.publishedVersionNumber ?? '—'}</td>
                      <td>
                        <SurveyRuleSummary isEnabled={r.isEnabled} isRequired={r.isRequired} />
                      </td>
                      <td className="text-end fw-semibold">{r.responseCount ?? 0}</td>
                      <td className="small text-nowrap text-muted">
                        {formatShortUpdatedAt(r.updatedAt)}
                      </td>
                      <td className="text-end">
                        <Dropdown align="end">
                          <Dropdown.Toggle variant="outline-primary" size="sm" id={`survey-actions-${r.id}`}>
                            操作
                          </Dropdown.Toggle>
                          <Dropdown.Menu popperConfig={SURVEY_ACTION_MENU_POPPER} renderOnMount>
                            <Dropdown.Item href={`/survey/${r.surveyKey}`} target="_blank" rel="noreferrer">
                              學生端預覽
                            </Dropdown.Item>
                            {canManage ? (
                              <Dropdown.Item onClick={() => openVersions(r)}>
                                編輯題目與發布
                              </Dropdown.Item>
                            ) : null}
                            {canResponses ? (
                              <Dropdown.Item as={Link} to={`/admin/survey-responses/${r.id}`}>
                                查看作答紀錄
                              </Dropdown.Item>
                            ) : null}
                            {canAnalytics ? (
                              <Dropdown.Item as={Link} to={`/admin/survey-analytics/${r.id}`}>
                                統計分析
                              </Dropdown.Item>
                            ) : null}
                            <Dropdown.Divider />
                            <Dropdown.Item as={Link} to="/admin/survey-rules">
                              設定啟用規則…
                            </Dropdown.Item>
                            {canExportNew ? (
                              <Dropdown.Item onClick={() => exportSurveyJson(r)}>
                                下載問卷備份（JSON）
                              </Dropdown.Item>
                            ) : null}
                            {canAccessImportCenter ? (
                              <Dropdown.Item as={Link} to="/admin/import-center">
                                資料匯入中心（匯出說明）
                              </Dropdown.Item>
                            ) : null}
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <SurveyAdminCreateModal
        show={showCreate}
        form={createForm}
        submitting={createSubmitting}
        onHide={closeCreate}
        onChange={setCreateForm}
        onSubmit={submitCreate}
      />

      <SurveyAdminVersionsModal
        versionsUi={versionsUi}
        canPublish={canPublish}
        onHide={closeVersions}
        onCreateDraft={createDraftVersion}
        onStartEdit={startEditVersion}
        onCancelEdit={cancelEditVersion}
        onFieldChange={updateVersionsField}
        onSave={saveVersion}
        onPublish={publishVersion}
      />
    </div>
  );
}
