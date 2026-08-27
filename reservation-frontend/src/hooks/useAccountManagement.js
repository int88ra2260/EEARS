import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { P } from '../constants/permissions';
import {
  DEFAULT_FILTERS,
  EMPTY_CREATE_FORM,
  ROLE_OPTIONS,
  TEACHER_LEVEL_OPTIONS,
} from '../constants/accountManagement';
import {
  getFlatPermissionKeyOrder,
  getPermissionGroupBuckets,
  canActorManageAccount,
  isEventLeadAccountManager,
  isSystemAdminActor,
} from '../constants/permissionGroups';
import { ALL_SCOPES } from '../constants/scopes';
import {
  createTeacher,
  deleteTeacher,
  fetchTeacherAccessDebug,
  fetchTeachers,
  resetTeacherPassword,
  updateTeacher,
} from '../services/accountAdminApi';
import { buildAccessProfile, hasPermission } from '../utils/accessControl';
import { parseJwtPayload } from '../utils/jwtPayload';
import {
  accountHasSystemOverrideInJson,
  buildEditSnapshot,
  buildFilterSummary,
  downloadTextFile,
  exportAccountsToCsv,
  normalizeCreateTeacherBody,
  serializeEditPayload,
} from '../utils/accountManagementHelpers';

function createEditFormFromAccount(account) {
  return {
    username: account?.username || '',
    name: account?.name || '',
    email: account?.email || '',
    studentId: account?.studentId || '',
    role: account?.role || 'teacher',
    teacherLevel: account?.role === 'teacher' ? (account?.teacherLevel || 'regular') : null,
    staffLevel: account?.role === 'office_staff' ? (account?.staffLevel || 'event_lead') : null,
    isActive: !!account?.isActive,
    disabledReason: account?.disabledReason || '',
    mustResetPassword: !!account?.mustResetPassword,
  };
}

function createPermissionModeFromAccount(account) {
  const overrides = account?.permissions && typeof account.permissions === 'object' ? account.permissions : null;
  const nextMode = {};
  getFlatPermissionKeyOrder().forEach((key) => {
    const value = overrides ? overrides[key] : undefined;
    nextMode[key] = value === true ? 'allow' : value === false ? 'deny' : 'inherit';
  });
  return nextMode;
}

function createScopeStateFromAccount(account) {
  const scopes = Array.isArray(account?.scopes) ? account.scopes : [];
  const customScopes = scopes.filter((scope) => ALL_SCOPES.includes(scope));
  return {
    scopeMode: customScopes.length ? 'custom' : 'inherit',
    customScopes,
  };
}

function closeEditState(setEditingAccount, initialSnapshotRef) {
  setEditingAccount(null);
  initialSnapshotRef.current = '';
}

export function useAccountManagement({ token, userRole, accessProfile: ctxProfile }) {
  const accessProfile = useMemo(
    () => ctxProfile || buildAccessProfile(token || '', userRole || ''),
    [ctxProfile, token, userRole]
  );
  const actorIsSystemAdmin = isSystemAdminActor(accessProfile);
  const currentActorId = useMemo(() => {
    const payload = token ? parseJwtPayload(token) : null;
    const id = payload?.id ?? payload?.teacherId;
    return id != null ? Number(id) : null;
  }, [token]);
  const canManage = hasPermission(accessProfile, P.CAN_MANAGE_ACCOUNTS);
  const canViewAccessDebug =
    actorIsSystemAdmin ||
    hasPermission(accessProfile, P.CAN_VIEW_AUDIT_LOGS) ||
    hasPermission(accessProfile, P.CAN_VIEW_INTERNAL_DIAGNOSTICS);
  const actorIsEventLeadAccountManager = isEventLeadAccountManager(accessProfile);
  const roleChoicesForActor = useMemo(() => {
    if (actorIsEventLeadAccountManager) {
      return ROLE_OPTIONS.filter((option) => option.value === 'leader');
    }
    return ROLE_OPTIONS.filter(
      (option) => option.value !== 'all' && (actorIsSystemAdmin || option.value !== 'admin')
    );
  }, [actorIsEventLeadAccountManager, actorIsSystemAdmin]);
  const roleFilterChoicesForActor = useMemo(() => {
    if (actorIsEventLeadAccountManager) {
      return ROLE_OPTIONS.filter((option) => option.value === 'leader');
    }
    return ROLE_OPTIONS;
  }, [actorIsEventLeadAccountManager]);
  const teacherLevelChoicesForActor = useMemo(() => TEACHER_LEVEL_OPTIONS, []);
  const permissionOrphans = useMemo(() => getPermissionGroupBuckets().orphans, []);

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState(() => (
    actorIsEventLeadAccountManager
      ? { ...DEFAULT_FILTERS, role: 'leader' }
      : { ...DEFAULT_FILTERS }
  ));
  const [searchInput, setSearchInput] = useState(DEFAULT_FILTERS.search);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [pwdCopied, setPwdCopied] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(() => ({ ...EMPTY_CREATE_FORM }));
  const [saving, setSaving] = useState(false);
  const [resetInfo, setResetInfo] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editForm, setEditForm] = useState(() => createEditFormFromAccount(null));
  const [editPermMode, setEditPermMode] = useState({});
  const [scopeMode, setScopeMode] = useState('inherit');
  const [customScopes, setCustomScopes] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [accessDebugOpen, setAccessDebugOpen] = useState(false);
  const [accessDebugAccount, setAccessDebugAccount] = useState(null);
  const [accessDebugData, setAccessDebugData] = useState(null);
  const [accessDebugLoading, setAccessDebugLoading] = useState(false);
  const [accessDebugError, setAccessDebugError] = useState('');
  const [editModalTab, setEditModalTab] = useState('profile');
  const [showPermTechIds, setShowPermTechIds] = useState(false);
  const initialEditSnapshotRef = useRef('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => {
        const nextSearch = searchInput.trim();
        return prev.search === nextSearch ? prev : { ...prev, search: nextSearch };
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!actorIsEventLeadAccountManager) return;
    setFilters((prev) => {
      if (prev.role === 'leader' && prev.teacherLevel === 'all' && prev.staffLevel === 'all') {
        return prev;
      }
      return {
        ...prev,
        role: 'leader',
        teacherLevel: 'all',
        staffLevel: 'all',
      };
    });
  }, [actorIsEventLeadAccountManager]);

  const serverFilters = useMemo(
    () => ({
      role: actorIsEventLeadAccountManager ? 'leader' : filters.role,
      teacherLevel: actorIsEventLeadAccountManager ? 'all' : filters.teacherLevel,
      staffLevel: actorIsEventLeadAccountManager ? 'all' : filters.staffLevel,
      status: filters.status,
      mustResetPassword: filters.mustResetPassword,
      search: filters.search,
    }),
    [
      actorIsEventLeadAccountManager,
      filters.role,
      filters.teacherLevel,
      filters.staffLevel,
      filters.status,
      filters.mustResetPassword,
      filters.search,
    ]
  );

  const loadAccounts = useCallback(async () => {
    if (!token || !canManage) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchTeachers(token, serverFilters);
      setAccounts(data);
    } catch (err) {
      setError(err.message || '載入帳號資料失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  }, [canManage, serverFilters, token]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const displayedAccounts = useMemo(() => {
    let list = accounts;
    if (actorIsEventLeadAccountManager) {
      list = list.filter((account) => account.role === 'leader');
    } else if (!actorIsSystemAdmin) {
      list = list.filter((account) => account.role !== 'admin');
    }
    if (filters.systemOverride === 'has') {
      return list.filter((account) => accountHasSystemOverrideInJson(account));
    }
    if (filters.systemOverride === 'none') {
      return list.filter((account) => !accountHasSystemOverrideInJson(account));
    }
    return list;
  }, [accounts, actorIsEventLeadAccountManager, actorIsSystemAdmin, filters.systemOverride]);

  const filterSummary = useMemo(
    () => buildFilterSummary(filters, displayedAccounts.length, accounts.length),
    [accounts.length, displayedAccounts.length, filters]
  );

  const currentEditSnapshot = useMemo(() => {
    if (!editingAccount) return '';
    return buildEditSnapshot(editingAccount, editForm, editPermMode, scopeMode, customScopes);
  }, [customScopes, editForm, editPermMode, editingAccount, scopeMode]);

  const editDirty = !!editingAccount && !!initialEditSnapshotRef.current && currentEditSnapshot !== initialEditSnapshotRef.current;

  const clearFilters = useCallback(() => {
    setFilters({
      ...DEFAULT_FILTERS,
      ...(actorIsEventLeadAccountManager ? { role: 'leader' } : {}),
    });
    setSearchInput(DEFAULT_FILTERS.search);
  }, [actorIsEventLeadAccountManager]);

  const handleInputChange = useCallback((field, value) => {
    setCreateForm((prev) => {
      if (field !== 'role') {
        return { ...prev, [field]: value };
      }
      return {
        ...prev,
        role: value,
        teacherLevel: value === 'teacher' ? (prev.teacherLevel || 'regular') : null,
        staffLevel: value === 'office_staff' ? (prev.staffLevel || 'event_lead') : null,
      };
    });
  }, []);

  const openCreateModal = useCallback(() => {
    setCreateForm({
      ...EMPTY_CREATE_FORM,
      role: actorIsEventLeadAccountManager ? 'leader' : EMPTY_CREATE_FORM.role,
      teacherLevel: actorIsEventLeadAccountManager ? null : EMPTY_CREATE_FORM.teacherLevel,
      staffLevel: actorIsEventLeadAccountManager ? null : EMPTY_CREATE_FORM.staffLevel,
    });
    setShowCreateModal(true);
  }, [actorIsEventLeadAccountManager]);

  const handleCreateAccount = useCallback(
    async (event) => {
      event.preventDefault();
      if (actorIsEventLeadAccountManager && createForm.role !== 'leader') {
        setError('僅可建立英語桌帶班（ET Leader）帳號。');
        return;
      }
      setSaving(true);
      setError('');
      setSuccess('');
      try {
        const created = await createTeacher(token, normalizeCreateTeacherBody(createForm));
        setShowCreateModal(false);
        setCreateForm({ ...EMPTY_CREATE_FORM });
        setSuccess('帳號建立成功。');
        if (created?.temporaryPassword) {
          setResetInfo({
            username: created.username,
            password: created.temporaryPassword,
            message: '請將臨時密碼通知該使用者；首次登入後系統會要求修改密碼。',
          });
        }
        await loadAccounts();
      } catch (err) {
        setError(err.message || '建立帳號失敗，請確認欄位後再試。');
      } finally {
        setSaving(false);
      }
    },
    [actorIsEventLeadAccountManager, createForm, loadAccounts, token]
  );

  const handleToggleStatus = useCallback(
    async (account) => {
      if (!canActorManageAccount(accessProfile, account)) {
        setError('您無權管理此帳號。');
        return;
      }
      setError('');
      setSuccess('');
      try {
        await updateTeacher(token, account.id, { isActive: !account.isActive });
        setSuccess(`帳號 ${account.username} 已${account.isActive ? '停用' : '啟用'}。`);
        await loadAccounts();
      } catch (err) {
        setError(err.message || '更新帳號狀態失敗，請稍後再試。');
      }
    },
    [accessProfile, loadAccounts, token]
  );

  const openEditModal = useCallback((account) => {
    const nextEditForm = createEditFormFromAccount(account);
    const nextPermMode = createPermissionModeFromAccount(account);
    const nextScopeState = createScopeStateFromAccount(account);
    setEditingAccount(account);
    setEditForm(nextEditForm);
    setEditPermMode(nextPermMode);
    setScopeMode(nextScopeState.scopeMode);
    setCustomScopes(nextScopeState.customScopes);
    setEditModalTab('profile');
    initialEditSnapshotRef.current = buildEditSnapshot(
      account,
      nextEditForm,
      nextPermMode,
      nextScopeState.scopeMode,
      nextScopeState.customScopes
    );
  }, []);

  const requestCloseEditModal = useCallback(() => {
    if (editDirty && !window.confirm('尚有未儲存變更，確定要關閉嗎？')) {
      return;
    }
    closeEditState(setEditingAccount, initialEditSnapshotRef);
  }, [editDirty]);

  const handleSaveEdit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!editingAccount) return;
      if (!canActorManageAccount(accessProfile, editingAccount)) {
        setError('您無權管理此帳號。');
        return;
      }
      setEditSaving(true);
      setError('');
      setSuccess('');
      try {
        const payload = serializeEditPayload(editingAccount, editForm, editPermMode, scopeMode, customScopes);
        await updateTeacher(token, editingAccount.id, payload);
        setSuccess('帳號已更新。請提醒使用者重新登入以套用最新權限。');
        closeEditState(setEditingAccount, initialEditSnapshotRef);
        await loadAccounts();
      } catch (err) {
        setError(err.message || '更新帳號失敗，請稍後再試。');
      } finally {
        setEditSaving(false);
      }
    },
    [accessProfile, customScopes, editForm, editPermMode, editingAccount, loadAccounts, scopeMode, token]
  );

  const handleResetPassword = useCallback(
    async (account) => {
      if (!canActorManageAccount(accessProfile, account)) {
        setError('您無權管理此帳號。');
        return;
      }
      setError('');
      setSuccess('');
      setPwdCopied(false);
      if (
        !window.confirm(
          `確定要重設「${account.username}」的密碼嗎？\n\n系統無法顯示既有密碼（僅儲存雜湊值）；重設後會產生一次性臨時密碼供您轉交給使用者。`
        )
      ) {
        return;
      }
      try {
        const data = await resetTeacherPassword(token, account.id);
        if (data?.temporaryPassword) {
          setResetInfo({
            username: account.username,
            password: data.temporaryPassword,
            message: '請安全地將臨時密碼提供給使用者；對方下次登入時必須修改密碼。',
          });
        }
        setSuccess(`帳號 ${account.username} 已重設密碼。`);
        await loadAccounts();
      } catch (err) {
        setError(err.message || '重設密碼失敗，請稍後再試。');
      }
    },
    [accessProfile, loadAccounts, token]
  );

  const handleDeleteAccount = useCallback(
    async (account) => {
      if (!canActorManageAccount(accessProfile, account)) {
        setError('您無權管理此帳號。');
        return;
      }
      setError('');
      setSuccess('');
      if (currentActorId != null && Number(account.id) === Number(currentActorId)) {
        setError('無法刪除目前登入中的帳號。');
        return;
      }
      const label = account.name ? `${account.username}（${account.name}）` : account.username;
      if (
        !window.confirm(
          `確定要永久刪除帳號「${label}」嗎？\n\n此動作無法復原；相關權限覆寫與班級關聯也會一併移除。`
        )
      ) {
        return;
      }
      try {
        await deleteTeacher(token, account.id);
        if (editingAccount?.id === account.id) {
          closeEditState(setEditingAccount, initialEditSnapshotRef);
        }
        setSuccess(`帳號 ${account.username} 已刪除。`);
        await loadAccounts();
      } catch (err) {
        setError(err.message || '刪除帳號失敗，請稍後再試。');
      }
    },
    [accessProfile, currentActorId, editingAccount, loadAccounts, token]
  );

  const openAccessDebug = useCallback(
    async (account) => {
      setAccessDebugOpen(true);
      setAccessDebugAccount(account);
      setAccessDebugData(null);
      setAccessDebugError('');
      setAccessDebugLoading(true);
      try {
        const data = await fetchTeacherAccessDebug(token, account.id);
        setAccessDebugData(data);
      } catch (err) {
        setAccessDebugError(err.message || '載入權限來源失敗，請稍後再試。');
      } finally {
        setAccessDebugLoading(false);
      }
    },
    [token]
  );

  const closeAccessDebugModal = useCallback(() => {
    setAccessDebugOpen(false);
    setAccessDebugAccount(null);
    setAccessDebugData(null);
    setAccessDebugError('');
    setAccessDebugLoading(false);
  }, []);

  const closeResetInfoModal = useCallback(() => {
    setResetInfo(null);
    setPwdCopied(false);
  }, []);

  const handleExportAccountsCsv = useCallback(() => {
    const csv = exportAccountsToCsv(displayedAccounts);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadTextFile(`eears-accounts-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  }, [displayedAccounts]);

  return {
    accessProfile,
    actorIsSystemAdmin,
    actorIsEventLeadAccountManager,
    currentActorId,
    canManage,
    canViewAccessDebug,
    permissionOrphans,
    roleChoicesForActor,
    roleFilterChoicesForActor,
    teacherLevelChoicesForActor,
    accounts,
    loading,
    error,
    setError,
    success,
    filters,
    setFilters,
    searchInput,
    setSearchInput,
    tipsOpen,
    setTipsOpen,
    pwdCopied,
    setPwdCopied,
    showCreateModal,
    setShowCreateModal,
    openCreateModal,
    createForm,
    saving,
    resetInfo,
    editingAccount,
    editForm,
    setEditForm,
    editPermMode,
    setEditPermMode,
    scopeMode,
    setScopeMode,
    customScopes,
    setCustomScopes,
    editSaving,
    accessDebugOpen,
    accessDebugAccount,
    accessDebugData,
    accessDebugLoading,
    accessDebugError,
    editModalTab,
    setEditModalTab,
    showPermTechIds,
    setShowPermTechIds,
    editDirty,
    displayedAccounts,
    filterSummary,
    loadAccounts,
    clearFilters,
    handleInputChange,
    handleCreateAccount,
    handleToggleStatus,
    requestCloseEditModal,
    openEditModal,
    handleSaveEdit,
    handleResetPassword,
    handleDeleteAccount,
    openAccessDebug,
    closeAccessDebugModal,
    closeResetInfoModal,
    handleExportAccountsCsv,
  };
}
