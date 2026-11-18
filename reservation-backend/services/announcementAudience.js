const { AUDIENCE_TYPES } = require('../constants/announcementConstants');

/**
 * 公開公告的觀看者。
 * public：未登入。student／teacher／admin：已驗證的對應身分。
 */
function allowedAudienceTypes(viewer) {
  if (viewer === 'student') return [AUDIENCE_TYPES.ALL, AUDIENCE_TYPES.STUDENTS];
  if (viewer === 'teacher') return [AUDIENCE_TYPES.ALL, AUDIENCE_TYPES.TEACHERS];
  if (viewer === 'admin') return [AUDIENCE_TYPES.ALL, AUDIENCE_TYPES.ADMINS];
  return [AUDIENCE_TYPES.ALL];
}

function canViewAudience(audienceType, viewer) {
  const value = audienceType || AUDIENCE_TYPES.ALL;
  return allowedAudienceTypes(viewer).includes(value);
}

function audienceWhere(viewer, Op) {
  return {
    [Op.or]: [
      { audienceType: { [Op.in]: allowedAudienceTypes(viewer) } },
      { audienceType: null },
    ],
  };
}

module.exports = {
  allowedAudienceTypes,
  canViewAudience,
  audienceWhere,
};
