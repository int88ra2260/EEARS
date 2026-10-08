import { getPhrasebookItemById } from '../data/learningContent/phrasebookItems';

const FUNCTION_WORDS = new Set([
  'i', 'me', 'my', 'you', 'your', 'we', 'our', 'they', 'them', 'their',
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'am', 'be', 'been',
  'to', 'of', 'and', 'or', 'it', 'this', 'that', 'these', 'those',
  'in', 'on', 'for', 'with', 'at', 'from', 'about', 'into', 'over',
  'just', 'really', 'very', 'also', 'too', 'so', 'not', 'no',
  'do', 'did', 'does', 'can', 'could', 'would', 'should', 'will',
]);

function cleanedTranscript(transcript) {
  return String(transcript || '')
    .replace(/\s+/g, ' ')
    .replace(/^(um+|uh+|er+|hmm+|well|okay|ok|so)[, ]+/i, '')
    .trim();
}

function wordsOf(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function hasReason(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(because|since|therefore|that's why|that is why|so that|cuz|cause)\b/.test(lower)) return true;
  return /\bso\s+(i|we|they|he|she|it|this|there|the|people|students)\b/.test(lower);
}

function hasExample(text) {
  const lower = String(text || '').toLowerCase();
  return /\b(for example|for instance|such as|last week|yesterday|once|one time|when i)\b/.test(lower)
    || /\b(example|instance)\b/.test(lower);
}

function hasQuestion(text) {
  const lower = String(text || '').toLowerCase();
  if (isClarification(lower) && wordsOf(lower).length < 12) return false;
  return /\?/.test(lower) || /\b(what do you|how about you|what about you|do you think)\b/.test(lower);
}

function isClarification(text) {
  return /\b(say that again|repeat|didn't catch|did not catch|pardon|another way|what do you mean|could you explain)\b/.test(String(text || '').toLowerCase());
}

function isUnknown(text) {
  return /^(i don't know|i do not know|i'm not sure|i am not sure|no idea|i have no idea)\.?$/i.test(String(text || '').trim());
}

function isBareAgreement(text) {
  return /^(yes|yeah|yep|i agree|i agree with you|i think so|me too|same|same here)\.?$/i.test(String(text || '').trim());
}

function isHarsh(text) {
  return /\b(you are wrong|you're wrong|that's stupid|that is stupid|no way|nonsense)\b/i.test(String(text || ''));
}

function isClosing(text) {
  return /\b(nice talking|see you|goodbye|bye|catch up again|talking with you)\b/i.test(String(text || ''))
    && wordsOf(text).length <= 14
    && !hasReason(text);
}

function isIntro(text) {
  return /^(hi|hello|i'm|i am|my name is)\b/i.test(String(text || '').trim())
    && wordsOf(text).length <= 10
    && !hasReason(text);
}

function promptAsksForIntro(prompt) {
  return /\b(introduc|yourself|your name)\b/i.test(String(prompt || ''));
}

function firstClause(text) {
  const sentence = String(text || '').split(/(?<=[.!?])\s+/)[0] || '';
  return sentence
    .replace(/^(for example|for instance)[, ]+/i, '')
    .replace(/[.!?]+$/g, '')
    .trim();
}

const TOPIC_SKIP = new Set([
  'like', 'think', 'prefer', 'love', 'hate', 'want', 'bought', 'buy',
  'got', 'get', 'have', 'need', 'feel', 'believe', 'choose', 'chose',
  'use', 'study', 'studying', 'really', 'very',
]);

function topicFrom(text) {
  const claim = String(text || '').split(/\b(because|since|therefore)\b/i)[0];
  const words = wordsOf(claim).filter((word) => !FUNCTION_WORDS.has(word) && !TOPIC_SKIP.has(word));
  return words.slice(-3).join(' ');
}

function suggestion(kind, cue, phraseId, say) {
  return {
    kind,
    cue,
    phraseIds: phraseId ? [phraseId] : [],
    say: say || '',
  };
}

/**
 * 依應答指南的情境判斷這次回答還缺哪一步。
 * 句子用她剛說的話填進指南句型，不是分數。
 * @returns {{ kind: string, cue: string, phraseIds: string[], say: string }}
 */
export function englishTableFollowUp(transcript, prompt = '') {
  const text = cleanedTranscript(transcript);
  if (!text) {
    return suggestion(
      'unheard',
      '沒有辨識到英文。請再錄一次。現場如果卡住，可以這樣開頭。',
      'pb_et_003',
      "That's a good question. Let me ______."
    );
  }

  if (isUnknown(text)) {
    return suggestion(
      'unsure',
      '這句還不像回答。現場可以先爭取時間，再補你的看法。',
      'pb_et_003',
      "That's a good question. Let me ______."
    );
  }

  if (isClarification(text) && wordsOf(text).length < 12) {
    return suggestion(
      'clarify',
      '這比較像請對方再說一次。輪到你時，補上你自己的理由。',
      'pb_et_009',
      'I think ______ because ______.'
    );
  }

  if (isHarsh(text)) {
    return suggestion(
      'disagree',
      '這句會讓討論變硬。可以先接住對方，再講你的不同看法。',
      'pb_et_005',
      'I see your point, but ______.'
    );
  }

  if (isBareAgreement(text)) {
    return suggestion(
      'agree',
      '你同意了，但話停在這裡。同意後再補一句你自己的看法。',
      'pb_et_004',
      'I agree, and I also think ______.'
    );
  }

  if (isClosing(text)) {
    return suggestion(
      'close',
      '這比較像在結束。先留下你的理由，最後再道別。',
      'pb_et_009',
      'I think ______ because ______.'
    );
  }

  if (isIntro(text)) {
    const name = text.match(/\b(?:i'm|i am|my name is)\s+([A-Za-z]+)/i)?.[1];
    if (promptAsksForIntro(prompt)) {
      return suggestion(
        'intro',
        '名字之後再補一個科系、興趣，或你為什麼來。',
        'pb_et_001',
        name ? `Hi, I'm ${name}. I'm a ______ student.` : "Hi, I'm ______. I'm a ______ student."
      );
    }
    return suggestion(
      'intro',
      '這比較像自我介紹。先回答題目，再補一個理由。',
      'pb_et_009',
      'I think ______ because ______.'
    );
  }

  const clause = firstClause(text);
  const shortClause = wordsOf(clause).length > 14
    ? wordsOf(clause).slice(0, 14).join(' ')
    : clause;

  if (!hasReason(text)) {
    const say = shortClause
      ? `${shortClause} because ______.`.replace(/\s+/g, ' ')
      : 'I think ______ because ______.';
    return suggestion(
      'reason',
      '再補一個理由，接在你剛說的話後面。',
      'pb_et_009',
      say.charAt(0).toUpperCase() + say.slice(1)
    );
  }

  if (!hasExample(text)) {
    return suggestion(
      'example',
      '你已經有理由。再補一個自己的例子，會比較好接。',
      'pb_et_010',
      'For example, ______.'
    );
  }

  if (!hasQuestion(text)) {
    const topic = topicFrom(text);
    return suggestion(
      'question',
      '這句已經有理由和例子。接著把話交回去。',
      'pb_et_006',
      topic ? `What do you think about ${topic}?` : 'What do you think about that?'
    );
  }

  return suggestion(
    'ready',
    '這句可以直接帶去現場。別人說到類似的事時，可以這樣接。',
    'pb_et_007',
    'That reminds me of ______.'
  );
}

export function englishTablePhraseTips(transcript, prompt = '') {
  return englishTableFollowUp(transcript, prompt).phraseIds
    .map((id) => getPhrasebookItemById(id))
    .filter(Boolean);
}
