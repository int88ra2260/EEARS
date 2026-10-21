import { buildNextSentencePractice, splitSentences } from './speakingCheckFeedback';

const PASSAGE = 'The university library is quiet, and many students study there after class. Please keep your voice low. You can borrow books at the front desk.';

describe('speakingCheckFeedback', () => {
  test('splits a short passage into sentences', () => {
    expect(splitSentences(PASSAGE)).toEqual([
      'The university library is quiet, and many students study there after class.',
      'Please keep your voice low.',
      'You can borrow books at the front desk.',
    ]);
  });

  test('points practice at the sentence with missing words', () => {
    const words = PASSAGE
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((word, index) => ({
        word,
        status: word === 'quiet' || word === 'library' ? 'missing' : 'matched',
        index,
      }));

    const practice = buildNextSentencePractice(PASSAGE, words);
    expect(practice.sentence).toContain('university library');
    expect(practice.focusWords).toEqual(['library', 'quiet']);
    expect(practice.advice).toContain('library、quiet');
    expect(practice.complete).toBe(false);
  });

  test('asks for a slower reread when every word was heard', () => {
    const words = 'please keep your voice low'
      .split(' ')
      .map((word, index) => ({ word, status: 'matched', index }));
    const practice = buildNextSentencePractice('Please keep your voice low.', words);
    expect(practice.complete).toBe(true);
    expect(practice.focusWords).toEqual([]);
    expect(practice.advice).toContain('都有聽到');
  });

  test('asks the student to move closer when nothing was recognized', () => {
    const practice = buildNextSentencePractice(PASSAGE, []);
    expect(practice.sentence).toContain('university library');
    expect(practice.advice).toContain('沒有辨識到英文');
  });
});
