/**
 * 修課說明預設內容（公開頁 fallback，形狀與 /api/page-content/course-guide 一致）
 *
 * Block types:
 * - paragraph { textZh, textEn, muted?, html? }
 * - heading { level: 3|4, textZh, textEn }
 * - list { style: 'ul'|'ol'|'tight', items: [{ textZh, textEn, href?, children? }] }
 * - callout { titleZh, titleEn, items: [{ textZh, textEn }] }
 * - figure { src, altZh, altEn, captionZh, captionEn }
 */

const LEVEL_CHANGE_ITEMS = [
  { textZh: '變更為中級：TOEIC 550', textEn: 'Change to Intermediate: TOEIC 550' },
  { textZh: '變更為中高級：TOEIC 600', textEn: 'Change to Upper-Intermediate: TOEIC 600' },
  { textZh: '變更為高級：TOEIC 700', textEn: 'Change to Advanced: TOEIC 700' },
];

const LEVEL_CHANGE_NOTE = {
  type: 'paragraph',
  textZh:
    '修課之後則無法變更分級；在學期間僅得變更分級一次。本申請原則上僅受理於每學期開學前至初選階段為止，逾期概不受理。',
  textEn:
    'Level cannot be changed after starting courses. Only one change is allowed during enrollment. Applications are accepted from before the semester starts until the preliminary course selection period.',
};

const LEVEL_CHANGE_HOWTO = {
  type: 'paragraph',
  textZh:
    '請攜帶「通識英語文課程分級變更學生申請表」及 2 年內多益成績單正本 + 影本至全英語卓越教學中心（圖資 10 樓西灣學院聯合辦公室）。',
  textEn:
    'Bring the placement-change application form and original + copy of a TOEIC score report within 2 years to the EMI Center (Library Building 10F).',
};

const WAIVER_STANDARD_785 = [
  { textZh: 'GEPT：中高級複試（含）以上', textEn: 'GEPT: High-Intermediate Stage 2 or above' },
  { textZh: 'TOEFL ITP：527 分（含）以上', textEn: 'TOEFL ITP: 527 or above' },
  { textZh: 'TOEFL iBT：71 分（含）以上', textEn: 'TOEFL iBT: 71 or above' },
  { textZh: 'TOEIC（聽力與閱讀）：785 分（含）以上', textEn: 'TOEIC L&R: 785 or above' },
  { textZh: 'TOEIC（口說與寫作）：310 分（含）以上', textEn: 'TOEIC S&W: 310 or above' },
  { textZh: 'IELTS：5.5 級（含）以上', textEn: 'IELTS: 5.5 or above' },
  { textZh: 'BESTEP：B2（含）以上', textEn: 'BESTEP: B2 or above' },
];

const WAIVER_DOCS = (yearLabelZh, yearLabelEn) => [
  {
    textZh: `「英語文課程」抵免學分申請表（${yearLabelZh}）`,
    textEn: `English course credit waiver application form (${yearLabelEn})`,
  },
  {
    textZh: '兩年內有效之測驗成績單正本（需達抵免標準）',
    textEn: 'Original score report within 2 years (meeting waiver standard)',
  },
  { textZh: '測驗成績單影本', textEn: 'Photocopy of the score report' },
];

const COURSE_GUIDE_DEFAULT = {
  pageTitleZh: '修課說明',
  pageTitleEn: 'Course Guide',
  pageLeadZh:
    '依西灣學院官方 graduation-threshold 內容整理：修課方式、抵免標準、英語能力標準認證、以及英語實踐歷程檔案點數計算。',
  pageLeadEn:
    'Organized from the official Siwan College graduation-threshold pages: coursework paths, waiver standards, proficiency certification, and the practice portfolio.',
  sections: [
    {
      sectionKey: 'course-rules',
      titleZh: '修課說明（依入學學年度）',
      titleEn: 'Course rules (by enrollment year)',
      introZh: '依入學學年度展開查看。圖表取自官方畢業門檻說明，可點圖放大檢視。',
      introEn: 'Expand by enrollment year. Diagrams come from official materials; click to enlarge.',
      sortOrder: 0,
      isActive: true,
      topics: [
        {
          topicKey: 'year-112-115',
          titleZh: '112-115 學年度入學生',
          titleEn: 'Students enrolled in AY 112-115',
          defaultOpen: true,
          sortOrder: 0,
          isActive: true,
          blocks: [
            {
              type: 'figure',
              src: '/images/course-guide/diagram-112-115.jpg',
              altZh: '112-115 學年度大學部學生英語能力培育與檢核機制',
              altEn: 'English cultivation & assessment mechanism for AY 112-115',
              captionZh: '112-115 學年度英語修課路徑與認證圖解',
              captionEn: 'AY 112-115 coursework path and certification diagram',
            },
            {
              type: 'paragraph',
              textZh:
                '入學後依英文分級，需修畢「語文素養：英語文」領域必修課程一門，以及一門學術英文 EAP（English for Academic Purposes）或專業英文 ESP（English for Specific Purposes）跨院選修課程，並通過本校「英語文能力標準認證」，方得畢業。',
              textEn:
                'After enrollment, students must complete one required General Education English course at their placement level, one cross-college EAP/ESP elective, and pass the university English proficiency certification to graduate.',
            },
            { type: 'heading', level: 4, textZh: '英語文分級', textEn: 'Placement levels' },
            {
              type: 'list',
              style: 'ul',
              items: [
                {
                  textZh: '一般入學生：依學測、指考等英語成績分為初級、中級、中高級、高級。',
                  textEn: 'Regular students: placed by entrance exam English scores into Beginner–Advanced.',
                },
                {
                  textZh: '轉學生：可依英檢成績申請分級變更，或申請分級變更考試；未辦理者自動分為初級。',
                  textEn:
                    'Transfer students may change level with a test score or placement test; otherwise default to Beginner.',
                },
              ],
            },
            { type: 'heading', level: 4, textZh: '各級修課方式', textEn: 'Course path by level' },
            {
              type: 'list',
              style: 'tight',
              items: [
                {
                  textZh: '初級：先修初級通識英文（0 學分）→ 中級通識英文 → 中高級 EAP/ESP',
                  textEn: 'Beginner: Beginner GE English (0) → Intermediate GE English → Upper-Int. EAP/ESP',
                },
                {
                  textZh: '中級：中級通識英文 → 中高級 EAP/ESP',
                  textEn: 'Intermediate: Intermediate GE English → Upper-Int. EAP/ESP',
                },
                {
                  textZh: '中高級：中高級通識英文 → 高級 EAP/ESP',
                  textEn: 'Upper-Intermediate: Upper-Int. GE English → Advanced EAP/ESP',
                },
                { textZh: '高級：高級 EAP/ESP', textEn: 'Advanced: Advanced EAP/ESP' },
              ],
            },
            {
              type: 'callout',
              titleZh: '注意事項（112-115）',
              titleEn: 'Notes (AY 112-115)',
              items: [
                {
                  textZh: '必須先修通識英文，並於不同學期逐級修課。',
                  textEn: 'Take GE English first; progress level by level across different semesters.',
                },
                {
                  textZh: '開始修課之前，每位同學只有 1 次變更分級機會。',
                  textEn: 'Only one placement change is allowed before starting courses.',
                },
              ],
            },
            { type: 'heading', level: 4, textZh: '變更分級（1 次）', textEn: 'Placement change (once)' },
            LEVEL_CHANGE_HOWTO,
            { type: 'list', style: 'tight', items: LEVEL_CHANGE_ITEMS },
            LEVEL_CHANGE_NOTE,
          ],
        },
        {
          topicKey: 'year-111',
          titleZh: '111 學年度入學生',
          titleEn: 'Students enrolled in AY 111',
          defaultOpen: false,
          sortOrder: 1,
          isActive: true,
          blocks: [
            {
              type: 'paragraph',
              textZh:
                '依英文分級，需修畢「語文素養：英語文」領域必修課程（對應級數）一門，以及一門學術英文 EAP 或專業英文 ESP 跨院選修課程，並通過本校「英語文能力標準認證」，方得畢業。',
              textEn:
                'Students must complete one required GE English course at their level, one cross-college EAP/ESP elective, and pass English proficiency certification to graduate.',
            },
            { type: 'heading', level: 4, textZh: '英語文分級與轉學生', textEn: 'Placement & transfer students' },
            {
              type: 'list',
              style: 'ul',
              items: [
                {
                  textZh: '一般入學生：依學測、指考等英語成績分為初級、中級、中高級、高級。',
                  textEn: 'Regular students: placed by entrance exam scores.',
                },
                {
                  textZh:
                    '轉學生：可依英檢成績單進行分級變更，或向中心申請參加分級變更考試；未辦理者自動分為初級。',
                  textEn:
                    'Transfer students may change level with a score report or placement test; otherwise default to Beginner.',
                },
              ],
            },
            { type: 'heading', level: 4, textZh: '各級修課方式', textEn: 'Course path by level' },
            {
              type: 'list',
              style: 'tight',
              items: [
                {
                  textZh: '初級：英文初級（0 學分）→ 中級 EAP/ESP 或英文中級 → 中高級 EAP/ESP 或英文中高級',
                  textEn: 'Beginner: Beginner English (0) → Intermediate EAP/ESP or Intermediate English → Upper-Int.',
                },
                {
                  textZh: '中級：中級 EAP/ESP 或英文中級 → 中高級英文或中高級 EAP/ESP',
                  textEn: 'Intermediate: Intermediate EAP/ESP or English → Upper-Intermediate',
                },
                {
                  textZh: '中高級：英文中高級或中高級 EAP/ESP → 高級 EAP/ESP',
                  textEn: 'Upper-Intermediate: Upper-Int. English or EAP/ESP → Advanced EAP/ESP',
                },
                { textZh: '高級：高級 EAP/ESP', textEn: 'Advanced: Advanced EAP/ESP' },
              ],
            },
            {
              type: 'callout',
              titleZh: '注意事項（111）',
              titleEn: 'Notes (AY 111)',
              items: [
                {
                  textZh:
                    '分到初級的同學，必須先修習英文初級，通過之後才能修習中級和中高級的 EAP/ESP 及通識英文課程。',
                  textEn: 'Beginner students must pass Beginner English before taking Intermediate/Upper-Int. courses.',
                },
              ],
            },
            { type: 'heading', level: 4, textZh: '變更分級（1 次）', textEn: 'Placement change (once)' },
            LEVEL_CHANGE_HOWTO,
            { type: 'list', style: 'tight', items: LEVEL_CHANGE_ITEMS },
            LEVEL_CHANGE_NOTE,
          ],
        },
        {
          topicKey: 'year-110',
          titleZh: '110 學年度入學生（含以前）',
          titleEn: 'Students enrolled in AY 110 and earlier',
          defaultOpen: false,
          sortOrder: 2,
          isActive: true,
          blocks: [
            {
              type: 'figure',
              src: '/images/course-guide/diagram-110.png',
              altZh: '110 學年度英語能力培育與檢核機制流程圖',
              altEn: 'AY 110 English cultivation & assessment mechanism',
              captionZh: '110 學年度大學部學生英語能力培育與檢核機制',
              captionEn: 'Undergraduate English mechanism for AY 110',
            },
            {
              type: 'paragraph',
              textZh:
                '入學後依英文分級，需修畢相應級數之「語文素養：英語文」領域必修課程，並通過本校「英語文能力標準認證」，方得畢業。',
              textEn:
                'Students must complete required GE English courses at their placement level and pass English proficiency certification to graduate.',
            },
            { type: 'heading', level: 4, textZh: '英語文分級', textEn: 'Placement levels' },
            {
              type: 'list',
              style: 'ul',
              items: [
                {
                  textZh: '一般入學生：依學測、指考等英語成績分為初級、中級、中高級、高級。',
                  textEn: 'Regular students: placed by entrance exam scores.',
                },
                {
                  textZh:
                    '轉學生（含繁星、特殊選材等非以學測、指考方式入學）：依開學第一週轉學生分級測驗結果分級；未參加者自動分為初級。',
                  textEn:
                    'Transfer / special-admission students take a placement test in week 1; no-shows default to Beginner.',
                },
              ],
            },
            { type: 'heading', level: 4, textZh: '各級修課方式', textEn: 'Course path by level' },
            {
              type: 'list',
              style: 'tight',
              items: [
                {
                  textZh: '初級：先修英文初級（0 學分）→ 英文中級 + 英文中高級',
                  textEn: 'Beginner: Beginner English (0) → Intermediate + Upper-Intermediate',
                },
                {
                  textZh: '中級：英文中級 + 英文中高級',
                  textEn: 'Intermediate: Intermediate + Upper-Intermediate',
                },
                {
                  textZh: '中高級：英文中高級 + 英文高級',
                  textEn: 'Upper-Intermediate: Upper-Intermediate + Advanced',
                },
                { textZh: '高級：英文高級', textEn: 'Advanced: Advanced English' },
              ],
            },
            {
              type: 'callout',
              titleZh: '注意事項（110）',
              titleEn: 'Notes (AY 110)',
              items: [
                {
                  textZh: '分到初級的同學，必須先修習英文初級，通過之後才能修習其他相對應級別。',
                  textEn: 'Beginner students must pass Beginner English before taking other levels.',
                },
              ],
            },
            { type: 'heading', level: 4, textZh: '變更分級（1 次）', textEn: 'Placement change (once)' },
            LEVEL_CHANGE_HOWTO,
            { type: 'list', style: 'tight', items: LEVEL_CHANGE_ITEMS },
            LEVEL_CHANGE_NOTE,
          ],
        },
      ],
    },
    {
      sectionKey: 'credit-waiver',
      titleZh: '英語文測驗抵免課程資格',
      titleEn: 'Credit waiver by English tests',
      introZh:
        '以下抵免標準以官方 graduation-threshold/1/2 內容整理。外文系學生及非學士班之英語文修課／認證仍以各自規定為準。',
      introEn:
        'Waiver standards summarized from the official page. Foreign Languages majors and non-undergraduates follow their own rules.',
      sortOrder: 1,
      isActive: true,
      topics: [
        {
          topicKey: 'waiver-113',
          titleZh: '113 學年度入學生（抵免標準）',
          titleEn: 'AY 113 waiver standards',
          defaultOpen: true,
          sortOrder: 0,
          isActive: true,
          blocks: [
            { type: 'heading', level: 4, textZh: '抵免標準', textEn: 'Waiver standards' },
            { type: 'list', style: 'tight', items: WAIVER_STANDARD_785 },
            { type: 'heading', level: 4, textZh: '應備文件', textEn: 'Required documents' },
            {
              type: 'list',
              style: 'tight',
              items: WAIVER_DOCS('113 學年度起入學生適用', 'for AY 113 and after'),
            },
            { type: 'heading', level: 4, textZh: '抵免手續', textEn: 'How to apply' },
            {
              type: 'paragraph',
              textZh: '依每學期全英文卓越教學中心公告抵免時間，攜應備文件（共 3 張）至全英語卓越教學中心辦理。',
              textEn: 'Bring the 3 required documents during the EMI Center announced waiver window.',
            },
          ],
        },
        {
          topicKey: 'waiver-112',
          titleZh: '112 學年度入學生（抵免標準）',
          titleEn: 'AY 112 waiver standards',
          defaultOpen: false,
          sortOrder: 1,
          isActive: true,
          blocks: [
            { type: 'heading', level: 4, textZh: '抵免標準', textEn: 'Waiver standards' },
            { type: 'list', style: 'tight', items: WAIVER_STANDARD_785 },
            { type: 'heading', level: 4, textZh: '應備文件', textEn: 'Required documents' },
            {
              type: 'list',
              style: 'tight',
              items: WAIVER_DOCS('112 學年度起入學生適用', 'for AY 112 and after'),
            },
            { type: 'heading', level: 4, textZh: '抵免手續', textEn: 'How to apply' },
            {
              type: 'paragraph',
              textZh: '依每學期全英文卓越教學中心公告抵免時間，攜應備文件（共 3 張）至全英語卓越教學中心辦理。',
              textEn: 'Bring the 3 required documents during the EMI Center announced waiver window.',
            },
          ],
        },
        {
          topicKey: 'waiver-111',
          titleZh: '111 學年度入學生（抵免標準）',
          titleEn: 'AY 111 waiver standards',
          defaultOpen: false,
          sortOrder: 2,
          isActive: true,
          blocks: [
            { type: 'heading', level: 4, textZh: '抵免範圍', textEn: 'Waiver scope' },
            {
              type: 'paragraph',
              textZh: '得抵免英語文課程學分，並包含跨院 EAP 或跨院 ESP 學分。',
              textEn: 'May waive GE English credits and cross-college EAP/ESP credits.',
            },
            { type: 'heading', level: 4, textZh: '抵免標準', textEn: 'Waiver standards' },
            { type: 'list', style: 'tight', items: WAIVER_STANDARD_785 },
            { type: 'heading', level: 4, textZh: '應備文件', textEn: 'Required documents' },
            {
              type: 'list',
              style: 'tight',
              items: WAIVER_DOCS('111 學年度入學生適用', 'for AY 111'),
            },
            { type: 'heading', level: 4, textZh: '抵免手續', textEn: 'How to apply' },
            {
              type: 'paragraph',
              textZh: '依每學期教務處公告抵免時間，攜應備文件（共 3 張）至全英語卓越教學中心辦理。',
              textEn: 'Bring the 3 required documents during the Office of Academic Affairs announced window.',
            },
          ],
        },
        {
          topicKey: 'waiver-110',
          titleZh: '110 學年度入學生（抵免標準）',
          titleEn: 'AY 110 waiver standards',
          defaultOpen: false,
          sortOrder: 3,
          isActive: true,
          blocks: [
            { type: 'heading', level: 4, textZh: '抵免範圍', textEn: 'Waiver scope' },
            {
              type: 'paragraph',
              textZh: '得抵免英語文課程學分，並包含跨院 EAP 或跨院 ESP 學分。',
              textEn: 'May waive GE English credits and cross-college EAP/ESP credits.',
            },
            { type: 'heading', level: 4, textZh: '抵免標準', textEn: 'Waiver standards' },
            { type: 'list', style: 'tight', items: WAIVER_STANDARD_785 },
            { type: 'heading', level: 4, textZh: '應備文件 / 抵免手續', textEn: 'Documents / process' },
            {
              type: 'list',
              style: 'tight',
              items: [
                {
                  textZh: '同樣需：抵免學分申請表、兩年內成績單正本與影本（共 3 張）。',
                  textEn: 'Same 3 documents: application form, original + copy of score report within 2 years.',
                },
                {
                  textZh: '依每學期教務處公告抵免時間至全英語卓越教學中心辦理。',
                  textEn: 'Apply at the EMI Center during the announced window.',
                },
              ],
            },
          ],
        },
        {
          topicKey: 'waiver-109',
          titleZh: '109 學年度入學生（抵免標準）',
          titleEn: 'AY 109 waiver standards',
          defaultOpen: false,
          sortOrder: 4,
          isActive: true,
          blocks: [
            { type: 'heading', level: 4, textZh: '抵免範圍', textEn: 'Waiver scope' },
            {
              type: 'paragraph',
              textZh: '得抵免英語文課程學分，並包含跨院 EAP 或跨院 ESP 學分。',
              textEn: 'May waive GE English credits and cross-college EAP/ESP credits.',
            },
            { type: 'heading', level: 4, textZh: '抵免標準', textEn: 'Waiver standards' },
            {
              type: 'list',
              style: 'tight',
              items: [
                { textZh: 'GEPT：中高級複試（含）以上', textEn: 'GEPT: High-Intermediate Stage 2 or above' },
                { textZh: 'TOEFL ITP：527 分（含）以上', textEn: 'TOEFL ITP: 527 or above' },
                { textZh: 'TOEFL iBT：71 分（含）以上', textEn: 'TOEFL iBT: 71 or above' },
                { textZh: 'TOEIC（聽力與閱讀）：750 分（含）以上', textEn: 'TOEIC L&R: 750 or above' },
                { textZh: 'TOEIC（口說與寫作）：300 分（含）以上', textEn: 'TOEIC S&W: 300 or above' },
                { textZh: 'IELTS：5.5 級（含）以上', textEn: 'IELTS: 5.5 or above' },
                { textZh: 'BESTEP：B2（含）以上', textEn: 'BESTEP: B2 or above' },
              ],
            },
            { type: 'heading', level: 4, textZh: '應備文件 / 抵免手續', textEn: 'Documents / process' },
            {
              type: 'list',
              style: 'tight',
              items: [
                {
                  textZh: '同樣需：抵免學分申請表、兩年內成績單正本與影本（共 3 張）。',
                  textEn: 'Same 3 documents: application form, original + copy of score report within 2 years.',
                },
                {
                  textZh: '依每學期教務處公告抵免時間至全英語卓越教學中心辦理。',
                  textEn: 'Apply at the EMI Center during the announced window.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      sectionKey: 'certification',
      titleZh: '英語能力標準認證',
      titleEn: 'English proficiency certification',
      introZh: null,
      introEn: null,
      sortOrder: 2,
      isActive: true,
      topics: [
        {
          topicKey: 'cert-main',
          titleZh: '認證說明與辦理方式',
          titleEn: 'Certification overview',
          defaultOpen: true,
          sortOrder: 0,
          isActive: true,
          blocks: [
            {
              type: 'paragraph',
              textZh:
                '100 學年度起入學之學士班學生：達到英語文能力標準所列之規定，需先至本系統登錄英文檢定成績與列印認證程序單完成認證作業，並檢附英文檢定成績單正本、影本與認證程序單至西灣學院全英語卓越教學中心（圖資 10 樓）辦理。',
              textEn:
                'From AY 100 onward, undergraduates who meet the standard must register scores, print the certification form, and submit original + copy of the score report with the form to the EMI Center (Library 10F).',
            },
            {
              type: 'paragraph',
              textZh:
                '以「實踐歷程檔案計畫」辦理認證：在表單中下拉選擇「檢定類別」，輸入所收集之點數（100 以上），並選擇申請當日；完成後，檢附認證程序單及「實踐歷程檔案護照」至全英語卓越教學中心（圖資 10 樓）辦理。',
              textEn:
                'For the practice portfolio path: select the portfolio category, enter points (≥100), choose the application date, then submit the form and passport to the EMI Center.',
            },
            {
              type: 'callout',
              titleZh: '辦理時間與提醒',
              titleEn: 'Office hours & tips',
              items: [
                {
                  textZh: '受理期間：每學期週一至週五 09:00-17:00（12:00-13:30 休息）。',
                  textEn: 'Accepted Mon–Fri 09:00–17:00 (closed 12:00–13:30) each semester.',
                },
                {
                  textZh: '學年期請選擇「申請當學年當學期」，不是英檢通過的那個學期。',
                  textEn: 'Select the semester of application, not the semester you passed the test.',
                },
              ],
            },
            {
              type: 'paragraph',
              muted: true,
              textZh: '系統入口與詳細認證方式請參考官方頁面（下方資料來源連結）。',
              textEn: 'See the official source links below for system entry and details.',
            },
          ],
        },
      ],
    },
    {
      sectionKey: 'practice-portfolio',
      titleZh: '英語實踐歷程檔案（100 點）',
      titleEn: 'English practice portfolio (100 points)',
      introZh: null,
      introEn: null,
      sortOrder: 3,
      isActive: true,
      topics: [
        {
          topicKey: 'portfolio-main',
          titleZh: '實施辦法與點數計算',
          titleEn: 'Rules & point calculation',
          defaultOpen: true,
          sortOrder: 0,
          isActive: true,
          blocks: [
            { type: 'heading', level: 3, textZh: '實施辦法', textEn: 'Implementation' },
            {
              type: 'paragraph',
              textZh:
                '參與「英語實踐歷程檔案」計畫之學生，於畢業前累計滿 100 點視同通過本校「英語文能力標準」。',
              textEn:
                'Students in the practice portfolio plan who collect 100 points before graduation are deemed to meet the English proficiency standard.',
            },
            {
              type: 'list',
              style: 'ul',
              items: [
                {
                  textZh: '申請日期：每學期開學後一個月（詳細時間將於學期初公告）。',
                  textEn: 'Application window: within one month after semester start (announced each term).',
                },
                {
                  textZh: '申請方式：報名開放期間填寫線上表單。',
                  textEn: 'Apply via the online form during the open period.',
                },
              ],
            },
            { type: 'heading', level: 3, textZh: '認證點數計算', textEn: 'Point calculation' },
            {
              type: 'list',
              style: 'ol',
              items: [
                {
                  textZh: '參加本校自學園之英語小老師諮詢：此項目目前暫停認證。',
                  textEn: 'Peer tutoring at the self-learning center: currently paused.',
                },
                {
                  textZh: '於全英中心選讀指定書籍、繳交學習單：一次可獲得 2 點，上限 12 點。',
                  textEn: 'Read a designated book and submit the worksheet: 2 points each, max 12.',
                },
                {
                  textZh: '英語自學軟體試卷（單項上限 20 點）。方式包含：',
                  textEn: 'Self-learning software quizzes (max 20 points), including:',
                  children: [
                    {
                      textZh: '紙本 Live CNN 試卷：完成一回得 2 點。',
                      textEn: 'Paper Live CNN quiz: 2 points per completed set.',
                    },
                    {
                      textZh: 'Live ABC 網站：完成指定考試並達通過標準，一回得 2 點。',
                      textEn: 'Live ABC site: 2 points per passed assigned test.',
                      href: 'http://140.117.214.42:8080/login/login_m.php',
                    },
                  ],
                },
                {
                  textZh:
                    '修讀本校以英語授課之講授類選修課程且成績及格：每門可獲得 60 點；此學分不得採計於學生應修畢業學分內。',
                  textEn:
                    'Pass an EMI lecture elective outside graduation credit requirements: 60 points per course.',
                },
                {
                  textZh: '參加校內外英語文相關競賽：憑參賽證明得 20 點；得獎者憑獎狀再加 30 點。',
                  textEn: 'English contests: 20 points for participation; +30 for awards.',
                },
                {
                  textZh:
                    '參加本校認可之校外英檢考試：繳交成績單得 20 點；若成績達多益 550 分以上，另加碼 20 點；只能採計一次。',
                  textEn:
                    'Recognized external English tests: 20 points; +20 if TOEIC ≥ 550. Counted once only.',
                },
                {
                  textZh: '參加全英中心舉辦之相關活動：單次得 5 點，最多 60 點。',
                  textEn: 'EMI Center activities: 5 points each, max 60.',
                },
                {
                  textZh: '參加各學院舉辦之英語學習角落（English Corner）活動：憑學院發放之證明每次得 5 點，上限 30 點。',
                  textEn: 'College English Corner: 5 points each with proof, max 30.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

module.exports = { COURSE_GUIDE_DEFAULT };
