const { Op } = require('sequelize');
const {
  LearningResourceSite,
  LearningResourceMiniGame,
  LearningResourceGuide,
  RegulationsFormsGroup,
  RegulationsFormsItem,
  ScrollWorldTestSegment,
} = require('../models');

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v == null) return undefined;
  const s = String(v).toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  return undefined;
}

function parseSecondaryCtasJson(maybeJson) {
  if (!maybeJson) return [];
  try {
    const parsed = typeof maybeJson === 'string' ? JSON.parse(maybeJson) : maybeJson;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        labelZh: trimOrNull(x.labelZh),
        labelEn: trimOrNull(x.labelEn),
        href: trimOrNull(x.href),
        isExternal: !!x.isExternal,
      }))
      .filter((x) => !!x.href && (!!x.labelZh || !!x.labelEn));
  } catch {
    return [];
  }
}

function serializeLearningResourceSite(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    titleZh: plain.titleZh,
    titleEn: plain.titleEn,
    introZh: plain.introZh,
    introEn: plain.introEn,
    tag: plain.tag,
    href: plain.href,
    titleKey: plain.titleKey,
    introKey: plain.introKey,
    tagKey: plain.tagKey,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    updatedAt: plain.updatedAt,
  };
}

function serializeLearningResourceMiniGame(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    titleZh: plain.titleZh,
    titleEn: plain.titleEn,
    introZh: plain.introZh,
    introEn: plain.introEn,
    tag: plain.tag,
    href: plain.href,
    isExternal: plain.isExternal,
    titleKey: plain.titleKey,
    introKey: plain.introKey,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    updatedAt: plain.updatedAt,
  };
}

function serializeLearningResourceGuide(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    titleZh: plain.titleZh,
    titleEn: plain.titleEn,
    introZh: plain.introZh,
    introEn: plain.introEn,
    tag: plain.tag,
    href: plain.href,
    isExternal: plain.isExternal,
    titleKey: plain.titleKey,
    introKey: plain.introKey,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    updatedAt: plain.updatedAt,
  };
}

function serializeRegulationsGroup(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    titleZh: plain.titleZh,
    titleEn: plain.titleEn,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    updatedAt: plain.updatedAt,
  };
}

function serializeRegulationsItem(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    groupId: plain.groupId,
    titleZh: plain.titleZh,
    titleEn: plain.titleEn,
    fileUrl: plain.fileUrl,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    updatedAt: plain.updatedAt,
  };
}

function serializeScrollWorldSegment(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    sectionId: plain.sectionId,
    labelZh: plain.labelZh,
    labelEn: plain.labelEn,
    titleZh: plain.titleZh,
    titleEn: plain.titleEn,
    bodyZh: plain.bodyZh,
    bodyEn: plain.bodyEn,
    primaryCtaLabelZh: plain.primaryCtaLabelZh,
    primaryCtaLabelEn: plain.primaryCtaLabelEn,
    primaryCtaHref: plain.primaryCtaHref,
    primaryCtaIsExternal: plain.primaryCtaIsExternal,
    secondaryCtas: parseSecondaryCtasJson(plain.secondaryCtasJson),
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    updatedAt: plain.updatedAt,
  };
}

async function ensureLearningResourcesDefaults() {
  // LearningResourceSites
  const sitesCount = await LearningResourceSite.count();
  if (sitesCount === 0) {
    await LearningResourceSite.bulkCreate([
      {
        titleZh: 'Live ABC',
        titleEn: 'Live ABC',
        introZh: null,
        introEn: null,
        tag: null,
        href: 'https://lpc.liveabc.com/flhs/login/login.php',
        titleKey: null,
        introKey: 'learningResourcesPage.sitesCardLead',
        tagKey: 'learningResourcesPage.sitesTag',
        sortOrder: 0,
        isActive: true,
      },
      {
        titleZh: 'EasyTest',
        titleEn: 'EasyTest',
        introZh: null,
        introEn: null,
        tag: null,
        href: 'https://easytest.nsysu.edu.tw/',
        titleKey: null,
        introKey: 'learningResourcesPage.sitesCardLead',
        tagKey: 'learningResourcesPage.sitesTag',
        sortOrder: 1,
        isActive: true,
      },
      {
        titleZh: 'WalkingLibrary',
        titleEn: 'WalkingLibrary',
        introZh: null,
        introEn: null,
        tag: null,
        href: 'https://nsysu.primo.exlibrisgroup.com/view/action/uresolver.do?operation=resolveService&package_service_id=6285981510007977&institutionId=7977&customerId=7975&VE=true',
        titleKey: null,
        introKey: 'learningResourcesPage.sitesCardLead',
        tagKey: 'learningResourcesPage.sitesTag',
        sortOrder: 2,
        isActive: true,
      },
      {
        titleZh: 'Cool English',
        titleEn: 'Cool English',
        introZh: null,
        introEn: null,
        tag: null,
        href: 'https://www.coolenglish.edu.tw/',
        titleKey: null,
        introKey: 'learningResourcesPage.sitesCardLead',
        tagKey: 'learningResourcesPage.sitesTag',
        sortOrder: 3,
        isActive: true,
      },
      {
        titleZh: '英語文說寫能力檢測平台 (TEEMI)',
        titleEn: '英語文說寫能力檢測平台 (TEEMI)',
        introZh: null,
        introEn: null,
        tag: null,
        href: 'https://teemi.tw/',
        titleKey: null,
        introKey: 'learningResourcesPage.sitesCardLead',
        tagKey: 'learningResourcesPage.sitesTag',
        sortOrder: 4,
        isActive: true,
      },
    ]);
  }

  // LearningResourceMiniGames
  const miniGamesCount = await LearningResourceMiniGame.count();
  if (miniGamesCount === 0) {
    await LearningResourceMiniGame.bulkCreate([
      {
        titleZh: null,
        titleEn: null,
        introZh: null,
        introEn: null,
        tag: 'Vocabulary',
        href: '/activities/word-bridge',
        isExternal: false,
        titleKey: 'wordBridge.title',
        introKey: 'miniGames.wordBridgeIntro',
        sortOrder: 0,
        isActive: true,
      },
      {
        titleZh: null,
        titleEn: null,
        introZh: null,
        introEn: null,
        tag: 'Listening',
        href: '/activities/games/listening-ladder',
        isExternal: false,
        titleKey: 'listeningLadder.title',
        introKey: 'miniGames.listeningLadderIntro',
        sortOrder: 1,
        isActive: true,
      },
    ]);
  }

  // LearningResourceGuides
  const guidesCount = await LearningResourceGuide.count();
  if (guidesCount === 0) {
    await LearningResourceGuide.bulkCreate([
      {
        titleZh: null,
        titleEn: null,
        introZh: null,
        introEn: null,
        tag: 'Guide',
        href: '/guides/activity-phrasebook',
        isExternal: false,
        titleKey: 'phrasebook.title',
        introKey: 'phrasebook.catalogIntro',
        sortOrder: 0,
        isActive: true,
      },
    ]);
  }
}

async function ensureRegulationsFormsDefaults() {
  const groupsCount = await RegulationsFormsGroup.count();
  if (groupsCount > 0) return;

  const groups = [
    {
      idSeed: 'english-proficiency-zh',
      titleZh: '英語能力相關規範（中文）',
      titleEn: 'English Proficiency Regulations (ZH)',
      items: [
        { titleZh: '109 學年以前入學生適用', titleEn: 'Applicable to students enrolled in school year 109 and before', href: '/regulations-forms-files/english-proficiency-zh/01.pdf' },
        { titleZh: '110 學年度入學生適用', titleEn: 'Applicable to students enrolled in school year 110', href: '/regulations-forms-files/english-proficiency-zh/02.pdf' },
        { titleZh: '111 學年度入學生適用', titleEn: 'Applicable to students enrolled in school year 111', href: '/regulations-forms-files/english-proficiency-zh/03.pdf' },
        { titleZh: '112 學年度入學生適用', titleEn: 'Applicable to students enrolled in school year 112', href: '/regulations-forms-files/english-proficiency-zh/04.pdf' },
        { titleZh: '113 學年度起入學生適用', titleEn: 'Applicable to students enrolled in school year 113 and after', href: '/regulations-forms-files/english-proficiency-zh/05.pdf' },
      ],
    },
    {
      idSeed: 'english-proficiency-en',
      titleZh: 'Regulations for English Proficiency（英文版）',
      titleEn: 'Regulations for English Proficiency',
      items: [
        { titleZh: '109 學年以前入學生適用', titleEn: 'Applicable to students enrolled in school year 109 and before', href: '/regulations-forms-files/english-proficiency-en/01.pdf' },
        { titleZh: '110 學年度入學生適用', titleEn: 'Applicable to students enrolled in school year 110', href: '/regulations-forms-files/english-proficiency-en/02.pdf' },
        { titleZh: '111 學年度入學生適用', titleEn: 'Applicable to students enrolled in school year 111', href: '/regulations-forms-files/english-proficiency-en/03.pdf' },
        { titleZh: '112 學年度入學生適用', titleEn: 'Applicable to students enrolled in school year 112', href: '/regulations-forms-files/english-proficiency-en/04.pdf' },
        { titleZh: '113 學年度起入學生適用', titleEn: 'Applicable to students enrolled in school year 113 and after', href: '/regulations-forms-files/english-proficiency-en/05.pdf' },
      ],
    },
    {
      idSeed: 'english-certification-zh',
      titleZh: '英語能力檢定認定（中文）',
      titleEn: 'English Level Certification (ZH)',
      items: [
        { titleZh: '109 學年度入學生適用', titleEn: 'Applicable to students enrolled in school year 109', href: '/regulations-forms-files/english-certification-zh/01.pdf' },
        { titleZh: '110-112 學年度入學生適用', titleEn: 'Applicable to students enrolled in school year 110-112', href: '/regulations-forms-files/english-certification-zh/02.pdf' },
        { titleZh: '113 學年度起入學生適用', titleEn: 'Applicable to students enrolled in school year 113', href: '/regulations-forms-files/english-certification-zh/03.pdf' },
        { titleZh: '114 學年度起入學生適用', titleEn: 'Applicable to students enrolled in school year 114 and after', href: '/regulations-forms-files/english-certification-zh/04.pdf' },
        { titleZh: '學年度適用規範總覽', titleEn: 'Applicable school-year overview', href: '/regulations-forms-files/english-certification-zh/05.pdf' },
      ],
    },
    {
      idSeed: 'english-certification-en',
      titleZh: 'Regulations for English Level Certification（英文版）',
      titleEn: 'Regulations for English Level Certification',
      items: [
        { titleZh: '110-112 學年度入學生適用', titleEn: 'Applicable to students enrolled in school year 110-112', href: '/regulations-forms-files/english-certification-en/01.pdf' },
        { titleZh: '113 學年度起入學生適用', titleEn: 'Applicable to students enrolled in school year 113 and after', href: '/regulations-forms-files/english-certification-en/02.pdf' },
        { titleZh: '114 學年度起入學生適用', titleEn: 'Applicable to students enrolled in school year 114 and after', href: '/regulations-forms-files/english-certification-en/03.pdf' },
      ],
    },
    {
      idSeed: 'test-and-bestep-rewards',
      titleZh: '英檢與 BESTEP 獎勵',
      titleEn: 'English Test and BESTEP Rewards',
      items: [
        { titleZh: '培力英檢獎勵要點', titleEn: 'BESTEP reward regulations', href: '/regulations-forms-files/test-and-bestep-rewards/01.pdf' },
        { titleZh: '培力英檢獎勵申請表', titleEn: 'BESTEP reward application form', href: '/regulations-forms-files/test-and-bestep-rewards/02.pdf' },
        { titleZh: '英語檢定獎勵要點', titleEn: 'English test reward regulations', href: '/regulations-forms-files/test-and-bestep-rewards/03.pdf' },
        { titleZh: '英語檢定獎勵申請表', titleEn: 'English test reward application form', href: '/regulations-forms-files/test-and-bestep-rewards/04.pdf' },
      ],
    },
    {
      idSeed: 'form-download-zh',
      titleZh: '表單下載（中文）',
      titleEn: 'Form Download (ZH)',
      items: [
        { titleZh: '英語檢定獎勵申請表', titleEn: 'English test reward application form', href: '/regulations-forms-files/form-download-zh/01.pdf' },
        { titleZh: '學分抵免申請表（100-110 學年度入學生）', titleEn: 'Credit transfer application form (school year 100-110)', href: '/regulations-forms-files/form-download-zh/02.pdf' },
        { titleZh: '學分抵免申請表（111 學年度入學生）', titleEn: 'Credit transfer application form (school year 111)', href: '/regulations-forms-files/form-download-zh/03.pdf' },
        { titleZh: '學分抵免申請表（112 學年度起入學生）', titleEn: 'Credit transfer application form (school year 112 and after)', href: '/regulations-forms-files/form-download-zh/04.pdf' },
        { titleZh: '英語起始級別變更申請表', titleEn: 'Change English beginning level application form', href: '/regulations-forms-files/form-download-zh/05.pdf' },
      ],
    },
    {
      idSeed: 'form-download-en',
      titleZh: 'Form Download（英文版）',
      titleEn: 'Form Download (EN)',
      items: [
        { titleZh: 'Change English Beginning Level Application Form', titleEn: 'Change English Beginning Level Application Form', href: '/regulations-forms-files/form-download-en/01.pdf' },
        { titleZh: 'Credit Transfer Application Form（100-110）', titleEn: 'Credit Transfer Application Form (Applicable to students enrolled in school year 100 - 110)', href: '/regulations-forms-files/form-download-en/02.pdf' },
        { titleZh: 'Credit Transfer Application Form（111）', titleEn: 'Credit Transfer Application Form (Applicable to students enrolled in school year 111)', href: '/regulations-forms-files/form-download-en/03.pdf' },
        { titleZh: 'Credit Transfer Application Form（112 之後）', titleEn: 'Credit Transfer Application Form (Applicable to students enrolled in school year 112 and after)', href: '/regulations-forms-files/form-download-en/04.pdf' },
      ],
    },
  ];

  const createdGroups = [];
  for (let i = 0; i < groups.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const g = groups[i];
    const group = await RegulationsFormsGroup.create({
      titleZh: g.titleZh,
      titleEn: g.titleEn,
      sortOrder: i,
      isActive: true,
    });
    createdGroups.push(group);
  }

  for (let i = 0; i < groups.length; i++) {
    const group = createdGroups[i];
    const g = groups[i];
    const items = g.items.map((it, idx) => ({
      groupId: group.id,
      titleZh: it.titleZh,
      titleEn: it.titleEn,
      fileUrl: it.href,
      sortOrder: idx,
      isActive: true,
    }));
    // eslint-disable-next-line no-await-in-loop
    await RegulationsFormsItem.bulkCreate(items);
  }
}

async function ensureScrollWorldDefaults() {
  const count = await ScrollWorldTestSegment.count();
  if (count > 0) return;

  const segments = [
    {
      sectionId: 'events',
      labelZh: '活動',
      labelEn: 'Events',
      titleZh: '預約中心活動，從這裡開始',
      titleEn: 'Start with reservation center events',
      bodyZh: '想參加中心活動，可直接預約時段、查看活動介紹，或查詢自己的預約紀錄；需要寫作輔導也可前往寫作工坊。',
      bodyEn: 'Join our center events by reserving time slots, checking introductions, or reviewing your reservation history; writing assistance is available at the writing workshop.',
      primaryCtaLabelZh: '立即預約',
      primaryCtaLabelEn: 'Reserve now',
      primaryCtaHref: '/events',
      primaryCtaIsExternal: false,
      secondaryCtas: [
        { labelZh: '寫作工坊', labelEn: 'Writing Workshop', href: 'https://emicenter.siwan.nsysu.edu.tw/EWL/', isExternal: true },
        { labelZh: '活動介紹', labelEn: 'Activity Introduction', href: '/activities', isExternal: false },
        { labelZh: '查詢預約紀錄', labelEn: 'Check reservation records', href: '/my-reservations', isExternal: false },
      ],
      sortOrder: 0,
      isActive: true,
    },
    {
      sectionId: 'courses',
      labelZh: '修課',
      labelEn: 'Courses',
      titleZh: '選課與修課資訊一次找到',
      titleEn: 'Find all course & enrollment info',
      bodyZh: '查詢或加退選請使用學校選課系統；想了解英語相關修課安排與注意事項，可先閱讀修課說明。',
      bodyEn: 'Use the school registration system for queries, add/drop, and enrollment changes; review course instructions for English-related guidance.',
      primaryCtaLabelZh: null,
      primaryCtaLabelEn: null,
      primaryCtaHref: null,
      primaryCtaIsExternal: false,
      secondaryCtas: [
        { labelZh: '選課系統', labelEn: 'Course System', href: 'https://selcrs.nsysu.edu.tw/', isExternal: true },
        { labelZh: '修課說明', labelEn: 'Course Guide', href: '/course-guide', isExternal: false },
      ],
      sortOrder: 1,
      isActive: true,
    },
    {
      sectionId: 'learning',
      labelZh: '學習',
      labelEn: 'Learning',
      titleZh: '培力英檢與學習歷程',
      titleEn: 'English Enhancement Exams & Learning Journey',
      bodyZh: '報名培力英檢、累積實踐歷程檔案，並搭配學習資源持續精進英語能力——讓每一次練習都被看見。',
      bodyEn: 'Register for English Enhancement Exams, build your practical learning journey, and keep improving with learning resources—so every practice is recognized.',
      primaryCtaLabelZh: '培力報名',
      primaryCtaLabelEn: 'Apply for exams',
      primaryCtaHref: '/register/english-test',
      primaryCtaIsExternal: false,
      secondaryCtas: [
        { labelZh: '實踐歷程檔案', labelEn: 'Learning Passport', href: '/student/english-learning-passport', isExternal: false },
        { labelZh: '學習資源', labelEn: 'Learning Resources', href: '/learning-resources', isExternal: false },
      ],
      sortOrder: 2,
      isActive: true,
    },
    {
      sectionId: 'other',
      labelZh: '其他',
      labelEn: 'Other',
      titleZh: '認識中心，掌握公告與表單',
      titleEn: 'Learn the center, check announcements & forms',
      bodyZh: '想了解全英語卓越教學中心、查看最新公告，或下載法規與表單，都可從這裡進入。',
      bodyEn: 'Learn about EMI, browse the latest announcements, and download regulations & forms—everything starts here.',
      primaryCtaLabelZh: '關於我們',
      primaryCtaLabelEn: 'About us',
      primaryCtaHref: '/about',
      primaryCtaIsExternal: false,
      secondaryCtas: [
        { labelZh: '最新公告', labelEn: 'Latest News', href: '/announcements', isExternal: false },
        { labelZh: '法規表單', labelEn: 'Regulations & Forms', href: '/regulations-forms', isExternal: false },
      ],
      sortOrder: 3,
      isActive: true,
    },
  ];

  const rows = segments.map((s) => ({
    sectionId: s.sectionId,
    labelZh: s.labelZh,
    labelEn: s.labelEn,
    titleZh: s.titleZh,
    titleEn: s.titleEn,
    bodyZh: s.bodyZh,
    bodyEn: s.bodyEn,
    primaryCtaLabelZh: s.primaryCtaLabelZh,
    primaryCtaLabelEn: s.primaryCtaLabelEn,
    primaryCtaHref: s.primaryCtaHref,
    primaryCtaIsExternal: !!s.primaryCtaIsExternal,
    secondaryCtasJson: s.secondaryCtas && s.secondaryCtas.length ? JSON.stringify(s.secondaryCtas) : null,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
  }));

  await ScrollWorldTestSegment.bulkCreate(rows);
}

async function listLearningResources({ admin = false } = {}) {
  await ensureLearningResourcesDefaults();

  const where = admin ? {} : { isActive: true };
  const [sites, miniGames, guides] = await Promise.all([
    LearningResourceSite.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] }),
    LearningResourceMiniGame.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] }),
    LearningResourceGuide.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] }),
  ]);

  return {
    sites: sites.map(serializeLearningResourceSite),
    miniGames: miniGames.map(serializeLearningResourceMiniGame),
    guides: guides.map(serializeLearningResourceGuide),
  };
}

async function listRegulationsForms({ admin = false } = {}) {
  await ensureRegulationsFormsDefaults();

  const groupsWhere = admin ? {} : { isActive: true };
  const itemsWhere = admin ? {} : { isActive: true };

  const groups = await RegulationsFormsGroup.findAll({
    where: groupsWhere,
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });

  const groupIds = groups.map((g) => g.id);
  const items = groupIds.length
    ? await RegulationsFormsItem.findAll({
        where: { ...itemsWhere, groupId: { [Op.in]: groupIds } },
        order: [['groupId', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
      })
    : [];

  const byGroup = new Map();
  items.forEach((it) => {
    byGroup.set(it.groupId, [...(byGroup.get(it.groupId) || []), serializeRegulationsItem(it)]);
  });

  return {
    groups: groups.map((g) => ({
      ...serializeRegulationsGroup(g),
      items: byGroup.get(g.id) || [],
    })),
  };
}

async function listScrollWorldSegments({ admin = false } = {}) {
  await ensureScrollWorldDefaults();
  const where = admin ? {} : { isActive: true };
  const rows = await ScrollWorldTestSegment.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
  return rows.map(serializeScrollWorldSegment);
}

function modelForLearningKind(kind) {
  switch (kind) {
    case 'sites':
      return LearningResourceSite;
    case 'miniGames':
      return LearningResourceMiniGame;
    case 'guides':
      return LearningResourceGuide;
    default: {
      const err = new Error('無效的 learningResources kind');
      err.status = 400;
      throw err;
    }
  }
}

async function createLearningResource(kind, body, actorId) {
  const Model = modelForLearningKind(kind);
  const payload = {
    titleZh: trimOrNull(body.titleZh),
    titleEn: trimOrNull(body.titleEn),
    introZh: trimOrNull(body.introZh),
    introEn: trimOrNull(body.introEn),
    tag: trimOrNull(body.tag),
    href: trimOrNull(body.href),
    titleKey: trimOrNull(body.titleKey),
    introKey: trimOrNull(body.introKey),
    tagKey: trimOrNull(body.tagKey),
    isExternal: kind === 'miniGames' || kind === 'guides' ? !!body.isExternal : undefined,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    isActive: toBool(body.isActive) ?? true,
    updatedBy: actorId || null,
  };

  if (!payload.href) {
    const err = new Error('href 必填');
    err.status = 400;
    throw err;
  }

  // Remove keys undefined so Sequelize doesn't attempt to set them
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const row = await Model.create(payload);
  return (kind === 'sites'
    ? serializeLearningResourceSite(row)
    : kind === 'miniGames'
      ? serializeLearningResourceMiniGame(row)
      : serializeLearningResourceGuide(row));
}

async function updateLearningResource(kind, id, body, actorId) {
  const Model = modelForLearningKind(kind);
  const row = await Model.findByPk(id);
  if (!row) {
    const err = new Error('找不到內容');
    err.status = 404;
    throw err;
  }

  const patch = {
    titleZh: trimOrNull(body.titleZh),
    titleEn: trimOrNull(body.titleEn),
    introZh: trimOrNull(body.introZh),
    introEn: trimOrNull(body.introEn),
    tag: trimOrNull(body.tag),
    href: trimOrNull(body.href),
    titleKey: trimOrNull(body.titleKey),
    introKey: trimOrNull(body.introKey),
    tagKey: trimOrNull(body.tagKey),
    isExternal: kind === 'miniGames' || kind === 'guides' ? !!body.isExternal : undefined,
    sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    isActive: body.isActive !== undefined ? toBool(body.isActive) : undefined,
    updatedBy: actorId || null,
  };

  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  // href 必填 only for create; for update allow empty to be rejected
  if ('href' in patch && !patch.href) {
    const err = new Error('href 必填');
    err.status = 400;
    throw err;
  }

  await row.update(patch);
  return (kind === 'sites'
    ? serializeLearningResourceSite(row)
    : kind === 'miniGames'
      ? serializeLearningResourceMiniGame(row)
      : serializeLearningResourceGuide(row));
}

async function deleteLearningResource(kind, id) {
  const Model = modelForLearningKind(kind);
  const row = await Model.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

async function reorderLearningResources(kind, ids, actorId) {
  const Model = modelForLearningKind(kind);
  if (!Array.isArray(ids) || ids.length === 0) return { updated: 0 };

  const cleanIds = ids.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (cleanIds.length === 0) return { updated: 0 };

  // Ensure we reorder only those existing rows; missing ids are ignored.
  const rows = await Model.findAll({ where: { id: { [Op.in]: cleanIds } } });
  const byId = new Map(rows.map((r) => [r.id, r]));

  let updated = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (let i = 0; i < cleanIds.length; i++) {
    const id = cleanIds[i];
    const row = byId.get(id);
    if (!row) continue;
    // eslint-disable-next-line no-await-in-loop
    await row.update({ sortOrder: i, updatedBy: actorId || null });
    updated++;
  }

  return { updated };
}

function validateSortOrder(body, field = 'sortOrder') {
  if (body[field] === undefined) return undefined;
  const n = Number(body[field]);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

async function createRegulationsGroup(body, actorId) {
  const titleZh = trimOrNull(body.titleZh) || '';
  const titleEn = trimOrNull(body.titleEn) || '';
  const sortOrder = validateSortOrder(body, 'sortOrder') ?? 0;
  const isActive = toBool(body.isActive) ?? true;

  const row = await RegulationsFormsGroup.create({
    titleZh,
    titleEn,
    sortOrder,
    isActive,
    updatedBy: actorId || null,
  });
  return serializeRegulationsGroup(row);
}

async function updateRegulationsGroup(id, body, actorId) {
  const row = await RegulationsFormsGroup.findByPk(id);
  if (!row) {
    const err = new Error('找不到群組');
    err.status = 404;
    throw err;
  }

  await row.update({
    titleZh: trimOrNull(body.titleZh),
    titleEn: trimOrNull(body.titleEn),
    sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    isActive: body.isActive !== undefined ? toBool(body.isActive) : undefined,
    updatedBy: actorId || null,
  });

  // remove undefined updates
  const updated = await row.reload();
  return serializeRegulationsGroup(updated);
}

async function deleteRegulationsGroup(id) {
  const row = await RegulationsFormsGroup.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

async function reorderRegulationsGroups(ids, actorId) {
  if (!Array.isArray(ids) || ids.length === 0) return { updated: 0 };
  const cleanIds = ids.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (cleanIds.length === 0) return { updated: 0 };
  const rows = await RegulationsFormsGroup.findAll({ where: { id: { [Op.in]: cleanIds } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  let updated = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (let i = 0; i < cleanIds.length; i++) {
    const id = cleanIds[i];
    const row = byId.get(id);
    if (!row) continue;
    // eslint-disable-next-line no-await-in-loop
    await row.update({ sortOrder: i, updatedBy: actorId || null });
    updated++;
  }
  return { updated };
}

async function createRegulationsItem(body, actorId) {
  const groupId = Number(body.groupId);
  if (!Number.isFinite(groupId)) {
    const err = new Error('groupId 必填且需為數字');
    err.status = 400;
    throw err;
  }
  const titleZh = trimOrNull(body.titleZh) || '';
  const titleEn = trimOrNull(body.titleEn) || '';
  const fileUrl = trimOrNull(body.fileUrl);
  if (!fileUrl) {
    const err = new Error('fileUrl 必填');
    err.status = 400;
    throw err;
  }
  const sortOrder = validateSortOrder(body, 'sortOrder') ?? 0;
  const isActive = toBool(body.isActive) ?? true;

  const row = await RegulationsFormsItem.create({
    groupId,
    titleZh,
    titleEn,
    fileUrl,
    sortOrder,
    isActive,
    updatedBy: actorId || null,
  });
  return serializeRegulationsItem(row);
}

async function updateRegulationsItem(id, body, actorId) {
  const row = await RegulationsFormsItem.findByPk(id);
  if (!row) {
    const err = new Error('找不到項目');
    err.status = 404;
    throw err;
  }

  await row.update({
    titleZh: trimOrNull(body.titleZh),
    titleEn: trimOrNull(body.titleEn),
    fileUrl: body.fileUrl !== undefined ? trimOrNull(body.fileUrl) : undefined,
    sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    isActive: body.isActive !== undefined ? toBool(body.isActive) : undefined,
    updatedBy: actorId || null,
  });
  const updated = await row.reload();
  return serializeRegulationsItem(updated);
}

async function deleteRegulationsItem(id) {
  const row = await RegulationsFormsItem.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

async function reorderRegulationsItems(ids, actorId) {
  if (!Array.isArray(ids) || ids.length === 0) return { updated: 0 };
  const cleanIds = ids.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (cleanIds.length === 0) return { updated: 0 };
  const rows = await RegulationsFormsItem.findAll({ where: { id: { [Op.in]: cleanIds } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  let updated = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (let i = 0; i < cleanIds.length; i++) {
    const id = cleanIds[i];
    const row = byId.get(id);
    if (!row) continue;
    // eslint-disable-next-line no-await-in-loop
    await row.update({ sortOrder: i, updatedBy: actorId || null });
    updated++;
  }
  return { updated };
}

async function updateScrollWorldSegment(sectionId, body, actorId) {
  const row = await ScrollWorldTestSegment.findOne({ where: { sectionId } });
  if (!row) {
    const err = new Error('找不到 segment');
    err.status = 404;
    throw err;
  }

  const secondary = Array.isArray(body.secondaryCtas) ? body.secondaryCtas : null;
  const secondaryCtasJson = secondary ? JSON.stringify(secondary) : undefined;

  await row.update({
    labelZh: body.labelZh !== undefined ? trimOrNull(body.labelZh) : undefined,
    labelEn: body.labelEn !== undefined ? trimOrNull(body.labelEn) : undefined,
    titleZh: body.titleZh !== undefined ? trimOrNull(body.titleZh) : undefined,
    titleEn: body.titleEn !== undefined ? trimOrNull(body.titleEn) : undefined,
    bodyZh: body.bodyZh !== undefined ? trimOrNull(body.bodyZh) : undefined,
    bodyEn: body.bodyEn !== undefined ? trimOrNull(body.bodyEn) : undefined,
    primaryCtaLabelZh: body.primaryCtaLabelZh !== undefined ? trimOrNull(body.primaryCtaLabelZh) : undefined,
    primaryCtaLabelEn: body.primaryCtaLabelEn !== undefined ? trimOrNull(body.primaryCtaLabelEn) : undefined,
    primaryCtaHref: body.primaryCtaHref !== undefined ? trimOrNull(body.primaryCtaHref) : undefined,
    primaryCtaIsExternal: body.primaryCtaIsExternal !== undefined ? !!body.primaryCtaIsExternal : undefined,
    secondaryCtasJson,
    isActive: body.isActive !== undefined ? toBool(body.isActive) : undefined,
    updatedBy: actorId || null,
  });

  const updated = await row.reload();
  return serializeScrollWorldSegment(updated);
}

async function reorderScrollWorldSegments(sectionIds, actorId) {
  if (!Array.isArray(sectionIds) || sectionIds.length === 0) return { updated: 0 };
  const clean = sectionIds.map((x) => String(x)).filter(Boolean);
  if (!clean.length) return { updated: 0 };
  const rows = await ScrollWorldTestSegment.findAll({ where: { sectionId: { [Op.in]: clean } } });
  const bySectionId = new Map(rows.map((r) => [r.sectionId, r]));
  let updated = 0;
  for (let i = 0; i < clean.length; i++) {
    const sid = clean[i];
    const row = bySectionId.get(sid);
    if (!row) continue;
    // eslint-disable-next-line no-await-in-loop
    await row.update({ sortOrder: i, updatedBy: actorId || null });
    updated++;
  }
  return { updated };
}

module.exports = {
  listLearningResources,
  listRegulationsForms,
  listScrollWorldSegments,

  createLearningResource,
  updateLearningResource,
  deleteLearningResource,
  reorderLearningResources,

  createRegulationsGroup,
  updateRegulationsGroup,
  deleteRegulationsGroup,
  reorderRegulationsGroups,

  createRegulationsItem,
  updateRegulationsItem,
  deleteRegulationsItem,
  reorderRegulationsItems,

  updateScrollWorldSegment,
  reorderScrollWorldSegments,

  // exported for potential future seed/admin features
  ensureLearningResourcesDefaults,
  ensureRegulationsFormsDefaults,
  ensureScrollWorldDefaults,
};

