import React from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Form,
  Modal,
  Stack,
  Tab,
  Tabs,
} from 'react-bootstrap';
import { PERMISSION_GROUPS } from '../../../constants/permissionGroups';
import {
  ROLE_BADGE_DEFAULT,
  ROLE_BADGE_SOFT,
  SCOPE_HINTS,
  SCOPE_LABELS,
  STAFF_LEVEL_OPTIONS,
  STAFF_LEVEL_SUMMARY,
  TEACHER_LEVEL_OPTIONS,
  WORKER_LEVEL_OPTIONS,
  WORKER_LEVEL_SUMMARY,
} from '../../../constants/accountManagement';
import { ALL_SCOPES } from '../../../constants/scopes';
import PermissionOverrideGuide from './PermissionOverrideGuide';
import PermissionOverrideRow from './PermissionOverrideRow';

export default function AccountEditModal({
  editingAccount,
  editForm,
  setEditForm,
  editPermMode,
  setEditPermMode,
  scopeMode,
  setScopeMode,
  customScopes,
  setCustomScopes,
  editModalTab,
  setEditModalTab,
  showPermTechIds,
  setShowPermTechIds,
  editDirty,
  editSaving,
  actorIsSystemAdmin,
  accessProfile,
  permissionOrphans,
  roleChoicesForActor,
  teacherLevelChoicesForActor,
  onClose,
  onSave,
}) {
  return (
    <Modal show={!!editingAccount} onHide={onClose} centered size="lg">
      <Modal.Header closeButton className="border-bottom">
        <div>
          <Modal.Title className="h5 mb-1">編輯帳號</Modal.Title>
          {editingAccount ? (
            <div className="d-flex flex-wrap align-items-center gap-2 small text-muted">
              <Badge
                {...(ROLE_BADGE_SOFT[editingAccount.role] || ROLE_BADGE_DEFAULT)}
              >
                {editingAccount.role}
              </Badge>
              {editingAccount.role === 'teacher' && editingAccount.teacherLevel ? (
                <Badge bg="info" className="fw-normal">
                  {TEACHER_LEVEL_OPTIONS.find((o) => o.value === editingAccount.teacherLevel)?.label || editingAccount.teacherLevel}
                </Badge>
              ) : null}
              {editingAccount.role === 'office_staff' && editingAccount.staffLevel ? (
                <Badge bg="info" className="fw-normal">
                  {STAFF_LEVEL_OPTIONS.find((o) => o.value === editingAccount.staffLevel)?.label || editingAccount.staffLevel}
                </Badge>
              ) : null}
              {editingAccount.role === 'worker' && editingAccount.workerLevel ? (
                <Badge bg="info" className="fw-normal">
                  {WORKER_LEVEL_OPTIONS.find((o) => o.value === editingAccount.workerLevel)?.label || editingAccount.workerLevel}
                </Badge>
              ) : null}
              <span className="text-nowrap">id <code>{editingAccount.id}</code></span>
              <span className="text-nowrap">accessVersion <code>{editingAccount.accessVersion ?? '—'}</code></span>
              {editDirty ? <Badge bg="warning" text="dark">未儲存</Badge> : null}
            </div>
          ) : null}
        </div>
      </Modal.Header>
      <Form id="form-edit-account" onSubmit={onSave}>
        <Modal.Body
          className="pt-3 d-flex flex-column"
          style={{ minHeight: 'min(72vh, 640px)', maxHeight: 'min(90vh, 860px)' }}
        >
          <Alert variant="light" border="secondary" className="small py-2 mb-2 flex-shrink-0">
            儲存後若變更<strong>角色、權限、範圍或密碼相關設定</strong>，對方需<strong>重新登入</strong>，JWT 與 accessVersion 才會同步。
          </Alert>
          <div className="flex-grow-1 overflow-auto min-h-0 mb-2">
            <Tabs
              id="edit-account-tabs"
              activeKey={editModalTab}
              onSelect={(k) => setEditModalTab(k || 'profile')}
              className="mb-0"
              justify
            >
              <Tab eventKey="profile" title="基本資料">
                <div className="pt-3 border-top">
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-medium">登入帳號 <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      value={editForm.username}
                      onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
                      required
                      autoComplete="username"
                      spellCheck={false}
                    />
                    <Form.Text className="text-muted">
                      3～50 字元；英文、數字、點、底線、連字號。登入時不分大小寫。
                    </Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-medium">姓名 <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      required
                      autoComplete="name"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-medium">Email <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      required
                      autoComplete="email"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-medium">角色</Form.Label>
                    <Form.Select
                      value={editForm.role}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditForm((p) => ({
                          ...p,
                          role: v,
                          ...(v === 'teacher'
                            ? { teacherLevel: p.teacherLevel || 'regular', staffLevel: null, workerLevel: null }
                            : {}),
                          ...(v === 'office_staff'
                            ? { staffLevel: p.staffLevel || 'event_lead', teacherLevel: null, workerLevel: null }
                            : {}),
                          ...(v === 'worker'
                            ? { workerLevel: p.workerLevel || 'event_ops', teacherLevel: null, staffLevel: null, studentId: '' }
                            : {}),
                          ...(v === 'leader'
                            ? { teacherLevel: null, staffLevel: null, workerLevel: null }
                            : {}),
                          ...(v === 'admin'
                            ? { teacherLevel: null, staffLevel: null, workerLevel: null, studentId: '' }
                            : {}),
                        }));
                      }}
                    >
                      {roleChoicesForActor.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">變更角色會影響預設權限與可存取範圍。</Form.Text>
                  </Form.Group>
                  {editForm.role === 'teacher' && (
                    <Form.Group className="mb-0">
                      <Form.Label className="fw-medium">老師層級</Form.Label>
                      <Form.Select
                        value={editForm.teacherLevel}
                        onChange={(e) => setEditForm((p) => ({ ...p, teacherLevel: e.target.value }))}
                      >
                        {teacherLevelChoicesForActor.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  )}
                  {editForm.role === 'leader' && (
                    <Form.Group className="mb-0">
                      <Form.Label className="fw-medium">學號</Form.Label>
                      <Form.Control
                        value={editForm.studentId || ''}
                        onChange={(e) => setEditForm((p) => ({ ...p, studentId: e.target.value }))}
                        placeholder="建議填寫，方便對照學生身份"
                      />
                    </Form.Group>
                  )}
                  {editForm.role === 'office_staff' && (
                    <Form.Group className="mb-0">
                      <Form.Label className="fw-medium">行政職務 <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        value={editForm.staffLevel}
                        onChange={(e) => setEditForm((p) => ({ ...p, staffLevel: e.target.value }))}
                      >
                        {STAFF_LEVEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted d-block mt-2">
                        {STAFF_LEVEL_SUMMARY[editForm.staffLevel || 'event_lead']?.description}
                      </Form.Text>
                      <Form.Text className="text-muted d-block">
                        預設權限摘要：
                        {(STAFF_LEVEL_SUMMARY[editForm.staffLevel || 'event_lead']?.permissions || []).join('、')}
                      </Form.Text>
                    </Form.Group>
                  )}
                  {editForm.role === 'worker' && (
                    <Form.Group className="mb-0">
                      <Form.Label className="fw-medium">工讀職務 <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        value={editForm.workerLevel}
                        onChange={(e) => setEditForm((p) => ({ ...p, workerLevel: e.target.value }))}
                      >
                        {WORKER_LEVEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted d-block mt-2">
                        {WORKER_LEVEL_SUMMARY[editForm.workerLevel || 'event_ops']?.description}
                      </Form.Text>
                      <Form.Text className="text-muted d-block">
                        預設權限摘要：
                        {(WORKER_LEVEL_SUMMARY[editForm.workerLevel || 'event_ops']?.permissions || []).join('、')}
                      </Form.Text>
                    </Form.Group>
                  )}
                </div>
              </Tab>
              <Tab eventKey="status" title="帳號狀態">
                <div className="pt-3 border-top">
                  <Card className="border-0 bg-light mb-3">
                    <Card.Body className="py-3">
                      <Form.Check
                        type="switch"
                        id="edit-active"
                        label={<span className="fw-medium">帳號啟用</span>}
                        checked={editForm.isActive}
                        onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                      />
                      <div className="small text-muted mt-2 mb-0">
                        停用後對方無法登入；若僅暫停權限，請優先評估是否改以權限覆寫處理。
                      </div>
                    </Card.Body>
                  </Card>
                  {!editForm.isActive && (
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-medium">停用原因（建議填寫）</Form.Label>
                      <Form.Control
                        value={editForm.disabledReason}
                        onChange={(e) => setEditForm((p) => ({ ...p, disabledReason: e.target.value }))}
                        placeholder="例如：離職／職務調整／測試帳號停用"
                        as="textarea"
                        rows={2}
                      />
                    </Form.Group>
                  )}
                  <Form.Group className="mb-0">
                    <Form.Check
                      type="switch"
                      id="edit-must-reset"
                      label={<span className="fw-medium">強制下次登入必須改密碼</span>}
                      checked={!!editForm.mustResetPassword}
                      onChange={(e) => setEditForm((p) => ({ ...p, mustResetPassword: e.target.checked }))}
                    />
                    <Form.Text className="text-muted">適用於首次給予臨時密碼後、或懷疑外洩時。</Form.Text>
                  </Form.Group>
                </div>
              </Tab>
              <Tab eventKey="scopes" title="資料範圍">
                <div className="pt-3 border-top">
                  <p className="small text-muted mb-3">
                    決定此帳號在後台能處理<strong>哪些業務</strong>（例如活動、班級、英檢），與「功能權限」分頁的開關不同。
                  </p>
                  <fieldset className="mb-3">
                    <legend className="fw-medium fs-6 mb-2">可存取的業務範圍</legend>
                    <Stack gap={2}>
                      <Card className={scopeMode === 'inherit' ? 'border-primary' : ''}>
                        <Card.Body className="py-2">
                          <Form.Check
                            type="radio"
                            name="scope-mode"
                            id="scope-mode-inherit"
                            checked={scopeMode === 'inherit'}
                            onChange={() => setScopeMode('inherit')}
                            label={<span className="fw-medium">依角色與職務自動決定（建議）</span>}
                          />
                          <div className="small text-muted ms-4 mt-1 mb-0">
                            系統依「角色」「老師層級」或「行政職務」帶入可操作的活動、班級、英檢等範圍，一般帳號請選此項。
                          </div>
                        </Card.Body>
                      </Card>
                      <Card className={scopeMode === 'custom' ? 'border-primary' : ''}>
                        <Card.Body className="py-2">
                          <Form.Check
                            type="radio"
                            name="scope-mode"
                            id="scope-mode-custom"
                            checked={scopeMode === 'custom'}
                            onChange={() => setScopeMode('custom')}
                            label={<span className="fw-medium">手動指定範圍</span>}
                          />
                          <div className="small text-muted ms-4 mt-1 mb-0">
                            僅在需要與同角色其他人不同範圍時使用；勾選項目才會生效，未勾選即不可存取。
                          </div>
                        </Card.Body>
                      </Card>
                    </Stack>
                  </fieldset>
                  {scopeMode === 'custom' ? (
                    <div className="border rounded p-3 bg-light">
                      <div className="fw-medium small mb-2">請勾選允許存取的業務</div>
                      <Stack gap={3}>
                        {ALL_SCOPES.map((s) => (
                          <div key={s}>
                            <Form.Check
                              type="checkbox"
                              id={`scope-${s}`}
                              label={SCOPE_LABELS[s] || s}
                              checked={customScopes.includes(s)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setCustomScopes((prev) => (checked ? Array.from(new Set([...prev, s])) : prev.filter((x) => x !== s)));
                              }}
                            />
                            {SCOPE_HINTS[s] ? (
                              <div className="small text-muted ms-4">{SCOPE_HINTS[s]}</div>
                            ) : null}
                          </div>
                        ))}
                      </Stack>
                    </div>
                  ) : (
                    <Alert variant="light" className="small mb-0 border">
                      目前將沿用系統依角色計算的範圍，無需逐項勾選。若要查看實際範圍，可儲存後請對方重新登入，或使用「權限來源」除錯。
                    </Alert>
                  )}
                </div>
              </Tab>
              <Tab
                eventKey="permissions"
                title={
                  <span>
                    功能權限
                    {Object.values(editPermMode || {}).some((m) => m && m !== 'inherit') ? (
                      <Badge bg="secondary" className="ms-1">已調整</Badge>
                    ) : null}
                  </span>
                }
              >
                <div className="pt-3 border-top">
                  <PermissionOverrideGuide />
                  {!actorIsSystemAdmin ? (
                    <Alert variant="warning" className="small py-2 mb-2">
                      「系統治理」區（稽核、診斷、系統設定等）僅系統管理員可調整。若此帳號已有相關覆寫，後端會保留，您仍可儲存其他欄位。
                    </Alert>
                  ) : null}
                  <div className="d-flex justify-content-end mb-2">
                    <Form.Check
                      type="switch"
                      id="show-perm-tech-ids"
                      className="small"
                      label="顯示技術代碼（進階）"
                      checked={showPermTechIds}
                      onChange={(e) => setShowPermTechIds(e.target.checked)}
                    />
                  </div>
                  <div style={{ maxHeight: 'min(48vh, 440px)', overflowY: 'auto' }} className="pe-1">
                    <Accordion flush alwaysOpen className="border rounded">
                      {PERMISSION_GROUPS.map((group) => (
                        <Accordion.Item eventKey={group.id} key={group.id}>
                          <Accordion.Header className="small">{group.title}</Accordion.Header>
                          <Accordion.Body className="pt-0 pb-2 px-2">
                            <div className="text-muted small mb-2">{group.blurb}</div>
                            {group.keys.map((k) => (
                              <PermissionOverrideRow
                                key={k}
                                permKey={k}
                                mode={editPermMode?.[k] || 'inherit'}
                                accessProfile={accessProfile}
                                showTechId={showPermTechIds}
                                onChange={(next) => setEditPermMode((p) => ({ ...(p || {}), [k]: next }))}
                              />
                            ))}
                          </Accordion.Body>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                    {permissionOrphans.length > 0 ? (
                      <div className="mt-2 border rounded p-2">
                        <div className="fw-semibold small mb-2">其他／未分類</div>
                        {permissionOrphans.map((k) => (
                          <PermissionOverrideRow
                            key={k}
                            permKey={k}
                            mode={editPermMode?.[k] || 'inherit'}
                            accessProfile={accessProfile}
                            showTechId={showPermTechIds}
                            onChange={(next) => setEditPermMode((p) => ({ ...(p || {}), [k]: next }))}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Tab>
            </Tabs>
          </div>
          <div className="flex-shrink-0 border-top bg-light rounded px-3 py-3 mt-auto shadow-sm">
            <Stack
              direction="horizontal"
              gap={2}
              className="justify-content-between align-items-center flex-wrap"
            >
              <span className="small text-muted mb-0 me-2">
                完成後請提醒對方重新登入；必要時搭配「重設密碼」或稽核日誌追蹤。
              </span>
              <Stack direction="horizontal" gap={2} className="ms-auto">
                <Button variant="outline-secondary" type="button" onClick={onClose}>
                  取消
                </Button>
                <Button type="submit" variant="primary" size="lg" disabled={editSaving}>
                  {editSaving ? '儲存中…' : '儲存變更'}
                </Button>
              </Stack>
            </Stack>
          </div>
        </Modal.Body>
      </Form>
    </Modal>
  );
}
