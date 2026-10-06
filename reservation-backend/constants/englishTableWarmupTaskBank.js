'use strict';

const sessions = require('../../reservation-frontend/src/data/englishTableTopics1151.json');

const SEMESTER = '115-1';
const STOP_WORDS = new Set([
  'about', 'after', 'also', 'among', 'and', 'are', 'because', 'before', 'both',
  'could', 'does', 'each', 'every', 'explain', 'from', 'give', 'have', 'help',
  'many', 'might', 'more', 'most', 'should', 'some', 'that', 'their', 'there',
  'these', 'they', 'this', 'what', 'when', 'where', 'which', 'while', 'with',
  'would', 'your', 'you',
]);

function taskKeyForEnglishTableWarmup(date, questionIndex) {
  return `et-${SEMESTER.toLowerCase()}-${String(date).replace(/-/g, '')}-q${questionIndex + 1}`;
}

function wordsOf(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function titleFor(session, questionIndex) {
  return `English Table W${session.week}: ${session.topic} Q${questionIndex + 1}`;
}

function inferLevel(session, questionIndex) {
  if (session.format === 'conversation') {
    if (questionIndex <= 1) return 'A2';
    if (questionIndex <= 3) return 'B1';
    return 'B2';
  }
  if (session.format === 'passage') return questionIndex === 0 ? 'B1' : 'B2';
  if (session.format === 'chart') return questionIndex <= 1 ? 'B1' : 'B2';
  if (session.format === 'discussion') {
    if (questionIndex <= 1) return 'A2';
    if (questionIndex <= 3) return 'B1';
    return 'B2';
  }
  return 'B1';
}

function inferTaskType(session, questionIndex) {
  if (session.format === 'conversation') return questionIndex <= 3 ? 'campus_short_answer' : 'opinion_response';
  if (session.format === 'passage' || session.format === 'chart') return 'opinion_response';
  return questionIndex <= 1 ? 'campus_short_answer' : 'opinion_response';
}

function inferCommunicationFunction(session, questionIndex) {
  if (session.format === 'chart') return questionIndex === 0 ? 'summarize_lecture' : 'compare_ideas';
  if (session.format === 'passage') return questionIndex === 0 ? 'summarize_lecture' : 'give_opinion';
  if (questionIndex >= 4) return 'give_opinion';
  if (/recommend|advice|suggest/i.test(session.questions?.[questionIndex] || '')) return 'give_opinion';
  return 'define_concept';
}

function targetWordsFor(level) {
  if (level === 'A2') return 35;
  if (level === 'B1') return 55;
  return 75;
}

function estimatedSecondsFor(level) {
  if (level === 'A2') return 35;
  if (level === 'B1') return 50;
  return 65;
}

function targetVocabularyFor(session, question) {
  const tokens = wordsOf(`${session.topic} ${session.lead || ''} ${question}`);
  const seen = new Set();
  return tokens
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .filter((word) => {
      if (seen.has(word)) return false;
      seen.add(word);
      return true;
    })
    .slice(0, 12);
}

function focusTagsFor(session) {
  return ['english_table', session.format, String(session.topic || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')]
    .filter(Boolean);
}

function buildPrompt(session, question) {
  if (session.passageTitle || session.passage) {
    return [
      session.passageTitle ? `Passage: ${session.passageTitle}` : null,
      session.passage || null,
      `Question: ${question}`,
    ].filter(Boolean).join('\n\n');
  }
  if (session.lead) return `${session.lead}\n\n${question}`;
  return question;
}

function buildEnglishTableWarmupTasks() {
  return Object.entries(sessions)
    .flatMap(([date, session]) => {
      if (!session || session.format === 'holiday' || !Array.isArray(session.questions)) return [];
      return session.questions.map((question, questionIndex) => {
        const level = inferLevel(session, questionIndex);
        return {
          taskKey: taskKeyForEnglishTableWarmup(date, questionIndex),
          level,
          taskType: inferTaskType(session, questionIndex),
          title: titleFor(session, questionIndex),
          prompt: buildPrompt(session, question),
          targetText: 'Answer the English Table question with a clear main idea, relevant details, and a short closing statement.',
          estimatedSeconds: estimatedSecondsFor(level),
          targetWords: targetWordsFor(level),
          focusTags: focusTagsFor(session),
          constructTags: ['fluency', 'vocabulary', 'grammar', 'task_achievement', 'coherence'],
          discipline: 'Campus EMI',
          communicationFunction: inferCommunicationFunction(session, questionIndex),
          targetVocabulary: targetVocabularyFor(session, question),
          teacherGoal: `English Table ${SEMESTER} warm-up: prepare students to speak about "${session.topic}" before joining the live table session.`,
          linkedCourse: null,
          linkedActivity: 'English Table',
          suggestedSupports: ['English Table', 'Speaking Salon', '1-on-1 Consultation'],
          teacherNotes: `Auto-generated from English Table ${SEMESTER}, ${date}, ${session.week ? `week ${session.week}, ` : ''}${session.weekday || ''}.`,
        };
      });
    });
}

const ENGLISH_TABLE_WARMUP_TASKS = buildEnglishTableWarmupTasks();

module.exports = {
  ENGLISH_TABLE_WARMUP_TASKS,
  taskKeyForEnglishTableWarmup,
};
