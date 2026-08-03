/**
 * Event 域相關的內容／結構設定（不含實際文案，文案仍由 translations.js 管理）
 * - 活動介紹 Tab 列表
 * - 規則與通知區塊設定
 * - 問卷通知 banner 設定
 */

import { ACTIVITY_TAB_ITEMS } from './activityCatalog';

// 活動介紹：Tab 列表（ActivityTypeTabs 使用；順序由元件內 session 洗牌）
export const ACTIVITY_TABS = ACTIVITY_TAB_ITEMS;

// FAQ 彈窗 Tab（EventFAQModal 使用）
export const FAQ_TABS = [
  { id: 'cancel', labelKey: 'faq.cancel' },
  { id: 'blacklist', labelKey: 'faq.blacklist' },
  { id: 'rules', labelKey: 'faq.rules' },
];

// 規則說明區塊設定（EventRulesNotice 使用）
export const RULES_NOTICES = [
  {
    id: 'no-stamp',
    variant: 'info',
    iconClass: 'fas fa-info-circle text-info',
    titleKey: 'home.ruleUpdate',
    textKey: 'home.ruleNoStamp',
  },
  {
    id: 'no-walkin',
    variant: 'warning',
    iconClass: 'fas fa-exclamation-triangle text-warning',
    titleKey: 'home.ruleUpdate',
    textKey: 'home.ruleNoWalkIn',
  },
];

// 問卷通知 banner 設定（EventAlertsBanner 使用）
export const SURVEY_ALERT_CONFIG = {
  iconClass: 'fas fa-bullhorn text-warning',
  titleKey: 'home.notice',
  prefixKey: 'home.noticeSurveyBefore',
  linkKey: 'home.noticeSurveyLink',
  suffixKey: 'home.noticeSurveyAfter',
  linkTo: '/survey/choice',
};

