'use strict';

const { logSystemAsync } = require('../services/systemLogService');
const { formatTaipeiTime } = require('../utils/time');
const {
  resolveSemesterIdFromRequest,
  buildCanonicalPolicy
} = require('../services/learningJourney/canonicalSemesterPolicyService');

const DEFAULT_DOC_LINK = '/docs/legacy-route-api-deprecation.md';

function legacyDeprecationHeaders(options = {}) {
  const {
    sunset = 'TBD',
    replacementApi = '',
    docLink = DEFAULT_DOC_LINK,
    scope = 'legacy_api',
    blockCanonicalSemesterWrites = false,
    gone = false,
    goneMessage = '此 legacy API 已封存，請改用替代 API。',
  } = options;

  return function markLegacyDeprecated(req, res, next) {
    res.set('Deprecation', 'true');
    res.set('Sunset', sunset);
    res.set(
      'Link',
      [`<${docLink}>; rel="deprecation"`, replacementApi ? `<${replacementApi}>; rel="successor-version"` : null]
        .filter(Boolean)
        .join(', ')
    );
    res.set('X-EEARS-Replacement', replacementApi || 'See deprecation register');
    res.set('X-EEARS-Replacement-API', replacementApi || '');

    const method = String(req.method || '').toUpperCase();
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (gone) {
      const payload = {
        success: false,
        error: goneMessage,
        requestId: req.requestId,
        meta: {
          deprecated: true,
          sunset: true,
          replacementApi: replacementApi || null,
          scope
        }
      };
      console.warn(`[${formatTaipeiTime()}] [legacy-gone] scope=${scope} method=${method} path=${req.originalUrl} replacement=${replacementApi || 'TBD'}`);
      if (req.requestId) {
        logSystemAsync({
          requestId: req.requestId,
          type: 'legacy_gone',
          method,
          path: req.originalUrl,
          status: 410,
          userId: req.user && req.user.id,
          role: req.user && req.user.role,
          ipAddress: req.ip,
          userAgent: req.get && req.get('user-agent'),
          errorMessage: JSON.stringify({
            scope,
            replacementApi,
            message: goneMessage
          }),
        });
      }
      return res.status(410).json(payload);
    }

    if (isWrite) {
      const semesterId = resolveSemesterIdFromRequest(req);
      const canonicalPolicy = buildCanonicalPolicy(semesterId);
      if (blockCanonicalSemesterWrites && canonicalPolicy.canonicalRequired) {
        const payload = {
          success: false,
          error: '此學期已要求使用 Learning Journey canonical 流程，legacy 寫入已停用。',
          requestId: req.requestId,
          meta: {
            deprecated: true,
            legacyWriteBlocked: true,
            canonicalRequired: true,
            canonicalPolicy,
            replacementApi: replacementApi || canonicalPolicy.replacementApi
          }
        };
        console.warn(
          `[${formatTaipeiTime()}] [legacy-write-blocked] scope=${scope} method=${method} path=${req.originalUrl} semesterId=${semesterId} replacement=${replacementApi || canonicalPolicy.replacementApi}`
        );
        if (req.requestId) {
          logSystemAsync({
            requestId: req.requestId,
            type: 'legacy_write_blocked',
            method,
            path: req.originalUrl,
            status: 409,
            userId: req.user && req.user.id,
            role: req.user && req.user.role,
            ipAddress: req.ip,
            userAgent: req.get && req.get('user-agent'),
            errorMessage: JSON.stringify({
              scope,
              semesterId,
              canonicalPolicy,
              message: 'Canonical-required semester blocked legacy write'
            }),
          });
        }
        return res.status(409).json(payload);
      }

      console.warn(`[${formatTaipeiTime()}] [legacy-write] scope=${scope} method=${method} path=${req.originalUrl} replacement=${replacementApi || 'TBD'}`);
      if (req.requestId) {
        logSystemAsync({
          requestId: req.requestId,
          type: 'legacy_write',
          method,
          path: req.originalUrl,
          status: 200,
          userId: req.user && req.user.id,
          role: req.user && req.user.role,
          ipAddress: req.ip,
          userAgent: req.get && req.get('user-agent'),
          errorMessage: JSON.stringify({
            scope,
            replacementApi,
            semesterId,
            canonicalPolicy,
            message: 'Deprecated legacy write API used',
          }),
        });
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
          const nextBody = Array.isArray(body) ? body : {
            ...body,
            meta: {
              ...(body.meta || {}),
              deprecated: true,
              legacyWrite: true,
              canonicalPolicy,
              replacementApi: replacementApi || null,
            },
          };
          return originalJson(nextBody);
        }
        return originalJson(body);
      };
    }

    return next();
  };
}

module.exports = {
  legacyDeprecationHeaders,
};
