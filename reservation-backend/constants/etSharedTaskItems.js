'use strict';

/**
 * English Table 現場任務。全員同一套，不依能力帶換題。
 * 完成率以已簽到學生的全部啟用題計算；核薪只看 isRequired。
 */
const ET_SHARED_TASK_ITEMS = Object.freeze([
  {
    code: 'SAY',
    label: '用英語說明自己或本題',
    description: '展能 A1。必選，核薪只看這一題。',
    bandScope: 'ALL',
    sortOrder: 10,
    isRequired: true,
  },
  {
    code: 'LINK',
    label: '連到自己的學習、專業或研究',
    description: '展能 A2、C1、D1。',
    bandScope: 'ALL',
    sortOrder: 20,
    isRequired: false,
  },
  {
    code: 'WORD',
    label: '用到至少 1 個主題或專業詞',
    description: '展能 A3、B3、C2、D3。',
    bandScope: 'ALL',
    sortOrder: 30,
    isRequired: false,
  },
  {
    code: 'POINT',
    label: '說出看法，並給理由或例子',
    description: '展能 B1、B2、C3。',
    bandScope: 'ALL',
    sortOrder: 40,
    isRequired: false,
  },
  {
    code: 'REPLY',
    label: '被問到時用英語回應',
    description: '展能 A5、B5、C5、D5。',
    bandScope: 'ALL',
    sortOrder: 50,
    isRequired: false,
  },
]);

const ET_LEGACY_TASK_CODES = Object.freeze([
  'ATTEND',
  'PARTICIPATE',
  'PEER',
  'A2_VOCAB',
  'A2_SENT',
  'B1_REASON',
  'B1_FOLLOW',
  'B2_STANCE',
  'B2_REBUT',
]);

module.exports = {
  ET_SHARED_TASK_ITEMS,
  ET_LEGACY_TASK_CODES,
};
