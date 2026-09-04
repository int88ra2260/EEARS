const mockRoleFindAll = jest.fn();
const mockOverrideFindAll = jest.fn();
const mockScopeFindAll = jest.fn();

jest.mock('../models', () => ({
  RolePermission: { findAll: (...args) => mockRoleFindAll(...args) },
  UserPermissionOverride: { findAll: (...args) => mockOverrideFindAll(...args) },
  UserScope: { findAll: (...args) => mockScopeFindAll(...args) },
}));

const {
  normalizeRoleKey,
  buildEffectiveAccessFromSources,
} = require('../services/accessControl/readService');

describe('access control table-first', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ACCESS_PROFILE_JSON_FALLBACK_ENABLED;
  });

  it('RolePermissions 以 role+teacherLevel key 接管 base mapping', async () => {
    expect(normalizeRoleKey('teacher', 'et_manager')).toBe('teacher:et_manager');
    expect(normalizeRoleKey('office_staff', null, 'curriculum_lead')).toBe('office_staff:curriculum_lead');
    expect(normalizeRoleKey('worker', null, null, 'content_editor')).toBe('worker:content_editor');
    expect(normalizeRoleKey('worker')).toBe('worker:event_ops');
    mockRoleFindAll.mockResolvedValue([{ permission: 'can_view_surveys' }]);
    mockOverrideFindAll.mockResolvedValue([]);
    mockScopeFindAll.mockResolvedValue([]);

    const result = await buildEffectiveAccessFromSources({
      userId: 10,
      role: 'teacher',
      teacherLevel: 'et_manager',
      mode: 'table_first',
    });
    expect(result.basePermissions).toContain('can_view_surveys');
    expect(result.finalPermissions).toContain('can_view_surveys');
    expect(result.source).toBe('table_first');
  });

  it('UserPermissionOverrides allow/deny 正確覆蓋 base permissions', async () => {
    mockRoleFindAll.mockResolvedValue([{ permission: 'can_view_surveys' }, { permission: 'can_export_surveys' }]);
    mockOverrideFindAll.mockResolvedValue([
      { permission: 'can_export_surveys', value: 'deny' },
      { permission: 'can_manage_surveys', value: 'allow' },
    ]);
    mockScopeFindAll.mockResolvedValue([]);
    const result = await buildEffectiveAccessFromSources({
      userId: 11,
      role: 'teacher',
      teacherLevel: 'et_manager',
      mode: 'table_first',
    });
    expect(result.finalPermissions).toContain('can_view_surveys');
    expect(result.finalPermissions).not.toContain('can_export_surveys');
    expect(result.finalPermissions).toContain('can_manage_surveys');
  });

  it('UserScopes 會成為 table-first 主要 scope 來源', async () => {
    mockRoleFindAll.mockResolvedValue([]);
    mockOverrideFindAll.mockResolvedValue([]);
    mockScopeFindAll.mockResolvedValue([
      { scopeType: 'event', scopeValue: 'english_table' },
      { scopeType: 'event', scopeValue: 'survey_english_table' },
    ]);
    const result = await buildEffectiveAccessFromSources({
      userId: 12,
      role: 'teacher',
      teacherLevel: 'et_manager',
      mode: 'table_first',
      jsonScopes: ['class'],
    });
    expect(result.scopeOverrides).toEqual(expect.arrayContaining(['english_table', 'survey_english_table']));
  });

  it('可關閉 JSON fallback，避免 JSON 主讀回流', async () => {
    process.env.ACCESS_PROFILE_JSON_FALLBACK_ENABLED = 'false';
    mockRoleFindAll.mockResolvedValue([{ permission: 'can_view_events_admin' }]);
    mockOverrideFindAll.mockResolvedValue([]);
    mockScopeFindAll.mockResolvedValue([]);
    const result = await buildEffectiveAccessFromSources({
      userId: 13,
      role: 'worker',
      teacherLevel: null,
      mode: 'table_first',
      jsonPermissions: { can_manage_accounts: true },
      jsonScopes: ['all'],
    });
    expect(result.permissionOverrides).toBeNull();
    expect(result.scopeOverrides).toBeNull();
    expect(result.finalPermissions).toContain('can_view_events_admin');
  });

  it('office_staff + staffLevel 使用 role_permissions 複合鍵', async () => {
    mockRoleFindAll.mockResolvedValue([{ permission: 'can_view_classes' }]);
    mockOverrideFindAll.mockResolvedValue([]);
    mockScopeFindAll.mockResolvedValue([]);
    const result = await buildEffectiveAccessFromSources({
      userId: 20,
      role: 'office_staff',
      teacherLevel: null,
      staffLevel: 'curriculum_lead',
      mode: 'table_first',
    });
    expect(result.basePermissions).toContain('can_view_classes');
    expect(result.source).toBe('table_first');
  });

  it('worker + workerLevel 使用 role_permissions 複合鍵', async () => {
    mockRoleFindAll.mockResolvedValue([{ permission: 'can_manage_announcements' }]);
    mockOverrideFindAll.mockResolvedValue([]);
    mockScopeFindAll.mockResolvedValue([]);
    const result = await buildEffectiveAccessFromSources({
      userId: 21,
      role: 'worker',
      teacherLevel: null,
      workerLevel: 'content_editor',
      mode: 'table_first',
    });
    expect(mockRoleFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'worker:content_editor' } })
    );
    expect(result.basePermissions).toContain('can_manage_announcements');
    expect(result.source).toBe('table_first');
  });
});

