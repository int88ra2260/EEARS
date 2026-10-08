'use strict';

function dateKey(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function practiceTokens(transcript) {
  return String(transcript || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function leaderDiscussionCue(transcript) {
  const text = String(transcript || '').trim();
  if (!text) return '沒有辨識到英文，可以請他用一句話重講。';
  const tokens = practiceTokens(text);
  if (tokens.some((word) => ['because', 'since', 'therefore', 'so'].includes(word))) {
    return '他有說理由，可以請別人同意或反對。';
  }
  if (tokens.some((word) => word === 'example' || word === 'instance')) {
    return '他有舉例子，可以請他補原因。';
  }
  return '他還沒說原因，可以請他用 because 補一句。';
}

function firstHeardSentence(transcript) {
  const text = String(transcript || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  const sentence = (match ? match[0] : text).trim();
  return sentence.length > 160 ? `${sentence.slice(0, 157)}…` : sentence;
}

function isEnglishTablePractice(features, eventDate) {
  const context = features && typeof features === 'object' ? features.context : null;
  if (!context || typeof context !== 'object') return false;
  if (dateKey(context.activityDate) !== dateKey(eventDate)) return false;
  const activity = String(context.linkedActivity || '');
  return activity === 'English Table';
}

module.exports = {
  dateKey,
  leaderDiscussionCue,
  firstHeardSentence,
  isEnglishTablePractice,
};
