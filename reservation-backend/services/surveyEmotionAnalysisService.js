/**
 * 問卷情緒分析服務
 * 
 * 分析問卷開放式回答的情緒傾向與關鍵主題。
 * 支援兩種模式：
 * 1. OpenAI API（若設定 OPENAI_API_KEY）
 * 2. 本地詞典分析（fallback）
 */
const { Op } = require('sequelize');
const { SurveyModuleResponse, SurveyResponseAnswer } = require('../models');
const logger = require('../utils/logger');

// 情緒類型定義
const EMOTION_TYPES = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  MIXED: 'mixed',
};

// 中文情緒詞典（本地分析 fallback）
const EMOTION_LEXICON = {
  positive: [
    '喜歡', '很棒', '很好', '滿意', '開心', '高興', '感謝', '謝謝', '有趣', '有幫助',
    '收穫', '學到', '進步', '成長', '推薦', '讚', '優秀', '專業', '親切', '熱心',
    '耐心', '清楚', '實用', '受益', '精彩', '豐富', '充實', '愉快', '享受', '期待',
    '非常好', '太棒', '超讚', '很讚', '值得', '幸運', '感動', '驚喜', '完美', '優質',
    'good', 'great', 'excellent', 'helpful', 'interesting', 'useful', 'thanks', 'like',
  ],
  negative: [
    '不喜歡', '不好', '差', '失望', '無聊', '浪費', '困難', '聽不懂', '不清楚', '混亂',
    '太難', '太快', '太慢', '不夠', '缺乏', '問題', '改進', '建議', '希望', '可惜',
    '抱怨', '麻煩', '討厭', '糟糕', '爛', '差勁', '不滿', '無趣', '沉悶', '緊張',
    '壓力', '焦慮', '害怕', '擔心', '困惑', '不懂', '難過', '遺憾', '後悔', '不推薦',
    'bad', 'boring', 'difficult', 'confusing', 'disappointed', 'waste', 'problem',
  ],
  intensifiers: ['很', '非常', '太', '超', '極', '相當', '特別', '真的', '完全', '絕對'],
  negators: ['不', '沒', '未', '無', '別', '勿', '非', '否'],
};

/**
 * 本地情緒分析（基於詞典）
 * @param {string} text - 待分析文字
 * @returns {{ emotion: string, confidence: number, keywords: string[] }}
 */
function analyzeEmotionLocal(text) {
  if (!text || typeof text !== 'string') {
    return { emotion: EMOTION_TYPES.NEUTRAL, confidence: 0, keywords: [] };
  }

  const normalizedText = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;
  const keywords = [];

  // 檢查正面詞
  for (const word of EMOTION_LEXICON.positive) {
    const regex = new RegExp(word, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      positiveScore += matches.length;
      keywords.push(word);
    }
  }

  // 檢查負面詞
  for (const word of EMOTION_LEXICON.negative) {
    const regex = new RegExp(word, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      negativeScore += matches.length;
      keywords.push(word);
    }
  }

  // 檢查否定詞（可能反轉情緒）
  for (const negator of EMOTION_LEXICON.negators) {
    for (const posWord of EMOTION_LEXICON.positive.slice(0, 20)) {
      if (normalizedText.includes(`${negator}${posWord}`)) {
        positiveScore -= 1;
        negativeScore += 0.5;
      }
    }
  }

  // 計算情緒
  const totalScore = positiveScore + negativeScore;
  if (totalScore === 0) {
    return { emotion: EMOTION_TYPES.NEUTRAL, confidence: 0.5, keywords: [] };
  }

  const positiveRatio = positiveScore / totalScore;
  const negativeRatio = negativeScore / totalScore;

  let emotion;
  let confidence;

  if (positiveScore > 0 && negativeScore > 0 && Math.abs(positiveRatio - negativeRatio) < 0.3) {
    emotion = EMOTION_TYPES.MIXED;
    confidence = 0.6;
  } else if (positiveScore > negativeScore) {
    emotion = EMOTION_TYPES.POSITIVE;
    confidence = Math.min(0.5 + positiveRatio * 0.4, 0.9);
  } else if (negativeScore > positiveScore) {
    emotion = EMOTION_TYPES.NEGATIVE;
    confidence = Math.min(0.5 + negativeRatio * 0.4, 0.9);
  } else {
    emotion = EMOTION_TYPES.NEUTRAL;
    confidence = 0.5;
  }

  return { emotion, confidence: Math.round(confidence * 100) / 100, keywords: [...new Set(keywords)].slice(0, 5) };
}

/**
 * OpenAI API 情緒分析
 * @param {string} text - 待分析文字
 * @returns {Promise<{ emotion: string, confidence: number, keywords: string[], topics: string[] }>}
 */
async function analyzeEmotionOpenAI(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是一個專業的情緒分析助手，專門分析教育活動問卷回饋。
請分析使用者提供的問卷回答文字，並以 JSON 格式回覆：
{
  "emotion": "positive" | "negative" | "neutral" | "mixed",
  "confidence": 0.0-1.0,
  "keywords": ["關鍵詞1", "關鍵詞2", ...],
  "topics": ["主題1", "主題2", ...],
  "summary": "一句話摘要"
}
- emotion: 整體情緒傾向
- confidence: 判斷信心度 (0-1)
- keywords: 文中提及的情緒關鍵詞（最多5個）
- topics: 文中討論的主題（如：教學、活動、環境等，最多3個）
- summary: 一句話摘要這則回饋的核心意見`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn(`[EmotionAnalysis] OpenAI API error: ${response.status} ${errText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // 嘗試解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      emotion: result.emotion || EMOTION_TYPES.NEUTRAL,
      confidence: result.confidence || 0.5,
      keywords: result.keywords || [],
      topics: result.topics || [],
      summary: result.summary || '',
    };
  } catch (err) {
    logger.warn(`[EmotionAnalysis] OpenAI analysis failed: ${err.message}`);
    throw err;
  }
}

/**
 * 分析單一回答的情緒
 * @param {string} text - 回答文字
 * @param {{ useAI?: boolean }} options - 選項
 */
async function analyzeResponseEmotion(text, options = {}) {
  const useAI = options.useAI !== false && process.env.OPENAI_API_KEY;

  if (useAI) {
    try {
      return await analyzeEmotionOpenAI(text);
    } catch (err) {
      // fallback to local
      logger.info('[EmotionAnalysis] Falling back to local analysis');
    }
  }

  return analyzeEmotionLocal(text);
}

/**
 * 批次分析問卷回答情緒
 * @param {Object} query - 查詢條件
 * @param {{ useAI?: boolean, limit?: number }} options - 選項
 */
async function analyzeResponsesEmotion(query = {}, options = {}) {
  const limit = Math.min(options.limit || 100, 500);
  const useAI = options.useAI !== false && process.env.OPENAI_API_KEY;

  // 構建查詢條件
  const where = {};
  if (query.semesterId) where.semesterId = query.semesterId;
  if (query.surveyId) where.surveyId = query.surveyId;
  if (query.versionId) where.surveyVersionId = query.versionId;
  if (query.activityType) where.activityType = query.activityType;
  if (query.eventId) where.eventId = query.eventId;
  if (query.__scopeWhere) Object.assign(where, query.__scopeWhere);

  // 取得回應 ID
  const responseRows = await SurveyModuleResponse.findAll({
    where,
    attributes: ['id'],
    order: [['createdAt', 'DESC']],
    limit: limit * 2,
  });

  const responseIds = responseRows.map((r) => r.id);
  if (!responseIds.length) {
    return {
      total: 0,
      analyzed: 0,
      distribution: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
      averageConfidence: 0,
      topKeywords: [],
      topTopics: [],
      samples: [],
      analysisMode: useAI ? 'ai' : 'local',
    };
  }

  // 取得開放式回答
  const answerWhere = {
    responseId: { [Op.in]: responseIds },
    answerText: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
  };
  if (query.questionKey) answerWhere.questionKey = query.questionKey;

  const answers = await SurveyResponseAnswer.findAll({
    where: answerWhere,
    attributes: ['id', 'responseId', 'questionKey', 'answerText', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit,
    raw: true,
  });

  // 過濾有效回答（至少 5 個字）
  const validAnswers = answers.filter((a) => a.answerText && String(a.answerText).trim().length >= 5);

  if (!validAnswers.length) {
    return {
      total: answers.length,
      analyzed: 0,
      distribution: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
      averageConfidence: 0,
      topKeywords: [],
      topTopics: [],
      samples: [],
      analysisMode: useAI ? 'ai' : 'local',
    };
  }

  // 分析情緒（限制並行數）
  const distribution = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  const keywordCount = {};
  const topicCount = {};
  const results = [];
  let totalConfidence = 0;

  // 若使用 AI，限制請求數量避免 rate limit
  const maxAIRequests = useAI ? Math.min(validAnswers.length, 50) : validAnswers.length;
  const answersToAnalyze = validAnswers.slice(0, maxAIRequests);

  for (const answer of answersToAnalyze) {
    try {
      const analysis = await analyzeResponseEmotion(answer.answerText, { useAI });

      distribution[analysis.emotion] = (distribution[analysis.emotion] || 0) + 1;
      totalConfidence += analysis.confidence;

      // 統計關鍵詞
      (analysis.keywords || []).forEach((kw) => {
        keywordCount[kw] = (keywordCount[kw] || 0) + 1;
      });

      // 統計主題
      (analysis.topics || []).forEach((t) => {
        topicCount[t] = (topicCount[t] || 0) + 1;
      });

      results.push({
        answerId: answer.id,
        responseId: answer.responseId,
        questionKey: answer.questionKey,
        text: answer.answerText.substring(0, 200),
        emotion: analysis.emotion,
        confidence: analysis.confidence,
        keywords: analysis.keywords,
        topics: analysis.topics,
        summary: analysis.summary,
        createdAt: answer.createdAt,
      });
    } catch (err) {
      logger.warn(`[EmotionAnalysis] Failed to analyze answer ${answer.id}: ${err.message}`);
    }
  }

  // 排序關鍵詞和主題
  const topKeywords = Object.entries(keywordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([keyword, count]) => ({ keyword, count }));

  const topTopics = Object.entries(topicCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  // 取得代表性樣本（每種情緒各取幾則）
  const samples = [];
  const samplesByEmotion = {};
  for (const r of results) {
    if (!samplesByEmotion[r.emotion]) samplesByEmotion[r.emotion] = [];
    if (samplesByEmotion[r.emotion].length < 3) {
      samplesByEmotion[r.emotion].push(r);
    }
  }
  Object.values(samplesByEmotion).forEach((arr) => samples.push(...arr));

  return {
    total: validAnswers.length,
    analyzed: results.length,
    distribution,
    averageConfidence: results.length > 0 ? Math.round((totalConfidence / results.length) * 100) / 100 : 0,
    topKeywords,
    topTopics,
    samples: samples.slice(0, 12),
    analysisMode: useAI ? 'ai' : 'local',
  };
}

/**
 * 取得情緒分析摘要統計
 * @param {Object} query - 查詢條件
 */
async function getEmotionSummary(query = {}) {
  return analyzeResponsesEmotion(query, { useAI: true, limit: 100 });
}

module.exports = {
  EMOTION_TYPES,
  analyzeResponseEmotion,
  analyzeResponsesEmotion,
  getEmotionSummary,
  analyzeEmotionLocal,
};
