'use strict';

/**
 * table vs JSON（legacy）來源一致性：語意比對（忽略 object key / array 順序）。
 * Phase 3.3：table 為 SoT；JSON 僅 fallback。
 *
 * hasMismatch 定義（正式設計）：
 * - JSON 為空：視為已退場／預期狀態，不與 table 比對出 mismatch
 * - JSON 非空且與 table 語意不同：才算真漂移
 */

/**
 * @param {Record<string, boolean>|null|undefined} overrides
 * @returns {Record<string, boolean>}
 */
function canonicalizePermissionOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return {};
  const out = {};
  for (const key of Object.keys(overrides).sort()) {
    const val = overrides[key];
    if (val === true || val === false) out[key] = val;
  }
  return out;
}

/**
 * @param {string[]|null|undefined} scopes
 * @returns {string[]}
 */
function canonicalizeScopes(scopes) {
  if (!Array.isArray(scopes)) return [];
  return Array.from(
    new Set(scopes.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()))
  ).sort();
}

function isEmptyAccess(permissionOverrides, scopeOverrides) {
  return Object.keys(permissionOverrides || {}).length === 0
    && (scopeOverrides || []).length === 0;
}

/**
 * @param {Record<string, boolean>} a
 * @param {Record<string, boolean>} b
 * @returns {{ onlyInA: string[], onlyInB: string[], valueMismatch: string[] }}
 */
function diffPermissionOverrideMaps(a, b) {
  const left = canonicalizePermissionOverrides(a);
  const right = canonicalizePermissionOverrides(b);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const onlyInA = [];
  const onlyInB = [];
  const valueMismatch = [];
  for (const key of Array.from(keys).sort()) {
    const hasL = Object.prototype.hasOwnProperty.call(left, key);
    const hasR = Object.prototype.hasOwnProperty.call(right, key);
    if (hasL && !hasR) onlyInA.push(key);
    else if (!hasL && hasR) onlyInB.push(key);
    else if (left[key] !== right[key]) valueMismatch.push(key);
  }
  return { onlyInA, onlyInB, valueMismatch };
}

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {{ onlyInA: string[], onlyInB: string[] }}
 */
function diffScopeLists(a, b) {
  const left = new Set(canonicalizeScopes(a));
  const right = new Set(canonicalizeScopes(b));
  return {
    onlyInA: Array.from(left).filter((s) => !right.has(s)).sort(),
    onlyInB: Array.from(right).filter((s) => !left.has(s)).sort(),
  };
}

/**
 * @param {object} params
 * @param {Record<string, boolean>} params.tablePermissionOverrides
 * @param {Record<string, boolean>|null|undefined} params.fallbackPermissionOverrides
 * @param {string[]} params.tableScopeOverrides
 * @param {string[]|null|undefined} params.fallbackScopeOverrides
 * @returns {{
 *   hasMismatch: boolean,
 *   permissionOverrideDiff: { table: Record<string, boolean>, fallback: Record<string, boolean> },
 *   scopeDiff: { table: string[], fallback: string[] },
 *   permissionOverrideKeyDiff: { onlyInTable: string[], onlyInFallback: string[], valueMismatch: string[] },
 *   scopeKeyDiff: { onlyInTable: string[], onlyInFallback: string[] },
 * }}
 */
function buildSourceConsistency({
  tablePermissionOverrides,
  fallbackPermissionOverrides,
  tableScopeOverrides,
  fallbackScopeOverrides,
}) {
  const tablePerms = canonicalizePermissionOverrides(tablePermissionOverrides);
  const fallbackPerms = canonicalizePermissionOverrides(fallbackPermissionOverrides || {});
  const tableScopes = canonicalizeScopes(tableScopeOverrides);
  const fallbackScopes = canonicalizeScopes(fallbackScopeOverrides || []);

  const permDiff = diffPermissionOverrideMaps(tablePerms, fallbackPerms);
  const scopeDiff = diffScopeLists(tableScopes, fallbackScopes);

  const rawUnequal =
    permDiff.onlyInA.length > 0
    || permDiff.onlyInB.length > 0
    || permDiff.valueMismatch.length > 0
    || scopeDiff.onlyInA.length > 0
    || scopeDiff.onlyInB.length > 0;

  // JSON 已空＝退場完成；不因「table 有、JSON 無」誤報
  const fallbackPresent = !isEmptyAccess(fallbackPerms, fallbackScopes);
  const hasMismatch = fallbackPresent && rawUnequal;

  return {
    hasMismatch,
    permissionOverrideDiff: {
      table: tablePerms,
      fallback: fallbackPerms,
    },
    scopeDiff: {
      table: tableScopes,
      fallback: fallbackScopes,
    },
    permissionOverrideKeyDiff: {
      onlyInTable: permDiff.onlyInA,
      onlyInFallback: permDiff.onlyInB,
      valueMismatch: permDiff.valueMismatch,
    },
    scopeKeyDiff: {
      onlyInTable: scopeDiff.onlyInA,
      onlyInFallback: scopeDiff.onlyInB,
    },
  };
}

/**
 * table 與 JSON 語意等價（可安全清掉 stale JSON）。
 * 兩邊皆空也視為等價。
 * @param {Record<string, boolean>|null|undefined} tableOverrides
 * @param {Record<string, boolean>|null|undefined} jsonOverrides
 * @param {string[]|null|undefined} tableScopes
 * @param {string[]|null|undefined} jsonScopes
 */
function isSemanticallyEqualAccess(tableOverrides, jsonOverrides, tableScopes, jsonScopes) {
  const tablePerms = canonicalizePermissionOverrides(tableOverrides || {});
  const jsonPerms = canonicalizePermissionOverrides(jsonOverrides || {});
  const tScopes = canonicalizeScopes(tableScopes || []);
  const jScopes = canonicalizeScopes(jsonScopes || []);
  const permDiff = diffPermissionOverrideMaps(tablePerms, jsonPerms);
  const scopeDiff = diffScopeLists(tScopes, jScopes);
  return permDiff.onlyInA.length === 0
    && permDiff.onlyInB.length === 0
    && permDiff.valueMismatch.length === 0
    && scopeDiff.onlyInA.length === 0
    && scopeDiff.onlyInB.length === 0;
}

module.exports = {
  canonicalizePermissionOverrides,
  canonicalizeScopes,
  isEmptyAccess,
  diffPermissionOverrideMaps,
  diffScopeLists,
  buildSourceConsistency,
  isSemanticallyEqualAccess,
};
