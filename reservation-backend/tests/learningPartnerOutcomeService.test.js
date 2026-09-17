const {
  computeLearningPartnerOutcomeComparison,
  summarizeScoreGroup,
} = require('../services/learningPartnerOutcomeService');

describe('learningPartnerOutcomeService', () => {
  test('summarizeScoreGroup computes avg/median/pass rate', () => {
    const summary = summarizeScoreGroup([
      {
        studentId: 'A',
        totalScore: 700,
        listeningScore: 180,
        readingScore: 170,
        speakingScore: 175,
        writingScore: 175,
        passed: true,
      },
      {
        studentId: 'B',
        totalScore: 600,
        listeningScore: 150,
        readingScore: 150,
        speakingScore: 150,
        writingScore: 150,
        passed: false,
      },
      {
        studentId: 'C',
        totalScore: null,
        listeningScore: null,
        readingScore: null,
        speakingScore: null,
        writingScore: null,
        passed: false,
      },
    ]);

    expect(summary.studentCount).toBe(3);
    expect(summary.withTotalScoreCount).toBe(2);
    expect(summary.avgTotalScore).toBe(650);
    expect(summary.medianTotalScore).toBe(650);
    expect(summary.passedCount).toBe(1);
    expect(summary.passRatePct).toBe(33.3);
    expect(summary.skills.listening.avg).toBe(165);
  });

  test('computeLearningPartnerOutcomeComparison builds partner vs non-partner delta', () => {
    const result = computeLearningPartnerOutcomeComparison({
      semester: '114-2',
      partnerMemberIds: ['P001', 'P002', 'P003'],
      partnerScores: [
        {
          studentId: 'P001',
          totalScore: 720,
          listeningScore: 180,
          readingScore: 180,
          speakingScore: 180,
          writingScore: 180,
          passed: true,
        },
        {
          studentId: 'P002',
          totalScore: 680,
          listeningScore: 170,
          readingScore: 170,
          speakingScore: 170,
          writingScore: 170,
          passed: false,
        },
      ],
      nonPartnerScores: [
        {
          studentId: 'N001',
          totalScore: 600,
          listeningScore: 150,
          readingScore: 150,
          speakingScore: 150,
          writingScore: 150,
          passed: false,
        },
        {
          studentId: 'N002',
          totalScore: 640,
          listeningScore: 160,
          readingScore: 160,
          speakingScore: 160,
          writingScore: 160,
          passed: false,
        },
      ],
    });

    expect(result.coverage.partnerMemberCount).toBe(3);
    expect(result.coverage.partnerWithScoreCount).toBe(2);
    expect(result.coverage.partnerWithoutScoreCount).toBe(1);
    expect(result.coverage.nonPartnerWithScoreCount).toBe(2);

    expect(result.partner.avgTotalScore).toBe(700);
    expect(result.nonPartner.avgTotalScore).toBe(620);
    expect(result.delta.avgTotalScore).toBe(80);
    expect(result.delta.passRatePctPoints).toBe(50);
    expect(result.delta.skills.listening.avg).toBe(20);
  });
});
