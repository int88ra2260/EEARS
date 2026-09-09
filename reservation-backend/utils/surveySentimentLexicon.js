/**
 * 問卷開放題情緒詞典（中英）
 * 採規則／詞典法，免外部 NLP API，適合校內 IIS 部署。
 */

const POSITIVE_ZH = [
  '非常滿意', '很滿意', '太棒', '超棒', '很棒', '真棒', '優秀', '出色', '精彩',
  '收穫很多', '收穫良多', '很有幫助', '非常有幫助', '幫助很大', '受益匪淺',
  '進步很多', '明顯進步', '提升很多', '學到很多', '獲益良多',
  '喜歡', '喜愛', '推薦', '值得', '感謝', '謝謝', '感恩',
  '有趣', '有意思', '開心', '愉快', '快樂', '高興', '輕鬆', '溫馨',
  '友善', '親切', '耐心', '專業', '清楚', '充實', '豐富', '實用',
  '滿意', '肯定', '正面', '支持', '鼓勵', '讚',
  '改善', '成長', '進步', '提升', '幫助',
];

const NEGATIVE_ZH = [
  '非常不滿意', '很不滿意', '不太滿意', '不滿意', '失望', '遺憾',
  '沒有幫助', '沒什麼幫助', '幫助不大', '沒學到', '收穫很少', '收穫不多',
  '浪費時間', '太難', '太簡單', '聽不懂', '看不懂', '不清楚',
  '無聊', '乏味', '枯燥', '混亂', '雜亂', '匆忙', '倉促',
  '不耐煩', '不友善', '態度差', '太快', '太慢', '太吵',
  '抱怨', '不滿', '糟糕', '差勁',
  '問題', '困難', '壓力', '焦慮', '挫折', '無聊透頂',
  '不推薦', '不想再', '不要再', '沒意思', '沒意義',
];

const POSITIVE_EN = [
  'excellent', 'amazing', 'awesome', 'wonderful', 'fantastic', 'great', 'good',
  'helpful', 'useful', 'valuable', 'beneficial', 'informative', 'interesting',
  'enjoyable', 'enjoyed', 'love', 'loved', 'like', 'liked', 'recommend',
  'satisfied', 'satisfaction', 'positive', 'clear', 'friendly', 'patient',
  'professional', 'supportive', 'encouraging', 'improved', 'improvement',
  'progress', 'learned', 'learning', 'thank', 'thanks', 'appreciate',
  'worthwhile', 'engaging', 'fun', 'happy', 'glad', 'pleased',
];

const NEGATIVE_EN = [
  'terrible', 'awful', 'horrible', 'bad', 'poor', 'worst', 'disappointing',
  'disappointed', 'useless', 'unhelpful', 'confusing', 'confused', 'boring',
  'bored', 'waste', 'wasted', 'difficult', 'unclear', 'rushed', 'noisy',
  'unfriendly', 'frustrated', 'frustration', 'anxious', 'stress', 'stressed',
  'hate', 'dislike', 'negative', 'complaint', 'complain', 'problem',
  'issues', 'issue', 'insufficient', 'inadequate', 'meaningless',
];

/** 否定詞：翻轉隨後命中的情緒 */
const NEGATORS_ZH = ['不是', '並非', '沒有', '沒', '不', '非', '未'];
const NEGATORS_EN = ['not', 'no', 'never', 'neither', 'hardly', 'barely', "n't", 'cannot', "can't", 'dont', "don't"];

/** 程度副詞：加權 */
const INTENSIFIERS_ZH = ['非常', '十分', '極其', '特別', '超級', '超', '很', '太', '相當', '頗'];
const INTENSIFIERS_EN = ['very', 'really', 'extremely', 'highly', 'so', 'quite', 'totally', 'absolutely'];

function sortByLengthDesc(list) {
  return [...list].sort((a, b) => b.length - a.length);
}

const LEXICON = {
  positiveZh: sortByLengthDesc(POSITIVE_ZH),
  negativeZh: sortByLengthDesc(NEGATIVE_ZH),
  positiveEn: POSITIVE_EN,
  negativeEn: NEGATIVE_EN,
  negatorsZh: sortByLengthDesc(NEGATORS_ZH),
  negatorsEn: NEGATORS_EN,
  intensifiersZh: sortByLengthDesc(INTENSIFIERS_ZH),
  intensifiersEn: INTENSIFIERS_EN,
};

module.exports = {
  LEXICON,
  POSITIVE_ZH,
  NEGATIVE_ZH,
  POSITIVE_EN,
  NEGATIVE_EN,
};
