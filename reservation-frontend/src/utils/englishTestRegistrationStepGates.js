/**
 * 培力英檢公開報名：依必填勾選計算目前可前進到的最大步驟（0-based）。
 * 與報名須知／個資同意步驟的「下一步」啟用條件對齊。
 */

function isAgreementCheckboxRequired(question, { fallback = true } = {}) {
  if (!question) return fallback;
  if (question.visible === false) return false;
  if (question.required === undefined || question.required === null) return fallback;
  return Boolean(question.required);
}

export function getEnglishTestAgreementGateMaxStep({
  schema = null,
  agreedToAnnouncement = false,
  agreedToPrivacyPolicy = false,
} = {}) {
  const questions = Array.isArray(schema?.questions) ? schema.questions : [];
  const announcementQ = questions.find((q) => q.fieldKey === 'agreedToAnnouncement');
  const privacyQ = questions.find((q) => q.fieldKey === 'agreedToPrivacyPolicy');

  if (isAgreementCheckboxRequired(announcementQ) && !agreedToAnnouncement) {
    return 0;
  }
  if (isAgreementCheckboxRequired(privacyQ) && !agreedToPrivacyPolicy) {
    return 1;
  }
  return 4;
}

export function getEnglishTestNavigableMaxStep({
  maxReachedStep = 0,
  schema = null,
  agreedToAnnouncement = false,
  agreedToPrivacyPolicy = false,
  registrationEnabled = true,
  hasStep3Data = false,
} = {}) {
  const agreementMax = getEnglishTestAgreementGateMaxStep({
    schema,
    agreedToAnnouncement,
    agreedToPrivacyPolicy,
  });

  let navigable = Math.min(Math.max(0, maxReachedStep), agreementMax);

  if (!registrationEnabled) {
    navigable = Math.min(navigable, 2);
  }

  if (!hasStep3Data) {
    navigable = Math.min(navigable, 3);
  }

  return navigable;
}

export function getEnglishTestStepGateBlockMessage({
  targetStep,
  schema = null,
  agreedToAnnouncement = false,
  agreedToPrivacyPolicy = false,
  registrationEnabled = true,
  hasStep3Data = false,
  maxReachedStep = 0,
} = {}) {
  if (typeof targetStep !== 'number' || targetStep < 0 || targetStep > 4) {
    return null;
  }

  const agreementMax = getEnglishTestAgreementGateMaxStep({
    schema,
    agreedToAnnouncement,
    agreedToPrivacyPolicy,
  });

  if (targetStep > agreementMax) {
    if (agreementMax < 1) {
      return { tone: 'warning', message: '請先勾選已閱讀報名須知後才能繼續' };
    }
    return { tone: 'warning', message: '請先勾選同意個資使用同意書後才能繼續' };
  }

  if (!registrationEnabled && targetStep >= 3) {
    return {
      tone: 'warning',
      message: '報名時間已截止，無法進入後續報名步驟（可使用「檢視與修正」）。',
    };
  }

  if (targetStep >= 4 && !hasStep3Data) {
    return { tone: 'warning', message: '請先完成「考試項目」後再進入填寫資料' };
  }

  if (targetStep > maxReachedStep) {
    return { tone: 'info', message: '請依序完成前面步驟後再繼續' };
  }

  return null;
}
