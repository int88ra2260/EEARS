/**
 * DEMO 帳號防護：
 * - 禁止寫入（POST/PUT/PATCH/DELETE），密碼變更除外
 * - 攔截 JSON 回應，清空常見列表／計數字段，避免暴露真實資料
 */

function isDemoUser(req) {
  return !!(req && req.user && (req.user.isDemo === true || req.user.isDemo === 1 || req.user.isDemo === 'true'));
}

function isDemoPasswordPath(req) {
  const path = String(req.originalUrl || req.url || '');
  return /\/(password|reset-password|change-password|account\/reset)/i.test(path);
}

function emptyDemoValue(value, depth = 0) {
  if (depth > 6) return value;
  if (Array.isArray(value)) return [];
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      const lower = key.toLowerCase();
      if (
        Array.isArray(child)
        || /^(data|items|rows|results|list|events|teachers|students|reservations|records|entries|blocks|announcements|classes|users|accounts)$/i.test(key)
      ) {
        out[key] = Array.isArray(child) ? [] : emptyDemoValue(child, depth + 1);
      } else if (/^(total|count|totalcount|totalpages|pagecount)$/i.test(lower) && typeof child === 'number') {
        out[key] = 0;
      } else if (lower === 'pagination' && child && typeof child === 'object') {
        out[key] = {
          ...child,
          total: 0,
          totalPages: 0,
          totalCount: 0,
        };
      } else if (child && typeof child === 'object' && !Array.isArray(child)) {
        out[key] = emptyDemoValue(child, depth + 1);
      } else {
        out[key] = child;
      }
    }
    out.demo = true;
    if (out.message == null && out.error == null) {
      out.message = 'DEMO 帳號不顯示真實資料';
    }
    return out;
  }
  return value;
}

function applyDemoResponseGuard(req, res) {
  if (res.__demoGuardApplied) return;
  res.__demoGuardApplied = true;
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(emptyDemoValue(body));
}

/**
 * 在 authMiddleware 成功後呼叫。
 * @returns {boolean} true = 已回應（blocked），false = 繼續
 */
function enforceDemoAccount(req, res) {
  if (!isDemoUser(req)) return false;

  applyDemoResponseGuard(req, res);

  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return false;
  }
  if (isDemoPasswordPath(req)) {
    return false;
  }

  res.status(403).json({
    code: 'DEMO_READ_ONLY',
    error: 'DEMO 帳號為唯讀，無法變更資料',
    message: 'Demo account is read-only',
    demo: true,
  });
  return true;
}

module.exports = {
  isDemoUser,
  emptyDemoValue,
  applyDemoResponseGuard,
  enforceDemoAccount,
};
