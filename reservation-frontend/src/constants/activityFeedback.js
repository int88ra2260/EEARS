/** 與後端 constants/activityFeedbackSurvey.js 的 surveyKey 相同。 */
export const ACTIVITY_FEEDBACK_SURVEY_KEY = 'activity_website_feedback_115';
export const ACTIVITY_FEEDBACK_PATH = '/feedback/activities';

/**
 * 手機首頁 Header 下方的卡片。
 * 週報暫停時放意見調查；要恢復週報時改回 'weekly'。
 */
export const MOBILE_HOME_TOP_SLOT = 'activity-feedback';

export const ACTIVITY_FEEDBACK_SUBMITTED_KEY = 'eears-activity-feedback-submitted';
export const ACTIVITY_FEEDBACK_DISMISS_KEY = 'eears-activity-feedback-banner-dismissed';

export function isActivityFeedbackBannerHidden() {
  try {
    if (localStorage.getItem(ACTIVITY_FEEDBACK_SUBMITTED_KEY) === '1') return true;
    if (sessionStorage.getItem(ACTIVITY_FEEDBACK_DISMISS_KEY) === '1') return true;
  } catch {
    return false;
  }
  return false;
}

export function markActivityFeedbackSubmitted() {
  try {
    localStorage.setItem(ACTIVITY_FEEDBACK_SUBMITTED_KEY, '1');
  } catch {
    // 儲存失敗仍視為這次已送出，只是下次還會看到入口。
  }
  try {
    window.dispatchEvent(new Event('eears:activity-feedback-submitted'));
  } catch {
    // ignore
  }
}
