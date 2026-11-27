'use strict';

/** 手機首頁暫代週報的意見調查。不是 ET/EC 預約 Gate。 */
const ACTIVITY_FEEDBACK_SURVEY_KEY = 'activity_website_feedback_115';

const ET = 'English Table';
const EC = 'English Club';
const JT = 'Job Talk';
const NONE_ATTEND = '都沒有出席過';
const NONE_MISS = '沒有這種情況';
const TYPES = [ET, EC, JT];

const AGREE = ['非常不同意', '不同意', '普通', '同意', '非常同意'];
const HELP = ['完全沒幫助', '有一點幫助', '普通', '有幫助', '非常有幫助'];

const touched = {
  any: [
    { questionId: 'af_attended', includesAny: TYPES },
    { questionId: 'af_missed', includesAny: TYPES },
  ],
};

const screened = {
  all: [
    { questionId: 'af_attended', includesAny: [ET, EC, JT, NONE_ATTEND] },
    { questionId: 'af_missed', includesAny: [ET, EC, JT, NONE_MISS] },
  ],
};

const attendedType = (type) => ({ questionId: 'af_attended', includesAny: [type] });
const attendedAny = { questionId: 'af_attended', includesAny: TYPES };
const changeHour = {
  any: [
    { questionId: 'af_change_first', equals: '改開放的鐘點' },
    { questionId: 'af_change_first', equals: '鐘點和提早都要' },
  ],
};
const changeDays = {
  any: [
    { questionId: 'af_change_first', equals: '讓開放日再提早' },
    { questionId: 'af_change_first', equals: '鐘點和提早都要' },
  ],
};
const touchedEt = {
  any: [
    { questionId: 'af_attended', includesAny: [ET] },
    { questionId: 'af_missed', includesAny: [ET] },
  ],
};

function radio(id, label, section, options, visibleWhen) {
  return { id, type: 'radio', label, section, options, required: true, visibleWhen };
}

function checks(id, label, section, options, extra = {}) {
  return {
    id,
    type: 'checkbox',
    label,
    section,
    options,
    required: true,
    ...extra,
  };
}

function likert(id, label, section, scaleLabels, visibleWhen) {
  return {
    id,
    type: 'likert',
    label,
    section,
    required: true,
    scale: [1, 2, 3, 4, 5],
    scaleLabels,
    visibleWhen,
  };
}

function text(id, label, section, visibleWhen, required = false) {
  return { id, type: 'textarea', label, section, required, visibleWhen };
}

function buildActivityFeedbackSchema() {
  const opening = touched;
  const booking = touched;
  return {
    id: ACTIVITY_FEEDBACK_SURVEY_KEY,
    title: '增能活動與網站問卷',
    description: '想了解你怎麼預約 English Table、English Club、Job Talk，以及參加和用網站的經驗。約 6–8 分鐘。沒有標準答案，沒參加過也可以填前半段。結果只做整體改進，不影響出席、預約或成績。不必登入。這不是預約前必填的那份問卷。',
    sections: [
      { id: 'about', title: '一、你參加過哪些' },
      { id: 'opening', title: '二、開放預約的時間' },
      { id: 'booking', title: '三、預約流程與會前準備' },
      { id: 'during-et', title: '四、English Table 活動過程' },
      { id: 'during-ec', title: '四、English Club 活動過程' },
      { id: 'during-jt', title: '四、Job Talk 活動過程' },
      { id: 'after', title: '五、活動結束後的回饋' },
      { id: 'website', title: '六、網站' },
      { id: 'close', title: '七、其他' },
    ],
    questions: [
      radio('af_grade', '年級', 'about', [
        '大學一年級',
        '大學二年級',
        '大學三年級',
        '大學四年級以上',
        '碩博士',
        '其他',
      ]),
      checks('af_attended', '本學期你實際出席過哪些？', 'about', [ET, EC, JT, NONE_ATTEND], {
        exclusiveValue: NONE_ATTEND,
        hint: '可複選。若都沒有出席，只選最後一項。',
      }),
      checks('af_missed', '本學期你想參加、但最後沒約到的有哪些？', 'about', [ET, EC, JT, NONE_MISS], {
        exclusiveValue: NONE_MISS,
        hint: '可複選。若沒有這種情況，只選最後一項。',
      }),
      radio('af_absent_reason', '都沒有出席的最主要原因是？', 'about', [
        '想約但名額滿了',
        '開放時我在上課',
        '不知道什麼時候開放',
        '時間和課表衝突',
        '還沒有想參加的主題',
        '不確定活動在做什麼',
        '其他',
      ], { questionId: 'af_attended', includesAny: [NONE_ATTEND] }),
      text('af_absent_reason_other', '請說明原因', 'about', { questionId: 'af_absent_reason', equals: '其他' }, true),

      radio('af_primary', '你最常想預約的是哪一種？', 'opening', [ET, EC, JT], opening),
      radio('af_last_result', '最近一次想預約時，結果是？', 'opening', [
        '順利約到',
        '名額已經滿了',
        '當時在上課，沒打開網站',
        '不知道那天中午會開放',
        '看得到場次，但不確定還能不能約',
        '其他',
      ], opening),
      text('af_last_result_other', '請說明那一次的情況', 'opening', { questionId: 'af_last_result', equals: '其他' }, true),
      radio('af_noon', '開放那天的中午 12:00，你通常在做什麼？', 'opening', [
        '正在上課',
        '午休，可以看手機',
        '當天中午沒課',
        '我不知道是中午 12:00 開放',
      ], opening),
      radio('af_noon_fit', '中午 12:00 開放，對你預約順不順？', 'opening', [
        '很順',
        '還可以',
        '有點不便，但通常仍約得到',
        '常常因此約不到',
        '不確定',
      ], opening),
      checks('af_free_slots', '你比較能打開網站看預約的時段是？', 'opening', [
        '08:00–10:00',
        '10:00–12:00',
        '12:00–13:00',
        '13:00–17:00',
        '17:00–19:00',
        '19:00–22:00',
        '週末',
      ], { maxSelect: 2, hint: '最多選 2 個。', visibleWhen: opening }),
      radio('af_change_first', '若只能先改一件事，你希望先改哪一件？', 'opening', [
        '改開放的鐘點',
        '讓開放日再提早',
        '鐘點和提早都要',
        '維持現在這樣即可',
      ], opening),
      radio('af_new_hour', '你希望新的開放鐘點落在？', 'opening', [
        '早上 08:00',
        '中午 12:00（維持）',
        '下午 17:00',
        '晚上 20:00',
        '沒有特別偏好，只要不要只卡在上課時段',
      ], { all: [opening, changeHour] }),
      radio('af_et_lead_days', 'English Table 目前是活動前一天中午才開放。你希望改成？', 'opening', [
        '維持前一天中午',
        '提早到前兩天同一時段',
        '提早到前三天同一時段',
        '我不約 English Table',
      ], { all: [touchedEt, changeDays] }),

      radio('af_booking_step', '預約時最不順的一步是？', 'booking', [
        '找到下一場活動',
        '看懂還有沒有名額',
        '知道何時開放、何時截止',
        '登入',
        '送出前要填的問卷',
        '確認送出',
        '事後取消或查自己的預約',
        '這幾步都順',
      ], booking),
      radio('af_saw_topic', '預約前，你有看到該週 English Table 討論題目嗎？', 'booking', [
        '有看到，而且是在預約前',
        '約完才看到',
        '知道有題目，但找不到',
        '不知道有題目可以先看',
      ], attendedType(ET)),
      likert('af_topic_help_decide', '事先看題目，對「決定要不要參加」有幫助嗎？', 'booking', HELP, {
        questionId: 'af_saw_topic',
        equals: '有看到，而且是在預約前',
      }),
      likert('af_topic_help_speak', '事先看題目，對「活動當下知道要說什麼」有幫助嗎？', 'booking', HELP, {
        questionId: 'af_saw_topic',
        equals: '有看到，而且是在預約前',
      }),
      radio('af_did_practice', '你做過 English Table「會前練習」（選一題錄一段）嗎？', 'booking', [
        '這學期做過',
        '知道有，但沒做',
        '不知道有這個功能',
      ], attendedType(ET)),
      likert('af_practice_help', '會前練習對你活動中開口的幫助是？', 'booking', HELP, {
        questionId: 'af_did_practice',
        equals: '這學期做過',
      }),
      radio('af_practice_useful', '會前練習最有用的是哪一項？', 'booking', [
        '先聽到自己怎麼說',
        '得到一句現場可以接的話',
        'Leader 知道怎麼幫我開場',
        '讓我比較不緊張',
        '其實沒有特別有用',
      ], { questionId: 'af_did_practice', equals: '這學期做過' }),
      radio('af_practice_skip', '知道有會前練習，但沒做的主要原因是？', 'booking', [
        '沒時間',
        '不想被錄音',
        '用手機操作不順',
        '覺得對活動沒幫助',
        '預約當下沒注意到',
        '其他',
      ], { questionId: 'af_did_practice', equals: '知道有，但沒做' }),
      text('af_practice_skip_other', '請說明沒做的原因', 'booking', { questionId: 'af_practice_skip', equals: '其他' }, true),

      likert('af_et_speak', '我有足夠機會說英文', 'during-et', AGREE, attendedType(ET)),
      likert('af_et_level', '題目難度適合我', 'during-et', AGREE, attendedType(ET)),
      likert('af_et_size', '小組人數讓我說得出口', 'during-et', AGREE, attendedType(ET)),
      likert('af_et_leader', 'Leader 的引導幫助我進入討論', 'during-et', AGREE, attendedType(ET)),
      likert('af_et_length', '活動長度剛好', 'during-et', AGREE, attendedType(ET)),
      radio('af_et_change', '若下一場 English Table 只能改一件事', 'during-et', [
        '題目難度',
        '每個人說話的時間',
        '小組人數',
        'Leader 怎麼帶',
        '活動長度',
        '中英文比例',
        '維持現在即可',
        '其他',
      ], attendedType(ET)),
      text('af_et_change_other', '請說明想改的事', 'during-et', { questionId: 'af_et_change', equals: '其他' }, true),
      likert('af_et_again', '我還想再參加 English Table', 'during-et', AGREE, attendedType(ET)),

      likert('af_ec_speak', '我有足夠機會說英文', 'during-ec', AGREE, attendedType(EC)),
      likert('af_ec_topic', '主題讓我想說話', 'during-ec', AGREE, attendedType(EC)),
      likert('af_ec_guide', '講師或業師的引導幫助我開口', 'during-ec', AGREE, attendedType(EC)),
      likert('af_ec_amount', '練習的份量剛好', 'during-ec', AGREE, attendedType(EC)),
      likert('af_ec_length', '活動長度剛好', 'during-ec', AGREE, attendedType(EC)),
      radio('af_ec_change', '若下一場 English Club 只能改一件事', 'during-ec', [
        '主題',
        '開口時間',
        '引導方式',
        '練習份量',
        '活動長度',
        '維持現在即可',
        '其他',
      ], attendedType(EC)),
      text('af_ec_change_other', '請說明想改的事', 'during-ec', { questionId: 'af_ec_change', equals: '其他' }, true),
      likert('af_ec_again', '我還想再參加 English Club', 'during-ec', AGREE, attendedType(EC)),

      likert('af_jt_relevant', '內容和我想了解的職涯情境有關', 'during-jt', AGREE, attendedType(JT)),
      likert('af_jt_understand', '我聽得懂', 'during-jt', AGREE, attendedType(JT)),
      likert('af_jt_speak', '我有練習用英文表達的機會', 'during-jt', AGREE, attendedType(JT)),
      likert('af_jt_length', '活動長度剛好', 'during-jt', AGREE, attendedType(JT)),
      radio('af_jt_change', '若下一場 Job Talk 只能改一件事', 'during-jt', [
        '主題方向',
        '聽得懂的程度',
        '自己表達的機會',
        '活動長度',
        '維持現在即可',
        '其他',
      ], attendedType(JT)),
      text('af_jt_change_other', '請說明想改的事', 'during-jt', { questionId: 'af_jt_change', equals: '其他' }, true),
      likert('af_jt_again', '我還想再參加 Job Talk', 'during-jt', AGREE, attendedType(JT)),

      text('af_keep', '活動過程中，你最希望被保留的一點是？', 'after', attendedAny, false),
      radio('af_feedback_kind', '活動結束後，你最希望得到哪一種？', 'after', [
        '不需要額外回饋',
        '結束前一句口頭建議',
        '書面：一個做得好的地方，加一個下次可試的說法',
        '系統比較我的會前、會後錄音',
        '2–3 個可以帶走的句型',
        '出席確認就好',
      ], attendedAny),
      radio('af_feedback_time', '為了得到這個回饋，你願意多花多少時間？', 'after', [
        '不願意多花時間',
        '活動最後 3 分鐘',
        '結束後當天再花約 5 分鐘',
        '之後自己上網站看就好',
      ], attendedAny),
      radio('af_feedback_from', '你希望誰提供回饋？', 'after', [
        '帶活動的 Leader 或講師',
        '系統整理即可',
        '兩者都可以',
        '不需要',
      ], attendedAny),
      radio('af_feedback_where', '你希望在哪裡看到回饋？', 'after', [
        '活動現場',
        '網站上「我的預約」或口說紀錄',
        'Email',
        '沒有偏好',
      ], {
        all: [
          attendedAny,
          { questionId: 'af_feedback_kind', notEquals: '不需要額外回饋' },
        ],
      }),

      radio('af_device', '你多半用什麼預約或查活動？', 'website', ['手機', '電腦', '兩者都常用'], screened),
      radio('af_site_friction', '網站上最不順的一件事是？', 'website', [
        '找到下一場活動',
        '知道何時開放、何時截止',
        '看懂名額',
        '完成預約',
        '事後找到「我的預約」',
        '找到 English Table 題目或會前練習',
        '取消預約',
        '目前都還順',
      ], screened),
      text('af_site_change', '若網站只能改一個畫面或一句說明，你希望改哪裡？', 'website', screened, false),
      text('af_else', '還有什麼想告訴中心的？', 'close', screened, false),
    ],
  };
}

module.exports = {
  ACTIVITY_FEEDBACK_SURVEY_KEY,
  buildActivityFeedbackSchema,
};
