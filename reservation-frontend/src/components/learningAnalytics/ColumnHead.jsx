import React from 'react';

/**
 * 表頭：上面是這欄在回答的問題，下面是數字怎麼來。
 * 同一件事在各頁用同一組字。
 */
export const HEAD = {
  beyondExpected: {
    name: '比預期多多少',
    hint: '已扣除入學時的整體英文程度，以及兩次測驗相隔多久。正數代表比條件相近的人多進步。不是跟這一科的前測比。',
  },
  beyondExpectedNote: {
    name: '比預期多多少',
    hint: '已扣除入學程度與兩次測驗間隔。正數代表比條件相近的人多。這欄不拿來排名。',
  },
  actualGse: {
    name: '後測減前測',
    hint: '先換成同一把尺（GSE），再算後測減前測。不同英檢的原始分不能直接相減。',
  },
  rawGain: {
    name: '這份測驗多幾分',
    hint: '同一份英檢的原始分，後測減前測。不同測驗的分數不能互比。',
  },
  sameStart: {
    name: '跟同樣起點比',
    hint: '同一科、前測落在同一區間的人裡面，比過多少人。',
  },
  hoursBeforeExam: {
    name: '後測前的時數',
    hint: '這次後測之前，修課與活動加起來的小時。',
  },
  evidence: {
    name: '資料夠不夠',
    hint: '有沒有入學程度、第二次英檢，以及修課或活動紀錄。',
  },
  pretestBand: {
    name: '前測落在',
    hint: '這一科前測分數的區間，不是入學時的整體程度。',
  },
  bandRange: {
    name: '對應分數',
    hint: '這個區間的 GSE 範圍。',
  },
  group: {
    name: '這一組',
    hint: '依畫面上的切法，例如同一個系所或同一個入學年。',
  },
  b2Rate: {
    name: '目前達 B2 的比例',
    hint: '這組裡，目前最高英檢達到 B2 以上的人。',
  },
  retestRate: {
    name: '有第二次英檢的比例',
    hint: '至少考過兩次，才算得出進步。',
  },
  avgResourceHours: {
    name: '平均修課與活動時數',
    hint: '這組每人平均累積的小時。',
  },
  growthEpisodes: {
    name: '能算進步的筆數',
    hint: '有前測也有後測的配對次數，不是學生人數。',
  },
  growthStudents: {
    name: '能算進步的人數',
    hint: '有前測也有後測，可以比較後來差多少。',
  },
  participants: {
    name: '參加過的人數',
    hint: '曾經上過這類資源的學生。',
  },
  mainSkills: {
    name: '主要練什麼',
    hint: '聽、讀、說、寫裡，這類資源對應的技能。',
  },
  directionMix: {
    name: '變好、沒變、變差',
    hint: '依同一份測驗的原始分，後測高於、等於或低於前測的人數。',
  },
  anySkillUp: {
    name: '至少一項變好',
    hint: '聽、讀、說、寫裡，至少一項後測優於前測。',
  },
  allSkillsUp: {
    name: '四項都變好',
    hint: '四項都有前後測，而且每一項後測都優於前測。',
  },
  caution: {
    name: '要不要再看分布',
    hint: '平均被少數人拉高或拉低，或同一把尺和原始分對不上。',
  },
  pairCount: {
    name: '能比的次數',
    hint: '單一技能的前後測配對，不是考試場次。',
  },
  direction: {
    name: '變好或變差',
    hint: '依這位學生的平均原始分。',
  },
  placement: {
    name: '入學英文分級',
    hint: '入學時的分級。不是目前的英檢等級。',
  },
  examPhase: {
    name: '英檢進度',
    hint: '「前後測」代表至少考過兩次，才能算進步。',
  },
  activityHours: {
    name: '累積活動時數',
    hint: '參加活動的小時。',
  },
  courseHours: {
    name: '累積修課時數',
    hint: '修課的小時。',
  },
  courseStatus: {
    name: '修課',
    hint: '有選課紀錄就算有修課（退選不算）。當下學期有選課列顯示為修課中。',
  },
  hasBaseline: {
    name: '有入學英文分數',
    hint: '已匯入學測或入學分級。不是英檢前測，也不會換成 CEFR。',
  },
  validExam: {
    name: '有可用的英檢',
    hint: '至少有一筆可計入的正式英檢。',
  },
  singleExam: {
    name: '只考過一次',
    hint: '還沒有後測，算不出進步。',
  },
  canCompare: {
    name: '能算前後測',
    hint: '至少兩次英檢，可以比前測和後測。',
  },
  accumulatedHours: {
    name: '累積時數',
    hint: '這類資源加總的小時。未修完的課可能不算。',
  },
  proof: {
    name: '用來判斷的成績',
    hint: '這格達標或不達標，是看哪一次考試。',
  },
  admissionYear: {
    name: '入學年',
    hint: '入學年度。',
  },
  situation: {
    name: '修課與活動',
    hint: '有修課看選課紀錄；有活動看累積活動時數。',
  },
  examThen: {
    name: '存名單時的英檢',
    hint: '建立這份名單當下看到的英檢。',
  },
  examNow: {
    name: '現在的英檢',
    hint: '用最新分析快照看到的英檢。',
  },
  activityThen: {
    name: '當時活動時數',
    hint: '存名單時累積的活動小時。',
  },
  activityNow: {
    name: '現在活動時數',
    hint: '最新快照的活動小時。',
  },
  activityDelta: {
    name: '活動多了幾小時',
    hint: '現在減去存名單時。',
  },
  courseThen: {
    name: '當時修課時數',
    hint: '存名單時累積的修課小時。',
  },
  courseNow: {
    name: '現在修課時數',
    hint: '最新快照的修課小時。',
  },
  courseDelta: {
    name: '修課多了幾小時',
    hint: '現在減去存名單時。',
  },
  scoreOrHours: {
    name: '分數或時數',
    hint: '英檢顯示分數，課程與活動顯示小時。',
  },
  marker: {
    name: '這筆標記',
    hint: '例如基準、重測。',
  },
  instrument: {
    name: '哪一份測驗',
    hint: '原始分只跟同一份測驗比。',
  },
};

export default function ColumnHead({ name, hint }) {
  return (
    <span className="la-colhead" title={hint || undefined}>
      <span className="la-colhead-name">{name}</span>
      {hint ? <span className="la-colhead-hint">{hint}</span> : null}
    </span>
  );
}
