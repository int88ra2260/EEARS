'use strict';

const { hasPermission, canAccessEventType, P } = require('../../middlewares/auth');

/**
 * 活動明細 meta 的讀取決定。
 * 一般行政走預約檢視權限；Leader 只在已被指派、且活動類型在其範圍內時可讀。
 * @returns {'ok'|'unassigned'|'denied'}
 */
function decideEventMetaAccess(user, eventType, leaderGroupCount) {
  if (hasPermission(user, P.CAN_VIEW_RESERVATIONS) && canAccessEventType(user, eventType)) {
    return 'ok';
  }
  if (hasPermission(user, P.CAN_MARK_ET_SESSION_TASKS) && canAccessEventType(user, eventType)) {
    return Number(leaderGroupCount) > 0 ? 'ok' : 'unassigned';
  }
  return 'denied';
}

module.exports = { decideEventMetaAccess };
