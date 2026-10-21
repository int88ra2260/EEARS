function tokenize(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

export function splitSentences(text) {
  const parts = String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length) return parts;
  const fallback = String(text || '').trim();
  return fallback ? [fallback] : [];
}

function uniqueWords(words) {
  return [...new Set(words.filter(Boolean))].slice(0, 4);
}

function adviceForFocus(focusWords) {
  if (!focusWords.length) return '再念一次這一段，速度放慢一點。';
  return `先把這一句再念一次，特別把 ${focusWords.join('、')} 說清楚。`;
}

export function buildNextSentencePractice(targetText, wordResults = []) {
  const sentences = splitSentences(targetText);
  const words = Array.isArray(wordResults) ? wordResults : [];
  if (!sentences.length) {
    return {
      sentence: '',
      focusWords: [],
      advice: '請再念一次，把每個字說清楚。',
      complete: false,
    };
  }

  const heardNothing = words.length === 0 || words.every((word) => !word || word.status === 'unknown');
  if (heardNothing) {
    return {
      sentence: sentences[0],
      focusWords: [],
      advice: '沒有辨識到英文。請靠近麥克風，把這一句再念一次。',
      complete: false,
    };
  }

  const counts = sentences.map((sentence) => tokenize(sentence).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const weakWords = words.filter((word) => word.status === 'missing' || word.status === 'ending');

  if (total !== words.length) {
    const focusWords = uniqueWords(weakWords.map((word) => word.word));
    return {
      sentence: sentences[0],
      focusWords,
      advice: adviceForFocus(focusWords),
      complete: focusWords.length === 0,
    };
  }

  let cursor = 0;
  const grouped = sentences.map((sentence, index) => {
    const slice = words.slice(cursor, cursor + counts[index]);
    cursor += counts[index];
    return {
      sentence,
      weak: slice.filter((word) => word.status === 'missing' || word.status === 'ending'),
    };
  });
  const weakest = grouped.reduce((best, item) => (item.weak.length > best.weak.length ? item : best), grouped[0]);
  const focusWords = uniqueWords(weakest.weak.map((word) => word.word));
  if (!focusWords.length) {
    return {
      sentence: sentences[sentences.length - 1],
      focusWords: [],
      advice: '這一段的字都有聽到。可以放慢再念一次，或換下一段。',
      complete: true,
    };
  }
  return {
    sentence: weakest.sentence,
    focusWords,
    advice: adviceForFocus(focusWords),
    complete: false,
  };
}
