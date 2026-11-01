'use strict';

/**
 * Phase 2 D1–D11。本登錄不核准任何一項。
 * legacyActive 若出現在指標上，只表示舊程式正在跑，不是 approved。
 */
const DECISION_GATES = Object.freeze([
  Object.freeze({
    decisionId: 'D1',
    status: 'pending',
    question: '正式成果用哪一種達標定義',
  }),
  Object.freeze({
    decisionId: 'D2',
    status: 'pending',
    question: '名冊達標是否納入名冊學期以外的嘗試',
  }),
  Object.freeze({
    decisionId: 'D3',
    status: 'pending',
    question: '正式成果是否凍結',
  }),
  Object.freeze({
    decisionId: 'D4',
    status: 'pending',
    question: '單次培力是否獨立於名冊',
  }),
  Object.freeze({
    decisionId: 'D5',
    status: 'pending',
    question: '跨日或跨工具成績能否拼成達標',
  }),
  Object.freeze({
    decisionId: 'D6',
    status: 'pending',
    question: '缺考與缺等級是否留在分母當未達標',
  }),
  Object.freeze({
    decisionId: 'D7',
    status: 'pending',
    question: '主任的監測、正式成果與研究各看哪些指標',
  }),
  Object.freeze({
    decisionId: 'D8',
    status: 'pending',
    question: '成長是否必須有可比的前後測',
  }),
  Object.freeze({
    decisionId: 'D9',
    status: 'pending',
    question: '歷史最佳是能力狀態還是學期成果',
  }),
  Object.freeze({
    decisionId: 'D10',
    status: 'pending',
    question: '以後是否另存原始 CEFR 加號',
  }),
  Object.freeze({
    decisionId: 'D11',
    status: 'pending',
    question: '培力成績表與 et 嘗試衝突時誰優先',
  }),
]);

const BY_ID = new Map(DECISION_GATES.map((row) => [row.decisionId, row]));

function listDecisionGates() {
  return DECISION_GATES.map((row) => ({ ...row }));
}

function getDecisionGate(decisionId) {
  return BY_ID.get(decisionId) || null;
}

module.exports = {
  DECISION_GATES,
  listDecisionGates,
  getDecisionGate,
};
