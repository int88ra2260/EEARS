/** 各 rule_code 動態表單欄位定義 */

export const RULE_FORM_FIELDS = {
  TUTOR_CONSULTATION: [
    { key: 'activityDate', label: '日期', type: 'date', required: true },
    { key: 'consultationType', label: '諮詢類型', type: 'select', required: true, options: ['英語口說諮詢', '英語討論會'], metaKey: 'consultationType' },
    { key: 'description', label: '備註', type: 'textarea' },
    { key: 'attachment', label: '證明附件', type: 'file', optional: true },
  ],
  ASSIGNED_TASK: [
    { key: 'activityDate', label: '日期', type: 'date', required: true },
    { key: 'bookTitle', label: '書籍名稱', type: 'text', required: true, metaKey: 'bookTitle' },
    { key: 'attachment', label: '學習單附件', type: 'file', required: true },
    { key: 'description', label: '備註', type: 'textarea' },
  ],
  SELF_STUDY_SOFTWARE: [
    { key: 'activityDate', label: '日期', type: 'date', required: true },
    { key: 'softwareType', label: '軟體類型', type: 'select', required: true, options: ['Live ABC', 'Live CNN'], metaKey: 'softwareType' },
    { key: 'roundNumber', label: '第幾回', type: 'text', required: true, metaKey: 'roundNumber' },
    { key: 'scoreOrPass', label: '分數或是否通過', type: 'text', required: true, metaKey: 'scoreOrPass' },
    { key: 'attachment', label: '證明附件', type: 'file', required: true },
    { key: 'description', label: '備註', type: 'textarea' },
  ],
  ENGLISH_COURSE: [
    { key: 'semester', label: '學期', type: 'text', required: true, metaKey: 'semester' },
    { key: 'courseName', label: '課程名稱', type: 'text', required: true, metaKey: 'courseName', titleKey: true },
    { key: 'grade', label: '成績', type: 'text', required: true, metaKey: 'grade' },
    { key: 'attachment', label: '成績單附件', type: 'file', required: true },
    { key: 'syllabusAttachment', label: '課程課綱附件', type: 'file', optional: true, metaKey: 'syllabusNote' },
    { key: 'description', label: '備註', type: 'textarea' },
  ],
  ENGLISH_COMPETITION: [
    { key: 'activityDate', label: '日期', type: 'date', required: true },
    { key: 'competitionName', label: '競賽名稱', type: 'text', required: true, metaKey: 'competitionName', titleKey: true },
    { key: 'wonAward', label: '是否得獎', type: 'select', required: true, options: [{ value: false, label: '否（20 點）' }, { value: true, label: '是（50 點）' }], metaKey: 'wonAward' },
    { key: 'attachment', label: '參賽證明附件', type: 'file', required: true },
    { key: 'awardAttachment', label: '獎狀附件', type: 'file', optional: true },
    { key: 'description', label: '備註', type: 'textarea' },
  ],
  EXTERNAL_EXAM: [
    { key: 'examType', label: '考試類別', type: 'select', required: true, metaKey: 'examType', options: ['TOEIC_LR', 'GEPT', 'TOEFL_IBT', 'TOEFL_PBT', 'TOEIC_SW', 'TOEIC_SPEAKING', 'IELTS'] },
    { key: 'score', label: '分數或級別', type: 'text', required: true, metaKey: 'score' },
    { key: 'examDate', label: '考試日期', type: 'date', required: true, metaKey: 'examDate' },
    { key: 'attachment', label: '成績單附件', type: 'file', required: true },
    { key: 'description', label: '備註', type: 'textarea' },
  ],
  SELF_LEARNING_ACTIVITY: [
    { key: 'activityDate', label: '日期', type: 'date', required: true },
    { key: 'activityName', label: '活動名稱', type: 'text', required: true, metaKey: 'activityName', titleKey: true },
    { key: 'activityType', label: '活動類型', type: 'select', required: true, metaKey: 'activityType', options: ['自學園', '西灣沙龍', '英語寫作工作坊'] },
    { key: 'attachment', label: '證明附件', type: 'file', optional: true },
    { key: 'description', label: '備註', type: 'textarea' },
  ],
  COLLEGE_ENGLISH_CORNER: [
    { key: 'activityDate', label: '日期', type: 'date', required: true },
    { key: 'college', label: '學院', type: 'text', required: true, metaKey: 'college' },
    { key: 'lectureName', label: '講座名稱', type: 'text', required: true, metaKey: 'lectureName', titleKey: true },
    { key: 'attachment', label: '學習單附件', type: 'file', required: true },
    { key: 'description', label: '備註', type: 'textarea' },
  ],
};

export const RULE_LIMIT_HINTS = {
  TUTOR_CONSULTATION: '每次 2 點 · 每週上限 20 點',
  ASSIGNED_TASK: '每次 2 點',
  SELF_STUDY_SOFTWARE: '每次 2 點 · 每週上限 20 點',
  ENGLISH_COURSE: '每門 60 點',
  ENGLISH_COMPETITION: '參賽 20 點 · 得獎 50 點',
  EXTERNAL_EXAM: '有效成績 20 點 · 達門檻 40 點 · 僅採計一次',
  SELF_LEARNING_ACTIVITY: '每次 5 點',
  COLLEGE_ENGLISH_CORNER: '每次 5 點 · 此類別最多 30 點',
};

export function buildSubmissionPayload(ruleCode, form) {
  const fields = RULE_FORM_FIELDS[ruleCode] || [];
  const metadataJson = {};
  let title = '';
  let activityDate = form.activityDate || null;
  let description = form.description || '';

  fields.forEach((f) => {
    if (f.type === 'file' || f.key === 'description' || f.key === 'activityDate') return;
    const val = form[f.key];
    if (f.metaKey) {
      let metaVal = val;
      if (f.key === 'wonAward') metaVal = val === true || val === 'true';
      metadataJson[f.metaKey] = metaVal;
    }
    if (f.titleKey && val) title = String(val);
  });

  if (ruleCode === 'EXTERNAL_EXAM' && form.examDate) {
    metadataJson.examDate = form.examDate;
    activityDate = form.examDate;
  }

  return { ruleCode, activityDate, title, description, metadataJson };
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * 送出前檢查必填欄位。草稿可不檢查附件。
 * @returns {string} 錯誤訊息；通過則為空字串
 */
export function validateRuleForm(ruleCode, form = {}, files = {}, options = {}) {
  if (!ruleCode) return '請選擇項目類型';
  const fields = RULE_FORM_FIELDS[ruleCode] || [];
  const hasExistingAttachments = Boolean(options.hasExistingAttachments);

  for (const field of fields) {
    if (!field.required) continue;
    if (field.type === 'file') {
      if (files[field.key] || hasExistingAttachments) continue;
      return `請上傳「${field.label}」`;
    }
    const value = form[field.key];
    if (isBlank(value)) {
      return `請填寫「${field.label}」`;
    }
  }
  return '';
}
