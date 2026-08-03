/**
 * 前端保險：若 API 回傳的 schema 缺步驟 1／2 等系統階段，於後台編輯器補上。
 * （後端應以 mergeMissingSystemParts + 讀取時寫回為準；此處避免只更新前端 build 時左側空白。）
 */

const REQUIRED_SECTIONS = [
  { id: 'privacy', title: '個資使用同意書', order: 1 },
  { id: 'verify', title: '身分驗證', order: 2 },
  { id: 'eligibility', title: '英語能力與培力資格相關', order: 3 },
  { id: 'contact', title: 'A. 基本聯絡資訊', order: 4 },
  { id: 'academic', title: 'B. 身分與學籍資料', order: 5 },
  { id: 'special', title: 'C. 特殊身分與協助需求', order: 6 },
  { id: 'photo', title: 'D. 照片與同意事項', order: 7 },
  { id: 'info', title: 'E. 資訊來源', order: 8 },
  { id: 'custom', title: 'F. 其他題目', order: 9 },
];

/** 僅補齊步驟 1／2 與證件照圖文／地址確認（其餘系統題仍以後端為準） */
const REQUIRED_SYSTEM_QUESTIONS = [
  {
    id: 'q_privacy_doc',
    fieldKey: 'privacyDoc',
    sectionId: 'privacy',
    order: 1,
    label: '個資使用同意書',
    type: 'content_block',
    required: false,
    system: true,
    helpText: '為配合政府個人資料保護法並確保考生的權益，請詳細閱讀下列個資使用同意書所載內容：',
    visible: true,
    options: [],
    content: {
      intro: '為配合政府個人資料保護法並確保考生的權益，請詳細閱讀下列個資使用同意書所載內容：',
      imageUrl: '/個資使用同意書.jpg',
      imageAlt: 'BESTEP培力英檢考生個資使用同意書',
      warning: '',
      listItems: [],
      images: [],
    },
  },
  {
    id: 'q_privacy_agree',
    fieldKey: 'agreedToPrivacyPolicy',
    sectionId: 'privacy',
    order: 2,
    label: '本人已確實審閱並同意以上「BESTEP培力英檢考生個資使用同意書」內容。',
    type: 'checkbox_confirm',
    required: true,
    system: true,
    helpText: '',
    visible: true,
    options: [],
    content: {},
  },
  {
    id: 'q_verify_studentId',
    fieldKey: 'studentId',
    sectionId: 'verify',
    order: 1,
    label: '學號',
    type: 'text',
    required: true,
    system: true,
    helpText: '請輸入學號（例如：B123456789）',
    visible: true,
    options: [],
    content: {},
  },
  {
    id: 'q_verify_name',
    fieldKey: 'name',
    sectionId: 'verify',
    order: 2,
    label: '姓名',
    type: 'text',
    required: true,
    system: true,
    helpText: '請輸入中文姓名',
    visible: true,
    options: [],
    content: {},
  },
  {
    id: 'q_verify_idNumber',
    fieldKey: 'idNumber',
    sectionId: 'verify',
    order: 3,
    label: '身分證字號',
    type: 'text',
    required: true,
    system: true,
    helpText: '請輸入身分證字號（例如：A123456789）',
    visible: true,
    options: [],
    content: {},
  },
  {
    id: 'q_addressConfirmed',
    fieldKey: 'addressConfirmed',
    sectionId: 'academic',
    order: 99,
    label:
      '培力官方可能以紙本寄送考試相關文件，請確認所填地址能夠接收「掛號」信件，若因填寫錯誤導致無法領取，本中心概不負責。',
    type: 'checkbox_confirm',
    required: true,
    system: true,
    helpText: '',
    visible: true,
    options: [],
    content: {},
  },
  {
    id: 'q_id_photo_guide',
    fieldKey: 'idPhotoGuide',
    sectionId: 'photo',
    order: 0,
    label: '📸 合格證件照規範：',
    type: 'content_block',
    required: false,
    system: true,
    helpText: '',
    visible: true,
    options: [],
    content: {
      intro: '',
      imageUrl: '',
      imageAlt: '',
      warning:
        '本次考試可免費下載電子證書， 證書上將印出考生照片。由於報名完成後無法再抽換照片，請上傳符合證件規格、正面清晰、背景乾淨之照片，避免未來遺憾。',
      listItems: [
        '應為6個月內所拍攝之正面、脫帽、露耳、五官清晰、白色或淺色背景之彩色證件照片。',
        '臉部需佔照片面積之70%~80%，頭部或頭髮不能碰觸到照片邊框（女性長髮碰到邊框下緣情形例外）。',
        '眼睛正視相機鏡頭拍攝，兩眼必須張開且清晰可見，表情自然不誇張，且不能有紅眼。',
        '如配戴眼鏡，眼睛需清楚呈現，不得配戴深色鏡片眼鏡，不能有閃光反射在眼睛上，鏡框不得遮蓋眼睛任何一部分。',
        '不得使用合成或修改之照片，亦不可使用生活照修剪。',
        '考生上傳照片，將於一週內審核，如所上傳照片不符規定將以e-mail通知，請於通知日後三日內修正重傳；未於期限內修正者，皆以照片不符報考規定處理，恕無法受理報名。',
        '完成上傳照片，經審核通過，不得更換。',
        '務必上傳考生本人之照片，若測驗當日核對與上傳照片無法確認為本人，測驗結束後得要求考生再接受查驗。',
      ],
      images: [
        {
          url: '/正確證件照範例.png',
          alt: '合格證件照範例',
          caption: '✅ 合格範例',
          variant: 'success',
        },
        {
          url: '/不合格證件照範例.jpg',
          alt: '不合格證件照範例',
          caption: '❌ 不合格範例',
          variant: 'danger',
        },
      ],
    },
  },
];

/**
 * @returns {{ schema: object, changed: boolean }}
 */
export function ensureEnglishTestFormSystemParts(schema) {
  const next = JSON.parse(JSON.stringify(schema || { title: '培力英檢報名表單', sections: [], questions: [] }));
  if (!Array.isArray(next.sections)) next.sections = [];
  if (!Array.isArray(next.questions)) next.questions = [];

  let changed = false;
  const sectionIds = new Set(next.sections.map((s) => s.id));
  for (const section of REQUIRED_SECTIONS) {
    if (!sectionIds.has(section.id)) {
      next.sections.push({ ...section });
      sectionIds.add(section.id);
      changed = true;
    }
  }
  const defaultSectionOrder = new Map(REQUIRED_SECTIONS.map((s) => [s.id, s.order]));
  for (const section of next.sections) {
    if (defaultSectionOrder.has(section.id) && section.order !== defaultSectionOrder.get(section.id)) {
      section.order = defaultSectionOrder.get(section.id);
      changed = true;
    }
  }
  next.sections.sort((a, b) => (a.order || 0) - (b.order || 0));

  const fieldKeys = new Set(next.questions.map((q) => q.fieldKey));
  const qIds = new Set(next.questions.map((q) => q.id));
  for (const q of REQUIRED_SYSTEM_QUESTIONS) {
    if (fieldKeys.has(q.fieldKey) || qIds.has(q.id)) continue;
    next.questions.push(JSON.parse(JSON.stringify(q)));
    fieldKeys.add(q.fieldKey);
    qIds.add(q.id);
    changed = true;
  }

  return { schema: next, changed };
}
