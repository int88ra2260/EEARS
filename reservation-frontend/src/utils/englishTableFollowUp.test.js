import { englishTableFollowUp, englishTablePhraseTips } from './englishTableFollowUp';

describe('englishTableFollowUp', () => {
  it('puts her sentence into the reason frame', () => {
    const followUp = englishTableFollowUp('I like the campus cafe.');
    expect(followUp.kind).toBe('reason');
    expect(followUp.phraseIds).toEqual(['pb_et_009']);
    expect(followUp.say).toBe('I like the campus cafe because ______.');
  });

  it('does not treat so much as a reason', () => {
    const followUp = englishTableFollowUp('I like it so much.');
    expect(followUp.kind).toBe('reason');
    expect(followUp.say).toBe('I like it so much because ______.');
  });

  it('asks for her own example after a reason', () => {
    const followUp = englishTableFollowUp('I like it because the drinks are cheap.');
    expect(followUp.kind).toBe('example');
    expect(followUp.phraseIds).toEqual(['pb_et_010']);
    expect(followUp.say).toBe('For example, ______.');
  });

  it('adds a reason after an example', () => {
    const followUp = englishTableFollowUp('For example, I study in the library.');
    expect(followUp.kind).toBe('reason');
    expect(followUp.say).toBe('I study in the library because ______.');
  });

  it('asks others about her topic when the answer is already full', () => {
    const followUp = englishTableFollowUp(
      'I bought a bag online because it was cheap. For example, I use it every day.'
    );
    expect(followUp.kind).toBe('question');
    expect(followUp.phraseIds).toEqual(['pb_et_006']);
    expect(followUp.say).toBe('What do you think about bag online?');
  });

  it('offers a way to continue when she already handed the turn back', () => {
    const followUp = englishTableFollowUp(
      'I like quiet cafes because I can study. For example, the library. What do you think?'
    );
    expect(followUp.kind).toBe('ready');
    expect(followUp.phraseIds).toEqual(['pb_et_007']);
  });

  it('matches other phrasebook moves', () => {
    expect(englishTableFollowUp('  ').phraseIds).toEqual(['pb_et_003']);
    expect(englishTableFollowUp("I don't know.").phraseIds).toEqual(['pb_et_003']);
    expect(englishTableFollowUp('Yes.').phraseIds).toEqual(['pb_et_004']);
    expect(englishTableFollowUp('You are wrong.').phraseIds).toEqual(['pb_et_005']);
    expect(englishTableFollowUp('Sorry, could you say that again?').phraseIds).toEqual(['pb_et_009']);
    expect(englishTableFollowUp("I'm Alex.", 'Please introduce yourself.').phraseIds).toEqual(['pb_et_001']);
    expect(englishTableFollowUp("I'm Alex.", 'Tell me about a cafe.').kind).toBe('intro');
  });

  it('resolves every suggestion to a real phrasebook card', () => {
    const samples = [
      ['', ''],
      ['I like it.', ''],
      ['I like it because it is quiet.', ''],
      ['For example, the library.', ''],
      ['Yes.', ''],
      ['You are wrong.', ''],
    ];
    samples.forEach(([sample, prompt]) => {
      const tips = englishTablePhraseTips(sample, prompt);
      expect(tips.length).toBeGreaterThan(0);
      tips.forEach((item) => {
        expect(item.activityType).toBe('English Table');
      });
    });
  });
});