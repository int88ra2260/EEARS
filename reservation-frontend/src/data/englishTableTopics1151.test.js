import { describe, expect, test } from 'vitest';
import {
  getEnglishTableTopic,
  getEnglishTableWarmupTaskKey,
  listEnglishTableTopicDates,
  listEnglishTableTopics,
  listEnglishTableReviewLinks,
  listEnglishTableWarmupLinks,
  normalizeEnglishTableTopicDate,
} from './englishTableTopics1151';

describe('englishTableTopics1151', () => {
  test('covers every Monday-to-Thursday session in the 115-1 handout', () => {
    expect(listEnglishTableTopicDates()).toHaveLength(40);
  });

  test('returns the topic and questions for a session date', () => {
    const session = getEnglishTableTopic('2026-10-05');
    expect(session.topic).toBe('Online Shopping');
    expect(session.format).toBe('conversation');
    expect(session.questions).toHaveLength(6);
    expect(session.questions[0]).toMatch(/bought online/);
  });

  test('accepts slash dates from event records', () => {
    expect(normalizeEnglishTableTopicDate('2026/10/8')).toBe('2026-10-08');
    expect(getEnglishTableTopic('2026/10/08')?.topic).toBe('Responsible Food Choices');
  });

  test('marks the week 4 Monday national holiday', () => {
    const session = getEnglishTableTopic('2026-09-28');
    expect(session.format).toBe('holiday');
    expect(session.questions).toEqual([]);
  });

  test('keeps Wednesday passage text with the two discussion tasks', () => {
    const session = getEnglishTableTopic('2026-12-09');
    expect(session.topic).toBe('Choosing a First Job');
    expect(session.passageTitle).toMatch(/Salary Is the Top Priority/);
    expect(session.questions).toHaveLength(2);
  });

  test('lists sessions in date order so the semester catalog can group by week', () => {
    const sessions = listEnglishTableTopics();
    expect(sessions).toHaveLength(40);
    expect(sessions[0].date).toBe('2026-09-21');
    expect(sessions[sessions.length - 1].date).toBe('2026-12-10');
    expect(sessions.map((session) => session.week)).toEqual(
      expect.arrayContaining([3, 4, 5, 6, 9, 10, 11, 12, 13, 14]),
    );
  });

  test('returns null when the date has no English Table topic', () => {
    expect(getEnglishTableTopic('2026-10-09')).toBeNull();
    expect(getEnglishTableTopic('')).toBeNull();
    expect(getEnglishTableTopic(null)).toBeNull();
  });

  test('builds stable speaking warm-up links for English Table questions', () => {
    expect(getEnglishTableWarmupTaskKey('2026-10-05', 0)).toBe('et-115-1-20261005-q1');
    const links = listEnglishTableWarmupLinks('2026-10-05');
    expect(links).toHaveLength(6);
    expect(links[0].href).toContain('/practice/speaking-diagnostic');
    expect(links[0].href).toContain('source=english-table');
    expect(links[0].href).toContain('phase=pre');
    const reviewLinks = listEnglishTableReviewLinks('2026-10-05');
    expect(reviewLinks[0].href).toContain('phase=post');
    expect(reviewLinks[0].taskKey).toBe(links[0].taskKey);
  });
});
