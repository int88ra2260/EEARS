/**
 * 後台可編輯的學生端文案鍵（與後端 siteContentManifest 前綴規則對齊）
 */
import { EMI_ADMIN_STAFF, EMI_FACULTY } from '../data/emiCenterStaff';

export const SITE_CONTENT_SECTIONS = [
  { id: 'home', label: '首頁' },
  { id: 'english_test_registration', label: '英檢註冊比對訊息' },
  { id: 'english_learning_passport', label: '英語實踐歷程護照' },
  { id: 'activities', label: '活動介紹' },
  { id: 'about', label: '關於我們' },
  { id: 'contact', label: '聯絡我們' },
  { id: 'legal', label: '隱私權／使用條款' },
  { id: 'faq', label: '常見問題' },
  /** 舊 EventFAQModal 已下架；不顯示於後台分頁 */
  { id: 'rules_modal', label: '活動規定／FAQ 彈窗（已下架）', deprecated: true },
  { id: 'staff_faculty', label: '師資名單' },
  { id: 'staff_admin', label: '行政團隊' },
];

export const VISIBLE_SITE_CONTENT_SECTIONS = SITE_CONTENT_SECTIONS.filter((s) => !s.deprecated);

export const STRUCTURED_SECTIONS = ['faq', 'staff_faculty', 'staff_admin'];

export const FAQ_PAGE_TITLE_KEY = 'faq.title';

export const SITE_CONTENT_KEY_SUGGESTIONS = {
  home: [
    { key: 'homePage.heroEyebrow', label: 'Hero 副標' },
    { key: 'homePage.heroTitle', label: 'Hero 主標題' },
    { key: 'homePage.heroDesc', label: 'Hero 說明' },
    { key: 'homePage.heroServices', label: 'Hero 服務摘要' },
    { key: 'homePage.coreTasksTitle', label: '核心任務標題' },
    { key: 'homePage.coreTasksLead', label: '核心任務說明' },
    { key: 'homePage.activitiesTitle', label: '近期活動區塊標題' },
    { key: 'homePage.activitiesLead', label: '近期活動區塊說明' },
    { key: 'homePage.stepsTitle', label: '使用流程標題' },
    { key: 'homePage.announcementsTitle', label: '公告區塊標題' },
    { key: 'homePage.announcementsLead', label: '公告區塊說明' },
    { key: 'homePage.faqTitle', label: 'FAQ 區塊標題' },
    { key: 'home.noticeSurveyBefore', label: '問卷提醒（前段）' },
    { key: 'home.ruleNoStamp', label: '不補蓋章規定' },
    { key: 'home.ruleNoWalkIn', label: '不開放候補' },
  ],
  english_test_registration: [
    { key: 'englishTestRegistration.idCardMismatchMessage', label: '英檢：在學名單比對不符提示' },
  ],
  english_learning_passport: [
    { key: 'elpPage.heroTitle', label: '頁面主標題' },
    { key: 'elpPage.heroDesc', label: '頁面導言' },
    { key: 'elpPage.guideKicker', label: '指南小標' },
    { key: 'elpPage.guideTitle', label: '指南標題' },
    { key: 'elpPage.guideDesc', label: '指南說明' },
    { key: 'elpPage.guideOpenLarge', label: '開啟大圖按鈕' },
    { key: 'elpPage.guideImageUrl', label: '指南圖片網址（空白＝系統預設圖）' },
    { key: 'elpPage.guideImageAlt', label: '指南圖片替代文字' },
    { key: 'elpPage.identifyTitle', label: '身分驗證標題' },
    { key: 'elpPage.identifySubmit', label: '進入護照按鈕' },
    { key: 'elpPage.emailHint', label: 'Email 欄位提示' },
    { key: 'elpPage.applyLead', label: '尚未申請時的說明' },
    { key: 'elpPage.applyButton', label: '申請護照按鈕' },
    { key: 'elpPage.completedMessage', label: '達標完成提示' },
    { key: 'elpPage.exportCertificate', label: '匯出認證單按鈕' },
    { key: 'elpPage.submitSectionTitle', label: '可提交項目標題' },
    { key: 'elpPage.submitAction', label: '提交紀錄按鈕' },
  ],
  activities: [
    { key: 'activitiesPage.title', label: '頁面標題' },
    { key: 'activitiesPage.overviewLead', label: '頁面導言' },
    { key: 'activitiesPage.catalogLead', label: '活動類型說明' },
    { key: 'activitiesPage.scheduleLead', label: '時間整理說明' },
    { key: 'activities.etDesc', label: 'English Table 簡介' },
    { key: 'activities.ecDesc', label: 'English Club 簡介' },
    { key: 'activities.ifDesc', label: 'International Forum 簡介' },
    { key: 'activities.jtDesc', label: 'Job Talk 簡介' },
    { key: 'page.activitiesLead', label: '活動總覽導言' },
  ],
  about: [
    { key: 'aboutPage.eearsIntro', label: 'EEARS 系統介紹' },
    { key: 'aboutPage.centerIntro', label: 'EMI 中心介紹' },
    { key: 'aboutPage.facultyLead', label: '師資區塊說明' },
    { key: 'aboutPage.adminLead', label: '行政團隊說明' },
  ],
  contact: [
    { key: 'homePage.contactTitle', label: '聯絡頁標題' },
    { key: 'homePage.contactLead', label: '聯絡頁導言' },
    { key: 'homePage.contactAddressValue', label: '地址' },
    { key: 'homePage.contactPhoneValue', label: '電話' },
    { key: 'homePage.contactEmailValue', label: 'Email' },
    { key: 'homePage.contactHoursValue', label: '服務時間' },
  ],
  legal: [
    { key: 'privacyPage.lastUpdated', label: '隱私權最後更新' },
    { key: 'privacyPage.intro', label: '隱私權前言' },
    { key: 'termsPage.lastUpdated', label: '使用條款最後更新' },
    { key: 'termsPage.intro', label: '使用條款前言' },
  ],
};

function mapStaffSeed(members) {
  return members.map((m) => ({
    slug: m.id,
    label: m.name.zh,
    nameZh: m.name.zh,
    nameEn: m.name.en,
    roleZh: m.role.zh,
    roleEn: m.role.en,
    email: m.email || null,
    extension: m.extension || null,
  }));
}

export const DEFAULT_STAFF_SEED = {
  staff_faculty: mapStaffSeed(EMI_FACULTY),
  staff_admin: mapStaffSeed(EMI_ADMIN_STAFF),
};

export const DEFAULT_FAQ_SEED = [
  {
    label: '如何預約活動',
    questionZh: '我要怎麼預約活動？',
    questionEn: 'How do I reserve an activity?',
    answerZh: '點選「立即預約活動」進入日曆頁，選擇開放預約中的場次，再依畫面填寫姓名、學號與信箱。送出後請確認系統提示與信箱通知，活動當天依公告時間到場。',
    answerEn: 'Click "Book an Activity" to open the calendar, choose an open session, then enter your name, student ID, and email. Confirm the on-screen message and email notification, and arrive on time.',
  },
  {
    label: '如何選擇活動類型',
    questionZh: '我還不確定要參加哪一種活動，該怎麼選？',
    questionEn: 'How do I choose the right activity type?',
    answerZh: '可以先到「活動介紹」查看各活動差異。想練課堂主題可選 English Table；想增加口說練習可選 English Club；想和國際學生交流可選 International Forum；想準備面試或職場英文可選 Job Talk。',
    answerEn: 'Visit Activities to compare formats. English Table for course topics, English Club for speaking practice, International Forum for cross-cultural exchange, and Job Talk for career English.',
  },
  {
    label: '取消預約',
    questionZh: '無法出席時可以取消預約嗎？',
    questionEn: 'Can I cancel if I cannot attend?',
    answerZh: '可以。請至少在活動開始前 2 小時，到「查詢／取消我的預約」輸入姓名、學號與信箱，找到該筆預約後取消。若未取消且未到場，會被記為違規。',
    answerEn: 'Yes. At least 2 hours before the session starts, go to My Reservations, enter your details, and cancel. No-shows without cancellation count as violations.',
  },
  {
    label: '問卷要求',
    questionZh: '為什麼有些活動需要先完成問卷？',
    questionEn: 'Why is a survey required for some activities?',
    answerZh: '部分 English Table 或 English Club 場次會要求先完成本學期問卷，中心會用問卷確認學生背景與活動需求。若系統提示需填問卷，請先完成後再回到日曆預約。',
    answerEn: 'Some English Table or English Club sessions require the semester survey first. Complete it when prompted, then return to book.',
  },
  {
    label: '額滿',
    questionZh: '活動額滿時還能預約嗎？',
    questionEn: 'What if a session is full?',
    answerZh: '額滿後無法再登記，系統不開放候補。請改選其他同類型場次，或留意最新公告與日曆是否新增場次。',
    answerEn: 'If a session is full, it cannot be booked. Waitlisting is not available. Please choose another session of the same type, or watch announcements and the calendar for new openings.',
  },
  {
    label: '違規紀錄',
    questionZh: '違規紀錄會怎麼計算？',
    questionEn: 'How are violations counted?',
    answerZh: '常見違規包含成功預約但未到場、遲到超過規定時間、活動中無故離席等。同一學期累積兩次違規會被列入黑名單兩週，期間無法預約活動。',
    answerEn: 'Violations include no-shows, late arrival beyond the allowed window, and leaving without permission. Two violations in one semester trigger a two-week booking blacklist.',
  },
  {
    label: '學習紀錄',
    questionZh: '參加活動後會有學習紀錄或證明嗎？',
    questionEn: 'Will I get learning records or certification?',
    answerZh: '活動完成後的紀錄會依中心規則處理。若要申請英語實踐歷程或能力認證，請到「英語實踐歷程護照」查看可申請項目、上傳資料與審核狀態。',
    answerEn: 'Records follow center policy after attendance. For English Learning Passport certification, check eligible items and submission status there.',
  },
  {
    label: '英檢與活動預約',
    questionZh: '培力英檢報名和活動預約是同一件事嗎？',
    questionEn: 'Is BESTEP registration the same as activity booking?',
    answerZh: '不是。活動預約主要用於 English Table、English Club、International Forum、Job Talk 等活動；培力英檢報名是另一個流程，請從「培力英檢報名」入口進入。',
    answerEn: 'No. Activity booking is for English Table, Club, Forum, and Job Talk. BESTEP registration is a separate flow from the BESTEP entry point.',
  },
  {
    label: '何時開始報名',
    questionZh: '各類活動什麼時候開始報名？',
    questionEn: 'When does booking open for each activity type?',
    answerZh: 'English Table 與自訂類型為活動日前一天 12:00；Job Talk 為開始前 7 天同一星期幾 12:00；English Club 為上週三 12:00；International Forum 為上週五 12:00。全部活動均於開始前 2 小時截止預約與取消。各場次實際時間以日曆顯示為準。',
    answerEn: 'English Table and custom types open at 12:00 noon the day before. Job Talk opens at 12:00 noon 7 days before on the same weekday. English Club opens at 12:00 noon the previous Wednesday. International Forum opens at 12:00 noon the previous Friday. Booking and cancellation close 2 hours before start for all types. The calendar shows the exact window for each session.',
  },
];
