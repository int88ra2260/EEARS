'use strict';

const FOCUS = {
  PROMOTION: 'promotion',
  PREVENTION: 'prevention',
};

function pickFocus(query = {}) {
  const raw = String(query.regulatoryFocus || query.focus || 'auto').trim().toLowerCase();
  if (raw === FOCUS.PREVENTION || raw === 'prevention') return FOCUS.PREVENTION;
  if (raw === FOCUS.PROMOTION || raw === 'promotion') return FOCUS.PROMOTION;
  return FOCUS.PROMOTION;
}

function inferFocusFromContext(context = {}) {
  const noShow = Number(context.noShowCount || 0);
  if (noShow >= 2) return FOCUS.PREVENTION;

  if (context.upcomingReservations != null) {
    const upcoming = Number(context.upcomingReservations);
    if (upcoming === 0) return FOCUS.PREVENTION;
  }

  return FOCUS.PROMOTION;
}

function buildTemplateFeedback({ focus, weakSkills, estimatedLevel, stats = {} }) {
  const skills = (weakSkills || ['speaking']).join('、');
  const level = estimatedLevel || 'B1';
  const mistakes = stats.totalMistakes;

  if (focus === FOCUS.PREVENTION) {
    return {
      regulatoryFocus: FOCUS.PREVENTION,
      headline: '先穩住節奏，避免錯失下一個練習窗口',
      message: `你的估計程度約 ${level}。為避免口語（${skills}）進步停滯，建議本週至少完成 1 次 English Table 或 English Club 預約，並在活動開始前 2 小時前確認出席。`,
      actionItems: [
        '查看可預約活動並鎖定一個固定時段',
        '若曾缺席，優先選名額充足場次降低壓力',
        mistakes != null ? `Word Bridge 本場失誤 ${mistakes} 次，可先用活動內口語練習補強` : '完成一場活動後再回 Word Bridge 驗證',
      ],
      tone: 'prevention',
      llmEnhanced: false,
    };
  }

  return {
    regulatoryFocus: FOCUS.PROMOTION,
    headline: '你已經有進步動能，值得再推進一級',
    message: `估計程度 ${level} 代表你具備延伸口語（${skills}）的基礎。若延續微學習並搭配 International Forum / Job Talk，較有機會把詞彙與互動能力一起拉高。`,
    actionItems: [
      '本週再完成 1 次 Word Bridge 或 Listening 練習',
      '預約 1 場對齊弱項的 ET / EC 活動',
      '到「我的英語歷程」查看徽章與下一個目標',
    ],
    tone: 'promotion',
    llmEnhanced: false,
  };
}

async function generateRegulatoryFocusFeedback(context = {}, query = {}) {
  const focus = query.regulatoryFocus && query.regulatoryFocus !== 'auto'
    ? pickFocus(query)
    : inferFocusFromContext(context);

  const feedback = buildTemplateFeedback({
    focus,
    weakSkills: context.weakSkills,
    estimatedLevel: context.estimatedLevel,
    stats: context.stats,
  });

  return {
    ...feedback,
    disclaimer: '回饋為教學策略啟發式建議，不代表保證成效；若環境變數 LEARNING_FEEDBACK_LLM_ENABLED=true 可啟用 LLM 潤飾（尚未設定時使用模板回饋）。',
    causalClaimAllowed: false,
  };
}

module.exports = {
  generateRegulatoryFocusFeedback,
  FOCUS,
};
