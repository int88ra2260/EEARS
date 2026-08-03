'use strict';



const { LVA_VERSION } = require('../learningJourney/analytics/lvaAnalyticsService');

const {

  listResourceSkillProfilesForSettings,

  upsertResourceSkillProfiles,

  resetResourceSkillProfile,

} = require('./resourceSkillProfileService');

const {

  listFilterReferencesAdmin,

  replaceFilterReferences,

  REF_TYPES,

} = require('./learningAnalyticsFilterReferenceService');

const {

  listLvaConfigForSettings,

  upsertLvaConfig,

  resetLvaConfig,

} = require('./learningAnalyticsLvaConfigService');

const { listGseMappingForSettings } = require('./gseScoreMappingService');



const SKILL_WEIGHT_LABELS = Object.freeze({

  listening: '聽力權重',

  reading: '閱讀權重',

  speaking: '口說權重',

  writing: '寫作權重',

  interaction: '互動權重',

  mediation: '調整權重',

  eap: 'EAP 權重',

  esp: 'ESP 權重',

});



const RESOURCE_LABELS = Object.freeze({

  GE: '通識英文',

  EAP: 'EAP 寫作／學術英文',

  ESP: 'ESP 專業英文',

  ENGLISH_TABLE: 'English Table',

  ENGLISH_CLUB: 'English Club',

  JOB_TALK: 'Job Talk',

  INTERNATIONAL_FORUM: 'International Forum',

  WORKSHOP: '工作坊',

  TUTOR_IN_PERSON: '實體一對一諮詢',

  TUTOR_ONLINE: '線上一對一諮詢',

  ACTIVITY_OTHER: '其他活動',

  COURSE_OTHER: '其他課程',

});



const FILTER_REF_LABELS = Object.freeze({

  semester: '學期',

  cohort: '入學年度',

  college: '學院',

  department: '系所',

});



/**

 * 學習成效分析模組設定

 */

async function getLearningAnalyticsSettings() {

  const [filterReferences, lvaConfig, gseMapping] = await Promise.all([

    listFilterReferencesAdmin(),

    listLvaConfigForSettings(),

    Promise.resolve(listGseMappingForSettings()),

  ]);



  const resourceSkillProfiles = (await listResourceSkillProfilesForSettings()).map((row) => ({

    ...row,

    label: RESOURCE_LABELS[row.resourceKey] || row.resourceKey,

    weightLabels: SKILL_WEIGHT_LABELS,

  }));



  return {

    modelVersion: LVA_VERSION,

    lvaConfig,

    gseMapping,

    resourceSkillProfiles,

    filterReferences,

    filterReferenceTypes: REF_TYPES.map((refType) => ({

      refType,

      label: FILTER_REF_LABELS[refType] || refType,

    })),

    policies: {

      causalClaimAllowed: false,

      estimateDisclaimer: '分析結果為觀察資料估計，不代表課程或活動「造成」能力提升。',

      exposureWindowRule: '僅計入後測日期之前的修課與活動（同日不計入該次成長區間）。',

      gseNote: '「GSE（Global Scale of English）」是 Pearson 對齊 CEFR 的能力量尺，用於內部分析前後測變化；不等於官方認證分數，也不代表等級之間等距。',

      skillProfileNote: '技能向量可於本頁校準；儲存後曝光、建議與效益分析會採用新權重。',

      filterReferenceNote: '篩選下拉選單會合併「分析資料中出現過的值」與此處手動維護的項目，方便新增未來系所或學院。',

      lvaNote: 'LVA（學習成效估計）控制修正成長、背景比對與加權估計的演算法參數；變更後各分析頁與模型紀錄會採用新設定。',

    },

    maintenance: {

      rebuildCommand: 'npm run lj:rebuild-analytics',

      recomputeGseEpisodesCommand: 'npm run lj:recompute-gse-episodes',

      pruneSnapshotsDryRun: 'npm run lj:prune-analytics-snapshots:dry',

      pruneSnapshotsApply: 'npm run lj:prune-analytics-snapshots:apply',

      operationsPath: '/admin/learning-journey/operations',

    },

    futureWork: [

      'student_resource_exposures：持久化曝光計算結果，加速大型報表',

      '單一課程／活動實例（resource_id > 0）的細部技能向量',

    ],

  };

}



async function updateLearningAnalyticsResourceSkillProfiles(updates, { user } = {}) {

  return upsertResourceSkillProfiles(updates, { user });

}



async function resetLearningAnalyticsResourceSkillProfile(resourceKey, { user } = {}) {

  const result = await resetResourceSkillProfile(resourceKey, { user });

  const profiles = await listResourceSkillProfilesForSettings();

  return { ...result, profiles };

}



async function updateLearningAnalyticsFilterReferences(refType, items, { user } = {}) {

  const filterReferences = await replaceFilterReferences(refType, items, { user });

  return { filterReferences };

}



async function updateLearningAnalyticsLvaConfig(updates, { user } = {}) {

  const lvaConfig = await upsertLvaConfig(updates, { user });

  return { lvaConfig };

}



async function resetLearningAnalyticsLvaConfig({ user } = {}) {

  return resetLvaConfig({ user });

}



module.exports = {

  getLearningAnalyticsSettings,

  updateLearningAnalyticsResourceSkillProfiles,

  resetLearningAnalyticsResourceSkillProfile,

  updateLearningAnalyticsFilterReferences,

  updateLearningAnalyticsLvaConfig,

  resetLearningAnalyticsLvaConfig,

  RESOURCE_LABELS,

  SKILL_WEIGHT_LABELS,

  FILTER_REF_LABELS,

};

