import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Alert } from 'react-bootstrap';
import { useAccountManagement } from '../hooks/useAccountManagement';
import AccountManagementToolbar from './admin/accounts/AccountManagementToolbar';
import AccountFiltersCard from './admin/accounts/AccountFiltersCard';
import AccountTable from './admin/accounts/AccountTable';
import AccountCreateModal from './admin/accounts/AccountCreateModal';
import AccountEditModal from './admin/accounts/AccountEditModal';
import AccountAccessDebugModal from './admin/accounts/AccountAccessDebugModal';
import AccountResetPasswordModal from './admin/accounts/AccountResetPasswordModal';

function AccountManagement() {
  const { token, userRole, accessProfile: ctxProfile } = useOutletContext();
  const m = useAccountManagement({ token, userRole, accessProfile: ctxProfile });

  if (!m.canManage) {
    return (
      <div className="alert alert-info mt-3" role="alert">
        您沒有檢視帳號管理的權限。
      </div>
    );
  }

  return (
    <div className="account-management pb-4">
      <AccountManagementToolbar
        displayedCount={m.displayedAccounts.length}
        totalCount={m.accounts.length}
        tipsOpen={m.tipsOpen}
        onToggleTips={() => m.setTipsOpen((v) => !v)}
      />

      {m.error && <Alert variant="danger" dismissible onClose={() => m.setError('')}>{m.error}</Alert>}
      {m.success && <Alert variant="success">{m.success}</Alert>}

      <AccountFiltersCard
        filters={m.filters}
        setFilters={m.setFilters}
        searchInput={m.searchInput}
        setSearchInput={m.setSearchInput}
        filterSummary={m.filterSummary}
        loading={m.loading}
        onClearFilters={m.clearFilters}
        onReload={() => m.loadAccounts()}
        roleFilterOptions={m.roleFilterChoicesForActor}
        lockLeaderOnly={m.actorIsEventLeadAccountManager}
      />

      <AccountTable
        loading={m.loading}
        displayedAccounts={m.displayedAccounts}
        accessProfile={m.accessProfile}
        actorIsEventLeadAccountManager={m.actorIsEventLeadAccountManager}
        actorIsSystemAdmin={m.actorIsSystemAdmin}
        currentActorId={m.currentActorId}
        canViewAccessDebug={m.canViewAccessDebug}
        onExportCsv={m.handleExportAccountsCsv}
        onOpenCreate={m.openCreateModal}
        onOpenEdit={m.openEditModal}
        onOpenAccessDebug={m.openAccessDebug}
        onResetPassword={m.handleResetPassword}
        onToggleStatus={m.handleToggleStatus}
        onDeleteAccount={m.handleDeleteAccount}
      />

      <AccountCreateModal
        show={m.showCreateModal}
        onHide={() => m.setShowCreateModal(false)}
        createForm={m.createForm}
        roleChoicesForActor={m.roleChoicesForActor}
        teacherLevelChoicesForActor={m.teacherLevelChoicesForActor}
        saving={m.saving}
        onInputChange={m.handleInputChange}
        onSubmit={m.handleCreateAccount}
      />

      <AccountEditModal
        editingAccount={m.editingAccount}
        editForm={m.editForm}
        setEditForm={m.setEditForm}
        editPermMode={m.editPermMode}
        setEditPermMode={m.setEditPermMode}
        scopeMode={m.scopeMode}
        setScopeMode={m.setScopeMode}
        customScopes={m.customScopes}
        setCustomScopes={m.setCustomScopes}
        editModalTab={m.editModalTab}
        setEditModalTab={m.setEditModalTab}
        showPermTechIds={m.showPermTechIds}
        setShowPermTechIds={m.setShowPermTechIds}
        editDirty={m.editDirty}
        editSaving={m.editSaving}
        actorIsSystemAdmin={m.actorIsSystemAdmin}
        accessProfile={m.accessProfile}
        permissionOrphans={m.permissionOrphans}
        roleChoicesForActor={m.roleChoicesForActor}
        teacherLevelChoicesForActor={m.teacherLevelChoicesForActor}
        onClose={m.requestCloseEditModal}
        onSave={m.handleSaveEdit}
      />

      <AccountAccessDebugModal
        show={m.accessDebugOpen}
        account={m.accessDebugAccount}
        data={m.accessDebugData}
        loading={m.accessDebugLoading}
        error={m.accessDebugError}
        onClose={m.closeAccessDebugModal}
      />

      <AccountResetPasswordModal
        resetInfo={m.resetInfo}
        pwdCopied={m.pwdCopied}
        setPwdCopied={m.setPwdCopied}
        onClose={m.closeResetInfoModal}
      />
    </div>
  );
}

export default AccountManagement;
