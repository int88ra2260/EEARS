'use strict';

const PASSPORT_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
  COMPLETED: 'completed',
});

const CERTIFICATION_STATUS = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const SUBMISSION_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

const RULE_CODES = Object.freeze({
  TUTOR_CONSULTATION: 'TUTOR_CONSULTATION',
  ASSIGNED_TASK: 'ASSIGNED_TASK',
  SELF_STUDY_SOFTWARE: 'SELF_STUDY_SOFTWARE',
  ENGLISH_COURSE: 'ENGLISH_COURSE',
  ENGLISH_COMPETITION: 'ENGLISH_COMPETITION',
  EXTERNAL_EXAM: 'EXTERNAL_EXAM',
  SELF_LEARNING_ACTIVITY: 'SELF_LEARNING_ACTIVITY',
  COLLEGE_ENGLISH_CORNER: 'COLLEGE_ENGLISH_CORNER',
});

const CERTIFICATION_THRESHOLD = 100;

/** 校外英檢達學校英語能力標準（可直接標示通過，不一定走 100 點） */
const DIRECT_PASS_EXAM_THRESHOLDS = Object.freeze([
  { examType: 'TOEIC_LR', minScore: 600, label: '多益聽讀 600 分以上' },
  { examType: 'GEPT', minLevel: '中級初試', label: '全民英檢中級初試以上' },
  { examType: 'TOEFL_IBT', minScore: 42, label: '托福 iBT 42 分以上' },
  { examType: 'IELTS', minScore: 5.5, label: 'IELTS 5.5 以上' },
]);

/** 校外英檢加碼門檻（40 點） */
const EXTERNAL_EXAM_BONUS_THRESHOLDS = Object.freeze([
  { examType: 'TOEIC_LR', minScore: 550 },
  { examType: 'GEPT', minLevel: '中級初試' },
  { examType: 'TOEFL_IBT', minScore: 42 },
  { examType: 'TOEFL_PBT', minScore: 460 },
  { examType: 'TOEIC_SW', minScore: 240 },
  { examType: 'TOEIC_SPEAKING', minScore: 120 },
  { examType: 'IELTS', minScore: 4 },
]);

module.exports = {
  PASSPORT_STATUS,
  CERTIFICATION_STATUS,
  SUBMISSION_STATUS,
  RULE_CODES,
  CERTIFICATION_THRESHOLD,
  DIRECT_PASS_EXAM_THRESHOLDS,
  EXTERNAL_EXAM_BONUS_THRESHOLDS,
};
