/**
 * 前端載入時不再強制塞回預設階段（允許 CRUD 刪除／重排）。
 * 僅在 sections 完全為空時補預設殼層，避免空白編輯器。
 */

const FALLBACK_SECTIONS = [
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

  next.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
  return { schema: next, changed };
}
