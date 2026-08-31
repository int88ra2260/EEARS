/** 培力英檢個人報名流程 session 草稿（僅存於本瀏覽器分頁） */

export const ENGLISH_TEST_REGISTRATION_DRAFT_KEY = 'eears:english-test:registration-draft:v1';

export function hasEnglishTestRegistrationProgress({
  englishTestStep = 0,
  agreedToPrivacyPolicy = false,
  step3Data = null,
  englishTestForm = {},
} = {}) {
  if (step3Data) return true;
  if (englishTestStep >= 2) return true;
  if (agreedToPrivacyPolicy) return true;
  const { studentId, name, idNumber } = englishTestForm;
  return Boolean(
    String(studentId || '').trim()
    || String(name || '').trim()
    || String(idNumber || '').trim(),
  );
}

export function getEnglishTestLeaveConfirmDescription({
  englishTestForm = {},
  agreedToPrivacyPolicy = false,
  step3Data = null,
} = {}) {
  const hasForm = Boolean(
    String(englishTestForm.studentId || '').trim()
    || String(englishTestForm.name || '').trim()
    || String(englishTestForm.idNumber || '').trim(),
  );

  if (hasForm || step3Data) {
    return '您尚未完成報名，離開後已填寫的資料將不會保留（關閉分頁後草稿也會清除）。確定要離開嗎？';
  }
  if (agreedToPrivacyPolicy) {
    return '您已同意個資條款但尚未完成報名，離開後需重新勾選。確定要離開嗎？';
  }
  return '您尚未完成報名，確定要離開嗎？';
}

export function stripStep3DataForDraft(step3Data) {
  if (!step3Data || typeof step3Data !== 'object') return null;
  const { b2CertificateFiles, ...rest } = step3Data;
  return { ...rest, b2CertificateFiles: [] };
}

export function loadEnglishTestRegistrationDraft() {
  try {
    const raw = sessionStorage.getItem(ENGLISH_TEST_REGISTRATION_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveEnglishTestRegistrationDraft(draft) {
  try {
    sessionStorage.setItem(ENGLISH_TEST_REGISTRATION_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // private browsing / quota
  }
}

export function clearEnglishTestRegistrationDraft() {
  try {
    sessionStorage.removeItem(ENGLISH_TEST_REGISTRATION_DRAFT_KEY);
  } catch {
    // ignore
  }
}
