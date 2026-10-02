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
    { key: 'sessionCount', label: '本次完成回數', type: 'number', required: true, metaKey: 'sessionCount', min: 1, max: 100, placeholder: '例如 10' },
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
    { key: 'wonAward', label: '是否得獎', type: 'select', required: true, options: [{ value: false, label: '否' }, { value: true, label: '是' }], metaKey: 'wonAward' },
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
    {
      key: 'activityType',
      label: '活動類型',
      type: 'select',
      required: true,
      metaKey: 'activityType',
      options: [
        'English Table',
        'English Club',
        'International Forum',
        'Job Talk',
        '自學園',
        '西灣沙龍',
        '英語寫作工作坊',
        '其他',
      ],
    },
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
  SELF_STUDY_SOFTWARE: '每回 2 點，可一次申請多回 · 每週上限 20 點',
  ENGLISH_COURSE: '每門 60 點',
  ENGLISH_COMPETITION: '參賽 20 點 · 得獎 50 點',
  EXTERNAL_EXAM: '有效成績 20 點 · 達門檻 40 點 · 僅採計一次',
  SELF_LEARNING_ACTIVITY: '每次 5 點 · 最多 12 次共 60 點',
  COLLEGE_ENGLISH_CORNER: '每次 5 點 · 此類別最多 30 點',
};

function finitePoint(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 學生卡片說明。課程、競賽、英檢的點數跟後台規則走。 */
export function formatRuleLimitHint(rule) {
  if (!rule?.code) return '';
  const preset = RULE_LIMIT_HINTS[rule.code];
  if (rule.code === 'ENGLISH_COURSE') {
    return `每門 ${finitePoint(rule.basePoints, 60)} 點`;
  }
  if (rule.code === 'ENGLISH_COMPETITION') {
    return `參賽 ${finitePoint(rule.basePoints, 20)} 點 · 得獎 ${finitePoint(rule.bonusPoints, 50)} 點`;
  }
  if (rule.code === 'EXTERNAL_EXAM') {
    const once = rule.isOnceOnly === false ? '' : ' · 僅採計一次';
    return `有效成績 ${finitePoint(rule.basePoints, 20)} 點 · 達門檻 ${finitePoint(rule.bonusPoints, 40)} 點${once}`;
  }
  return preset || `基礎 ${rule.basePoints} 點`;
}

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
      if (f.type === 'number' && val !== '' && val != null) {
        const n = Number(val);
        metaVal = Number.isFinite(n) ? n : val;
      }
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
 * 附件是否必填以規則設定為準；規則未載入時沿用表單預設。
 */
export function resolveFormFields(ruleCode, rule) {
  const fields = RULE_FORM_FIELDS[ruleCode] || [];
  if (!rule) return fields;
  const requireFiles = !!rule.requiresAttachment;
  return fields.map((field) => {
    if (field.type === 'file') {
      if (!requireFiles) return { ...field, required: false, optional: true };
      if (field.optional) return field;
      return { ...field, required: true };
    }
    if (field.key === 'wonAward') {
      const base = finitePoint(rule.basePoints, 20);
      const bonus = finitePoint(rule.bonusPoints, 50);
      return {
        ...field,
        options: [
          { value: false, label: `否（${base} 點）` },
          { value: true, label: `是（${bonus} 點）` },
        ],
      };
    }
    if (field.key === 'sessionCount' && rule.maxPointsPerWeek != null) {
      const base = Number(rule.basePoints) > 0 ? Number(rule.basePoints) : 2;
      const weeklyMax = Math.max(1, Math.floor(Number(rule.maxPointsPerWeek) / base));
      return { ...field, max: Math.min(field.max || 100, weeklyMax) };
    }
    return field;
  });
}

/**
 * 送出前檢查必填欄位。草稿可不檢查附件。
 * 規則 requiresAttachment 為 false 時，不因缺少附件擋下。
 * @returns {string} 錯誤訊息；通過則為空字串
 */
export function validateRuleForm(ruleCode, form = {}, files = {}, options = {}) {
  if (!ruleCode) return '請選擇項目類型';
  const fields = resolveFormFields(ruleCode, options.rule);
  const hasExistingAttachments = Boolean(options.hasExistingAttachments);

  for (const field of fields) {
    if (field.type === 'file') {
      if (!field.required) continue;
      if (files[field.key] || hasExistingAttachments) continue;
      return `請上傳「${field.label}」`;
    }
    if (!field.required) continue;
    const value = form[field.key];
    if (isBlank(value)) {
      return `請填寫「${field.label}」`;
    }
    if (field.type === 'number') {
      const n = Number(value);
      const min = field.min ?? 1;
      const max = field.max ?? 100;
      if (!Number.isInteger(n) || n < min || n > max) {
        return `「${field.label}」須為 ${min} 到 ${max} 的整數`;
      }
    }
  }
  return '';
}
