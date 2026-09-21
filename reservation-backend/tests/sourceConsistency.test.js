'use strict';

const {
  canonicalizePermissionOverrides,
  canonicalizeScopes,
  buildSourceConsistency,
  isSemanticallyEqualAccess,
} = require('../services/accessControl/sourceConsistency');

describe('access control sourceConsistency', () => {
  it('忽略 permission override 的 key 順序', () => {
    const table = {
      can_export_et_grouping: true,
      can_manage_events: true,
      can_view_blacklist: true,
    };
    const fallback = {
      can_manage_events: true,
      can_view_blacklist: true,
      can_export_et_grouping: true,
    };
    const c = buildSourceConsistency({
      tablePermissionOverrides: table,
      fallbackPermissionOverrides: fallback,
      tableScopeOverrides: ['english_table'],
      fallbackScopeOverrides: ['english_table'],
    });
    expect(c.hasMismatch).toBe(false);
    expect(isSemanticallyEqualAccess(table, fallback, ['english_table'], ['english_table'])).toBe(true);
  });

  it('忽略 scope 陣列順序', () => {
    const c = buildSourceConsistency({
      tablePermissionOverrides: {},
      fallbackPermissionOverrides: {},
      tableScopeOverrides: ['english_table', 'class'],
      fallbackScopeOverrides: ['class', 'english_table'],
    });
    expect(c.hasMismatch).toBe(false);
    expect(c.scopeDiff.table).toEqual(['class', 'english_table']);
  });

  it('偵測僅存在於一邊的覆寫鍵', () => {
    const c = buildSourceConsistency({
      tablePermissionOverrides: { can_manage_events: true },
      fallbackPermissionOverrides: { can_manage_events: true, can_manage_accounts: true },
      tableScopeOverrides: [],
      fallbackScopeOverrides: [],
    });
    expect(c.hasMismatch).toBe(true);
    expect(c.permissionOverrideKeyDiff.onlyInFallback).toEqual(['can_manage_accounts']);
    expect(c.permissionOverrideKeyDiff.onlyInTable).toEqual([]);
  });

  it('JSON 已空時即使 table 有覆寫也不算 mismatch（SoT 退場完成）', () => {
    const c = buildSourceConsistency({
      tablePermissionOverrides: { can_manage_events: true },
      fallbackPermissionOverrides: {},
      tableScopeOverrides: ['english_table'],
      fallbackScopeOverrides: [],
    });
    expect(c.hasMismatch).toBe(false);
  });

  it('table 空而 JSON 仍有覆寫算 mismatch', () => {
    const c = buildSourceConsistency({
      tablePermissionOverrides: {},
      fallbackPermissionOverrides: { can_manage_events: true },
      tableScopeOverrides: [],
      fallbackScopeOverrides: [],
    });
    expect(c.hasMismatch).toBe(true);
    expect(c.permissionOverrideKeyDiff.onlyInFallback).toEqual(['can_manage_events']);
  });

  it('偵測同鍵不同值', () => {
    const c = buildSourceConsistency({
      tablePermissionOverrides: { can_manage_events: true },
      fallbackPermissionOverrides: { can_manage_events: false },
      tableScopeOverrides: [],
      fallbackScopeOverrides: [],
    });
    expect(c.hasMismatch).toBe(true);
    expect(c.permissionOverrideKeyDiff.valueMismatch).toEqual(['can_manage_events']);
  });

  it('canonicalize 只保留 boolean', () => {
    expect(canonicalizePermissionOverrides({
      can_manage_events: true,
      can_view_surveys: 'yes',
      can_export_surveys: null,
    })).toEqual({ can_manage_events: true });
    expect(canonicalizeScopes([' class ', 'class', 'english_table'])).toEqual(['class', 'english_table']);
  });
});
