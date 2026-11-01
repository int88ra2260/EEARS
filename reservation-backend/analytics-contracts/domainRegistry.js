'use strict';

/**
 * Phase 3 領域。只做識別，不計算指標。
 * DOM-GOV 是跨域平台，不是另一個儀表板。
 */
const DOMAINS = Object.freeze([
  Object.freeze({
    domainId: 'DOM-OPS',
    displayName: '營運與名額',
    purpose: '活動供給、預約列、簽到列、名額利用率',
  }),
  Object.freeze({
    domainId: 'DOM-PART',
    displayName: '學習參與',
    purpose: '名單上的人是否出現、培力出席碼、微學習軌跡',
  }),
  Object.freeze({
    domainId: 'DOM-ATTAIN',
    displayName: '評量達標',
    purpose: '在寫明的母體與規則下是否達到該規則。不是單一 B2',
  }),
  Object.freeze({
    domainId: 'DOM-STATE',
    displayName: '能力存量',
    purpose: '截至查詢時看到的等級狀態。不是單次測驗成果',
  }),
  Object.freeze({
    domainId: 'DOM-LONG',
    displayName: '變化與考前暴露',
    purpose: '同工具相鄰梯次的差，以及考前窗時數',
  }),
  Object.freeze({
    domainId: 'DOM-EXPLORE',
    displayName: '對照與探索',
    purpose: '群體差異與同時出現的現象。預設不是因果',
  }),
  Object.freeze({
    domainId: 'DOM-GOV',
    displayName: '證據與發布',
    purpose: '契約、缺漏、宣稱天花板、版本。不產生第二套達標率',
  }),
]);

const BY_ID = new Map(DOMAINS.map((row) => [row.domainId, row]));

function listDomains() {
  return DOMAINS.map((row) => ({ ...row }));
}

function getDomain(domainId) {
  return BY_ID.get(domainId) || null;
}

module.exports = {
  DOMAINS,
  listDomains,
  getDomain,
};
