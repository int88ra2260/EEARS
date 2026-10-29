import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { P } from './permissions';
import {
  ADMIN_ROUTE_ACCESS,
  canAccessAdminRoute,
  getAdminRouteAccess,
  getAdminRouteDeniedReason,
} from './adminRouteAccess';

const REDIRECT_COMPONENTS = new Set([
  'Navigate',
  'AdminLegacyRedirect',
  'PageContentLegacyRedirect',
  'LegacyEnglishTestStudentRedirect',
  'AnalyticsStudentProfileRedirect',
  'LegacyClassDetailRedirect',
]);

const appPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../App.js');

function stripComments(source) {
  return source.replace(/\{\/\*[\s\S]*?\*\//g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function readTag(source, openIndex) {
  const closing = source[openIndex + 1] === '/';
  let cursor = openIndex + (closing ? 2 : 1);
  let name = '';
  while (/[A-Za-z0-9.]/.test(source[cursor] || '')) {
    name += source[cursor];
    cursor += 1;
  }
  let quote = null;
  let brace = 0;
  let end = cursor;
  while (end < source.length) {
    const char = source[end];
    if (quote) {
      if (char === '\\' && quote !== '`') {
        end += 2;
        continue;
      }
      if (char === quote) quote = null;
      end += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      end += 1;
      continue;
    }
    if (char === '{') brace += 1;
    else if (char === '}' && brace > 0) brace -= 1;
    else if (char === '>' && brace === 0) break;
    end += 1;
  }
  const raw = source.slice(openIndex, end + 1);
  return {
    name,
    closing,
    raw,
    selfClosing: !closing && /\/\s*>$/.test(raw),
    end,
  };
}

function attributePath(raw) {
  const match = raw.match(/\spath=(?:"([^"]*)"|'([^']*)')/);
  return match ? (match[1] || match[2] || '') : null;
}

function isIndexRoute(raw) {
  return /\sindex(?:\s|>|\/>)/.test(raw);
}

function elementComponents(raw) {
  const marker = raw.search(/\selement\s*=/);
  if (marker < 0) return [];
  const brace = raw.indexOf('{', marker);
  if (brace < 0) return [];
  let depth = 0;
  let quote = null;
  let end = brace;
  for (; end < raw.length; end += 1) {
    const char = raw[end];
    if (quote) {
      if (char === '\\' && quote !== '`') {
        end += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const expression = raw.slice(brace, end + 1);
  return [...expression.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((match) => match[1]);
}

function joinPath(parent, child) {
  if (!child) return parent || '/admin';
  if (child.startsWith('/')) return child.split('?')[0];
  const base = parent && parent !== '/' ? parent.replace(/\/$/, '') : '';
  return `${base}/${child}`.replace(/\/{2,}/g, '/');
}

function isRedirect(components) {
  return components.length > 0 && components.every((name) => REDIRECT_COMPONENTS.has(name));
}

function findMatchingClose(source, from) {
  let depth = 1;
  let cursor = from;
  while (cursor < source.length) {
    const next = source.indexOf('<', cursor);
    if (next < 0) break;
    const tag = readTag(source, next);
    if (tag.name === 'Route') {
      if (tag.closing) {
        depth -= 1;
        if (depth === 0) return next;
      } else if (!tag.selfClosing) {
        depth += 1;
      }
    }
    cursor = tag.end + 1;
  }
  throw new Error('App.js admin Route tree is unbalanced');
}

function walkRoutes(source, start, end, parentPath, records) {
  let cursor = start;
  while (cursor < end) {
    const next = source.indexOf('<', cursor);
    if (next < 0 || next >= end) break;
    const tag = readTag(source, next);
    if (tag.name !== 'Route' || tag.closing) {
      cursor = next + 1;
      continue;
    }
    const childPath = attributePath(tag.raw);
    const fullPath = childPath == null && isIndexRoute(tag.raw)
      ? parentPath
      : joinPath(parentPath, childPath);
    records.push({
      path: fullPath,
      redirect: isRedirect(elementComponents(tag.raw)),
      components: elementComponents(tag.raw),
    });
    if (!tag.selfClosing) {
      const close = findMatchingClose(source, tag.end + 1);
      walkRoutes(source, tag.end + 1, close, fullPath, records);
      cursor = close + 1;
    } else {
      cursor = tag.end + 1;
    }
  }
}

function findAdminLayoutOpen(source) {
  let cursor = 0;
  while (cursor < source.length) {
    const next = source.indexOf('<Route', cursor);
    if (next < 0) break;
    const tag = readTag(source, next);
    if (!tag.closing && attributePath(tag.raw) === '/admin' && !tag.selfClosing) {
      return { index: next, tag };
    }
    cursor = Math.max(tag.end + 1, next + 1);
  }
  throw new Error('missing /admin route');
}

export function extractAdminRoutes(source) {
  const cleaned = stripComments(source);
  const records = [];
  const found = findAdminLayoutOpen(cleaned);
  const open = found.tag;
  records.push({
    path: '/admin',
    redirect: isRedirect(elementComponents(open.raw)),
    components: elementComponents(open.raw),
  });
  const close = findMatchingClose(cleaned, open.end + 1);
  walkRoutes(cleaned, open.end + 1, close, '/admin', records);

  let cursor = 0;
  while (cursor < cleaned.length) {
    const next = cleaned.indexOf('<Route', cursor);
    if (next < 0) break;
    const tag = readTag(cleaned, next);
    const routePath = attributePath(tag.raw);
    if (routePath && routePath.startsWith('/admin/') && !records.some((record) => record.path === routePath)) {
      records.push({
        path: routePath.split('?')[0],
        redirect: isRedirect(elementComponents(tag.raw)),
        components: elementComponents(tag.raw),
      });
    }
    cursor = tag.end + 1;
  }
  return records;
}

function samplePath(routePath) {
  return routePath.replace(/:[^/]+/g, 'sample').replace(/\*/g, 'sample');
}

function permissionKeys(rule) {
  return [...(rule.anyPermissions || []), ...(rule.allPermissions || [])];
}

function unknownPermissionKeys(rules, known) {
  return rules.flatMap((rule) => permissionKeys(rule).filter((key) => !known.has(key)));
}

const appSource = fs.readFileSync(appPath, 'utf8');
const adminRoutes = extractAdminRoutes(appSource);
const knownPermissions = new Set(Object.values(P));

describe('admin route access contract', () => {
  it('reads the live admin route tree', () => {
    expect(adminRoutes.length).toBeGreaterThan(40);
    expect(adminRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/admin/operations', redirect: false }),
      expect.objectContaining({ path: '/admin/events', redirect: true }),
      expect.objectContaining({ path: '/admin/account/reset', redirect: false }),
      expect.objectContaining({ path: '/admin/learning-analytics/explore', redirect: false }),
    ]));
  });

  it('T3-P1 gives every non-redirect admin route an access rule', () => {
    const missing = adminRoutes
      .filter((route) => !route.redirect)
      .map((route) => samplePath(route.path))
      .filter((pathname) => !getAdminRouteAccess(pathname));
    expect(missing).toEqual([]);
  });

  it('T3-P2 only references permission keys defined in P', () => {
    expect(unknownPermissionKeys(ADMIN_ROUTE_ACCESS, knownPermissions)).toEqual([]);
  });

  it('T3-P3 allows a profile that holds the route permission', () => {
    const profile = {
      role: 'worker',
      workerLevel: 'event_ops',
      permissionSet: new Set([P.CAN_VIEW_EVENTS_ADMIN]),
    };
    expect(canAccessAdminRoute(profile, '/admin/operations')).toBe(true);
    expect(getAdminRouteDeniedReason(profile, '/admin/operations')).toBeNull();
  });

  it('T3-P4 prefers the more specific student route over the parent prefix', () => {
    expect(getAdminRouteAccess('/admin/learning-analytics/students/B07900001').pattern)
      .toBe('/admin/learning-analytics/students/:studentId');
  });

  it('T3-N1 reports missing_rule for an unknown admin path', () => {
    expect(getAdminRouteDeniedReason(
      { role: 'admin', permissionSet: new Set(Object.values(P)) },
      '/admin/__no_such_page__'
    )).toMatchObject({ code: 'missing_rule' });
  });

  it('T3-N2 rejects a signed-in profile that lacks the permission', () => {
    const profile = {
      role: 'worker',
      workerLevel: 'event_ops',
      permissionSet: new Set(),
    };
    expect(getAdminRouteDeniedReason(profile, '/admin/operations')).toMatchObject({ code: 'forbidden' });
  });

  it('T3-N3 treats a profile without a role as unauthenticated', () => {
    expect(getAdminRouteDeniedReason({ permissionSet: new Set() }, '/admin/operations'))
      .toMatchObject({ code: 'unauthenticated' });
  });

  it('T3-F1 does not treat legacy redirects as pages missing a rule', () => {
    const redirects = adminRoutes.filter((route) => route.redirect);
    expect(redirects.length).toBeGreaterThan(5);
    redirects.forEach((route) => {
      expect(route.components.every((name) => REDIRECT_COMPONENTS.has(name))).toBe(true);
    });
    expect(redirects.some((route) => route.path === '/admin/operations')).toBe(false);
  });

  it('T3-F2 fails when a rule cites a permission outside P', () => {
    expect(unknownPermissionKeys([
      { anyPermissions: ['not_a_real_permission'] },
    ], knownPermissions)).toEqual(['not_a_real_permission']);
  });

  it('combines role, permission and staff level on diagnostics', () => {
    const deputy = {
      role: 'office_staff',
      staffLevel: 'deputy_manager',
      permissionSet: new Set([P.CAN_VIEW_INTERNAL_DIAGNOSTICS]),
    };
    const admin = {
      role: 'admin',
      permissionSet: new Set([P.CAN_VIEW_INTERNAL_DIAGNOSTICS]),
    };
    const adminWithoutPermission = {
      role: 'admin',
      permissionSet: new Set(),
    };
    expect(getAdminRouteDeniedReason(deputy, '/admin/diagnostics')).toMatchObject({ code: 'forbidden' });
    expect(getAdminRouteDeniedReason(adminWithoutPermission, '/admin/diagnostics')).toMatchObject({ code: 'forbidden' });
    expect(getAdminRouteDeniedReason(admin, '/admin/diagnostics')).toBeNull();
  });
});
