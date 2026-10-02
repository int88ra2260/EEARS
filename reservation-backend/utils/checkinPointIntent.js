'use strict';

function isTruthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * 簽到點數意向。到場不計點優先：不進護照、也不進課堂加分。
 * @param {object} [body]
 * @returns {{ excludeFromClassCredit: boolean, countsTowardPassport: boolean }}
 */
function parseCheckinPointIntent(body = {}) {
  const excludeFromClassCredit = isTruthyFlag(body.excludeFromClassCredit);
  const countsTowardPassport = !excludeFromClassCredit && isTruthyFlag(body.countsTowardPassport);
  return { excludeFromClassCredit, countsTowardPassport };
}

module.exports = {
  parseCheckinPointIntent,
};
