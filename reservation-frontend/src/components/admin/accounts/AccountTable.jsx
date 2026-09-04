import React from 'react';
import { Badge, Button, Card, Dropdown, Spinner, Stack, Table } from 'react-bootstrap';
import StatusBadge from '../../../components/ui/StatusBadge';
import {
  ACCOUNT_ACTION_MENU_POPPER,
  ROLE_BADGE_DEFAULT,
  ROLE_BADGE_SOFT,
  STAFF_LEVEL_OPTIONS,
  STAFF_LEVEL_TABLE_LABEL,
  WORKER_LEVEL_OPTIONS,
  WORKER_LEVEL_TABLE_LABEL,
  TEACHER_LEVEL_OPTIONS,
  TEACHER_LEVEL_TABLE_LABEL,
} from '../../../constants/accountManagement';
import { accountHasCustomOverrides, formatLastLoginShort } from '../../../utils/accountManagementHelpers';
import { canActorManageAccount } from '../../../constants/permissionGroups';

export default function AccountTable({
  loading,
  displayedAccounts,
  accessProfile,
  actorIsEventLeadAccountManager,
  actorIsSystemAdmin,
  currentActorId,
  canViewAccessDebug,
  onExportCsv,
  onOpenCreate,
  onOpenEdit,
  onOpenAccessDebug,
  onResetPassword,
  onToggleStatus,
  onDeleteAccount,
}) {
  return (
    <>
      <style>
        {`
          .account-mgmt-table { table-layout: fixed; width: 100%; }
          .account-mgmt-table th.account-mgmt-sticky-actions,
          .account-mgmt-table td.account-mgmt-sticky-actions {
            position: sticky;
            right: 0;
            z-index: 2;
            width: 5.5rem;
            min-width: 5.5rem;
            max-width: 5.5rem;
            box-shadow: -8px 0 12px -8px rgba(0, 0, 0, 0.18);
            background-color: var(--bs-body-bg, #fff);
            vertical-align: middle;
          }
          .account-mgmt-table thead th.account-mgmt-sticky-actions {
            z-index: 3;
            background-color: var(--bs-secondary-bg, #e9ecef);
          }
          .account-mgmt-table td.account-mgmt-sticky-actions:has(.dropdown.show) {
            z-index: 1070;
          }
          .account-mgmt-table.table-hover > tbody > tr:hover > td.account-mgmt-sticky-actions {
            background-color: var(--bs-table-hover-bg, #eef0f2) !important;
          }
          .account-mgmt-table-wrap {
            overflow: visible;
          }
          .account-mgmt-table .dropdown-menu {
            z-index: 1071 !important;
          }
          .account-mgmt-modal-create.modal-dialog {
            max-height: calc(100vh - 1.5rem);
            margin-top: 0.75rem;
            margin-bottom: 0.75rem;
          }
          .account-mgmt-modal-create .modal-content {
            max-height: calc(100vh - 1.5rem);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .account-mgmt-modal-create .modal-content > form {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
          }
          .account-mgmt-modal-create .modal-body {
            overflow-y: auto;
            flex: 1 1 auto;
            min-height: 0;
            -webkit-overflow-scrolling: touch;
          }
          .account-mgmt-modal-create .modal-footer {
            flex-shrink: 0;
          }
        `}
      </style>
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3 d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom">
          <span className="fw-semibold">帳號列表</span>
          <Stack direction="horizontal" gap={2} className="flex-wrap">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={onExportCsv}
              disabled={!displayedAccounts.length}
            >
              匯出 CSV
            </Button>
            <Button size="sm" onClick={onOpenCreate}>新增帳號</Button>
          </Stack>
        </Card.Header>
        <Card.Body className="p-0 position-relative overflow-visible">
          {loading ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-2 text-muted">
              <Spinner animation="border" role="status" />
              <span className="small">載入帳號列表中…</span>
            </div>
          ) : (
            <div className="w-100 border-top account-mgmt-table-wrap">
              <Table hover bordered size="sm" className="mb-0 align-middle account-mgmt-table">
                <colgroup>
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '5.5rem' }} />
                </colgroup>
                <thead className="table-light">
                  <tr className="small text-secondary">
                    <th>帳號</th>
                    <th>姓名</th>
                    <th>Email</th>
                    <th>身分</th>
                    <th>狀態</th>
                    <th>最後登入</th>
                    <th className="account-mgmt-sticky-actions text-center border-start">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-5">
                        目前沒有符合條件的帳號。可試著調整篩選或按「重新載入」。
                      </td>
                    </tr>
                  ) : (
                    displayedAccounts.map((account) => {
                      const editDisabled = !canActorManageAccount(accessProfile, account);
                      const deleteDisabled =
                        editDisabled
                        || (currentActorId != null && Number(account.id) === Number(currentActorId));
                      const editTitle = editDisabled
                        ? (actorIsEventLeadAccountManager
                          ? '僅可管理 ET Leader 帳號'
                          : '僅系統管理員可管理 admin 或執行長帳號')
                        : undefined;
                      const deleteTitle = editDisabled
                        ? (actorIsEventLeadAccountManager
                          ? '僅可刪除 ET Leader 帳號'
                          : '僅系統管理員可刪除 admin 或執行長帳號')
                        : deleteDisabled
                          ? '無法刪除目前登入中的帳號'
                          : undefined;
                      const custom = accountHasCustomOverrides(account);
                      const levelKey = account.teacherLevel || 'regular';
                      const levelShort = TEACHER_LEVEL_TABLE_LABEL[levelKey] || levelKey;
                      const staffKey = account.staffLevel || '';
                      const staffShort = STAFF_LEVEL_TABLE_LABEL[staffKey] || staffKey;
                      const workerKey = account.workerLevel || '';
                      const workerShort = WORKER_LEVEL_TABLE_LABEL[workerKey] || workerKey;
                      const roleSoft = ROLE_BADGE_SOFT[account.role] || ROLE_BADGE_DEFAULT;
                      return (
                        <tr key={account.id}>
                          <td className="fw-medium text-truncate" title={account.username}>
                            {account.username}
                          </td>
                          <td className="text-truncate" title={account.name || ''}>
                            {account.name || '—'}
                          </td>
                          <td className="small text-truncate" title={account.email || ''}>
                            {account.email || '—'}
                          </td>
                          <td>
                            <div className="d-flex flex-column gap-1 align-items-start">
                              <Badge {...roleSoft} className="fw-normal border border-secondary-subtle">
                                {account.role}
                              </Badge>
                              {account.role === 'teacher' ? (
                                <Badge
                                  bg="info-subtle"
                                  text="info-emphasis"
                                  className="fw-normal text-truncate border border-secondary-subtle"
                                  style={{ maxWidth: '100%' }}
                                  title={TEACHER_LEVEL_OPTIONS.find((o) => o.value === account.teacherLevel)?.label || ''}
                                >
                                  {levelShort}
                                </Badge>
                              ) : account.role === 'office_staff' && staffKey ? (
                                <Badge
                                  bg="info-subtle"
                                  text="info-emphasis"
                                  className="fw-normal text-truncate border border-secondary-subtle"
                                  style={{ maxWidth: '100%' }}
                                  title={STAFF_LEVEL_OPTIONS.find((o) => o.value === account.staffLevel)?.label || ''}
                                >
                                  {staffShort}
                                </Badge>
                              ) : account.role === 'worker' && workerKey ? (
                                <Badge
                                  bg="primary-subtle"
                                  text="primary-emphasis"
                                  className="fw-normal text-truncate border border-secondary-subtle"
                                  style={{ maxWidth: '100%' }}
                                  title={WORKER_LEVEL_OPTIONS.find((o) => o.value === account.workerLevel)?.label || ''}
                                >
                                  {workerShort}
                                </Badge>
                              ) : (
                                <span className="text-muted small">—</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex flex-column gap-1 align-items-start">
                              <StatusBadge variant={account.isActive ? 'success' : 'neutral'} size="sm">
                                {account.isActive ? '啟用' : '停用'}
                              </StatusBadge>
                              {account.mustResetPassword ? (
                                <StatusBadge variant="warning" size="sm">須改密碼</StatusBadge>
                              ) : null}
                              {custom ? (
                                <span className="badge rounded-pill text-bg-secondary fw-normal" title="含自訂權限或範圍覆寫（詳情請編輯帳號）">自訂</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="small text-muted text-nowrap" title={account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString('zh-TW') : ''}>
                            {formatLastLoginShort(account.lastLoginAt)}
                          </td>
                          <td className="account-mgmt-sticky-actions text-center border-start px-1">
                            <Dropdown drop="down" align="end">
                              <Dropdown.Toggle variant="outline-primary" size="sm" className="px-2" id={`acct-menu-${account.id}`}>
                                ⋯
                              </Dropdown.Toggle>
                              <Dropdown.Menu
                                popperConfig={ACCOUNT_ACTION_MENU_POPPER}
                                renderOnMount
                              >
                                <Dropdown.Item
                                  disabled={editDisabled}
                                  title={editTitle}
                                  onClick={() => !editDisabled && onOpenEdit(account)}
                                >
                                  編輯帳號
                                </Dropdown.Item>
                                {canViewAccessDebug ? (
                                  <Dropdown.Item onClick={() => onOpenAccessDebug(account)}>權限來源</Dropdown.Item>
                                ) : null}
                                <Dropdown.Divider />
                                <Dropdown.Item onClick={() => onResetPassword(account)}>重設密碼</Dropdown.Item>
                                <Dropdown.Item
                                  className={account.isActive ? 'text-danger' : 'text-success'}
                                  onClick={() => onToggleStatus(account)}
                                >
                                  {account.isActive ? '停用帳號' : '啟用帳號'}
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item
                                  className="text-danger"
                                  disabled={deleteDisabled}
                                  title={deleteTitle}
                                  onClick={() => !deleteDisabled && onDeleteAccount(account)}
                                >
                                  刪除帳號
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </>
  );
}
