'use strict';

const { summarizeStartingGseGrowth } = require('../services/learningAnalytics/startingGseGrowth');
const { partitionGrowthExams } = require('../services/learningJourney/utils/usableSkillScore');

describe('usable skill scores', () => {
  it('keeps real scores and drops 0 or 1 from growth pairs', () => {
    const { usable, excludedPlaceholderScoreRows } = partitionGrowthExams([
      { retestFlag: true, deltaRawScore: -30, rawScore: 0, previousRawScore: 100 },
      { retestFlag: true, deltaRawScore: -20, rawScore: 80, previousRawScore: 1 },
      { retestFlag: true, deltaRawScore: 10, rawScore: 90, previousRawScore: 80 },
      { retestFlag: false, deltaRawScore: 10, rawScore: 90, previousRawScore: 80 },
      { retestFlag: true, deltaRawScore: null, rawScore: 0, previousRawScore: 80 },
    ]);
    expect(excludedPlaceholderScoreRows).toBe(3);
    expect(usable).toHaveLength(1);
    expect(usable[0].rawScore).toBe(90);
  });
});

describe('summarizeStartingGseGrowth', () => {
  it('groups later GSE growth by the pretest GSE band', () => {
    const rows = [
      { skill: 'reading', previousGse: 40, actualGseGrowth: 8 },
      { skill: 'reading', previousGse: 38, actualGseGrowth: 6 },
      { skill: 'reading', previousGse: 41, actualGseGrowth: 7 },
      { skill: 'reading', previousGse: 36, actualGseGrowth: 5 },
      { skill: 'reading', previousGse: 39, actualGseGrowth: -1 },
      { skill: 'reading', previousGse: 62, actualGseGrowth: 1 },
      { skill: 'reading', previousGse: 64, actualGseGrowth: -2 },
      { skill: 'reading', previousGse: 60, actualGseGrowth: 0 },
      { skill: 'reading', previousGse: 65, actualGseGrowth: -1 },
      { skill: 'reading', previousGse: 63, actualGseGrowth: 2 },
      { skill: 'listening', previousGse: 70, actualGseGrowth: 3 },
    ];

    const summary = summarizeStartingGseGrowth(rows);
    const reading = summary.find((row) => row.skill === 'reading');
    const a2Plus = reading.bands.find((band) => band.label === 'A2+');
    const b2 = reading.bands.find((band) => band.label === 'B2');
    const listening = summary.find((row) => row.skill === 'listening');

    expect(a2Plus).toEqual(expect.objectContaining({
      gseMin: 36,
      gseMax: 42,
      sampleSize: 5,
      interpretable: true,
      actualGseGrowthAverage: 5,
      improvedCount: 4,
    }));
    expect(b2).toEqual(expect.objectContaining({
      sampleSize: 5,
      interpretable: true,
      actualGseGrowthAverage: 0,
    }));
    expect(listening.bands[0]).toEqual(expect.objectContaining({
      label: 'B2+',
      sampleSize: 1,
      interpretable: false,
      actualGseGrowthAverage: null,
    }));
  });
});
