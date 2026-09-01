import { FREQUENCY_WORD_BANK, getWordsForBand } from './frequencyBank';
import { FREQUENCY_BANDS, WORDS_PER_BAND } from './constants';

describe('vocabularySize frequencyBank', () => {
  test('bank has at least 250 words', () => {
    expect(FREQUENCY_WORD_BANK.length).toBeGreaterThanOrEqual(250);
  });

  test('each band has enough words for sampling', () => {
    for (const bandMeta of FREQUENCY_BANDS) {
      expect(getWordsForBand(bandMeta.band).length).toBeGreaterThanOrEqual(WORDS_PER_BAND);
    }
  });
});
