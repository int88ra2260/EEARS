/**
 * 前端載入時不再強制塞回預設階段（允許 CRUD 刪除／重排）。
 * 僅在 sections 完全為空時補預設殼層，避免空白編輯器。
 * 另補齊缺漏的步驟 0「報名須知」（舊 DB 可能沒有此階段）。
 */

const FALLBACK_SECTIONS = [
  { id: 'announcement', title: '報名須知', order: 0, navLabel: '步驟 0' },
  { id: 'privacy', title: '個資使用同意書', order: 1, navLabel: '步驟 1' },
  { id: 'verify', title: '身分驗證', order: 2, navLabel: '步驟 2' },
  { id: 'eligibility', title: '英語能力與培力資格相關', order: 3, navLabel: '步驟 3' },
  { id: 'contact', title: 'A. 基本聯絡資訊', order: 4, navLabel: '步驟 4 · A' },
  { id: 'academic', title: 'B. 身分與學籍資料', order: 5, navLabel: '步驟 4 · B' },
  { id: 'special', title: 'C. 特殊身分與協助需求', order: 6, navLabel: '步驟 4 · C' },
  { id: 'photo', title: 'D. 照片與同意事項', order: 7, navLabel: '步驟 4 · D' },
  { id: 'info', title: 'E. 資訊來源', order: 8, navLabel: '步驟 4 · E' },
  { id: 'custom', title: 'F. 其他題目', order: 9, navLabel: '其他' },
];

/** 與後端 englishTestFormDefaultSchema 步驟 0 預設題目對齊（僅在缺漏時補入） */
const FALLBACK_ANNOUNCEMENT_QUESTIONS = [
  {
    id: 'q_announcement_doc',
    fieldKey: 'announcementDoc',
    sectionId: 'announcement',
    order: 1,
    label: '培力英檢報名須知',
    type: 'content_block',
    required: false,
    system: true,
    helpText:
      '報名前請務必閱讀西灣學院官方公告。以下為本次報名重點摘要；完整規定、獎勵與注意事項以官方網頁為準。',
    visible: true,
    options: [],
    content: {
      intro:
        '報名前請務必閱讀西灣學院官方公告。以下為本次報名重點摘要；完整規定、獎勵與注意事項以官方網頁為準。',
      imageUrl: '',
      imageAlt: '',
      warning: '培力英檢名額有限，目前僅提供學校團體報名，請勿直接至 LTTC 官網個人報名。',
      officialUrl: 'https://siwan.nsysu.edu.tw/p/406-1029-381143,r5578.php?Lang=zh-tw',
      listItems: [
        '報名期間：115 年 9 月 7 日至 9 月 11 日 13:00（修通識英文或跨院 EAP/ESP 課程者，最長延至 9 月 11 日 19:00，請留意授課教師或中心 Email 通知）。',
        '考試時間：10 月 24 日（六）說寫測驗；11 月 21 日（六）聽讀測驗。請先保留整天，考前一週 LTTC 將寄送考試通知。',
        '報名對象：本校在學之本國籍大學部學生（不含研究生、僑外生、交換生、休學生及非本校學生）。若超出名額，依年級排序，大一生優先。',
        '報名與考試均免費；可選擇報考「聽讀」、「說寫」或「聽說讀寫四項全考」。',
        '報名時須上傳符合規格之證件照；報名完成後無法再抽換照片，成績電子證書上將印出考生照片。',
        '表單送出後，應在填寫的 Email 收到副本；若未收到請先查垃圾信件匣，並在期限內重新填寫。',
        '若聽讀或說寫其中一類已達 CEFR B2，報名時請上傳成績證明，即可只選考其他測驗項目。',
        '修通識英文或 EAP/ESP 課程者：出席 10/24 說寫、11/21 聽讀各佔出席成績 5%。',
        '四項成績均達 B2 以上可申請獎勵金（最高 5000 元）；聽讀或說寫達 B1+ 可視同通過大學部英語畢業門檻（須向全英中心申請認證）。',
        '疑問請洽全英語卓越教學中心 emicenter@mail.nsysu.edu.tw（建議優先寄信）。',
      ],
      images: [],
    },
  },
  {
    id: 'q_announcement_agree',
    fieldKey: 'agreedToAnnouncement',
    sectionId: 'announcement',
    order: 2,
    label:
      '我已閱讀上述重點摘要，並知悉完整公告內容（含報名資格、考試日期、截止時間、照片規定等重要事項）。',
    type: 'checkbox_confirm',
    required: true,
    system: true,
    helpText: '',
    visible: true,
    options: [],
    content: {},
  },
];

function schemaNeedsAnnouncementMerge(schema) {
  const sections = Array.isArray(schema?.sections) ? schema.sections : [];
  const questions = Array.isArray(schema?.questions) ? schema.questions : [];
  const hasSection = sections.some((s) => s.id === 'announcement');
  const keys = new Set(questions.map((q) => q.fieldKey));
  return !hasSection || !keys.has('announcementDoc') || !keys.has('agreedToAnnouncement');
}

function mergeMissingAnnouncementParts(schema) {
  const next = JSON.parse(JSON.stringify(schema || { sections: [], questions: [] }));
  if (!Array.isArray(next.sections)) next.sections = [];
  if (!Array.isArray(next.questions)) next.questions = [];

  const defaultSection = FALLBACK_SECTIONS.find((s) => s.id === 'announcement');
  if (defaultSection && !next.sections.some((s) => s.id === 'announcement')) {
    next.sections.push({ ...defaultSection });
  }

  const existingKeys = new Set(next.questions.map((q) => q.fieldKey));
  for (const question of FALLBACK_ANNOUNCEMENT_QUESTIONS) {
    if (!existingKeys.has(question.fieldKey)) {
      next.questions.push(JSON.parse(JSON.stringify(question)));
    }
  }

  next.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
  return next;
}

/**
 * @returns {{ schema: object, changed: boolean }}
 */
export function ensureEnglishTestFormSystemParts(schema) {
  const next = JSON.parse(JSON.stringify(schema || { title: '培力英檢報名表單', sections: [], questions: [] }));
  if (!Array.isArray(next.questions)) next.questions = [];
  let changed = false;

  if (!Array.isArray(next.sections) || next.sections.length === 0) {
    next.sections = FALLBACK_SECTIONS.map((s) => ({ ...s }));
    changed = true;
  }

  // 舊資料補上 navLabel（不覆寫已有值）
  for (const section of next.sections) {
    if (section.navLabel) continue;
    const fallback = FALLBACK_SECTIONS.find((s) => s.id === section.id);
    if (fallback?.navLabel) {
      section.navLabel = fallback.navLabel;
      changed = true;
    }
  }

  if (schemaNeedsAnnouncementMerge(next)) {
    const merged = mergeMissingAnnouncementParts(next);
    Object.assign(next, merged);
    changed = true;
  }

  next.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
  return { schema: next, changed };
}
