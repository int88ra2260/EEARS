'use strict';



const { buildGrowthView, SKILL_LABELS } = require('../services/learningAnalytics/learningAnalyticsGrowthService');



describe('learningAnalyticsGrowthService', () => {

  const lvaFixture = {

    growthEpisodes: {

      retestRows: 3,

      estimateType: 'descriptive',

      bySkill: [

        {

          skill: 'listening',

          sampleSize: 2,

          rawGrowthAverage: 25,

          confidenceInterval: [10, 40],

        },

        {

          skill: 'speaking',

          sampleSize: 1,

          rawGrowthAverage: -5,

          confidenceInterval: null,

        },

      ],

      sampleEpisodes: [

        {

          studentId: 'S001',

          skill: 'listening',

          instrument: 'TOEIC',

          examDate: '2026-01-15',

          previousRawScore: 500,

          rawScore: 550,

          rawGrowth: 50,

          weightedGrowth: 37.5,

          exposureBeforeExam: {

            courseHours: 18,

            activityHours: 2,

            resourceHours: 20,

          },

          evidenceQuality: 'medium',

        },

        {

          studentId: 'S002',

          skill: 'listening',

          instrument: 'TOEIC',

          examDate: '2026-02-01',

          previousRawScore: 480,

          rawScore: 490,

          rawGrowth: 10,

          weightedGrowth: 5,

          exposureBeforeExam: {

            courseHours: 0,

            activityHours: 1,

            resourceHours: 1,

          },

          evidenceQuality: 'low',

        },

      ],

    },

    adjustedGrowth: {

      bySkill: [

        { skill: 'listening', sampleSize: 2, adjustedGseGrowthAverage: 12.5 },

      ],

      sampleEpisodes: [

        {

          studentId: 'S001',

          skill: 'listening',

          instrument: 'TOEIC',

          actualGseGrowth: 20,

          adjustedGseGrowth: 15,

          expectedGseGrowth: 5,

          previousGse: 60,

          postGse: 80,

        },

      ],

    },

    estimatePolicy: { descriptive: 'descriptive_estimate' },

  };



  it('enriches growth episodes with time window and traceability', () => {

    const view = buildGrowthView(lvaFixture);

    expect(view.summary.retestCount).toBe(3);

    expect(view.episodes).toHaveLength(2);

    expect(view.episodes[0].timeWindow.courseHoursBeforeExam).toBe(18);

    expect(view.episodes[0].skillLabel).toBe(SKILL_LABELS.listening);

    expect(view.episodes[0].adjustedGseGrowth).toBe(15);

    expect(view.episodes[0].traceability.studentId).toBe('S001');

  });



  it('computes growth student ratio per skill', () => {

    const view = buildGrowthView(lvaFixture);

    const listening = view.bySkill.find((row) => row.skill === 'listening');

    expect(listening.growthStudentRatio).toBe(1);

    expect(listening.improvedCount).toBe(2);

    expect(listening.label).toBe('聽力');

  });



  it('builds radar chart data for skills with growth samples', () => {

    const view = buildGrowthView(lvaFixture);

    expect(view.radar.length).toBeGreaterThanOrEqual(1);

    const listening = view.radar.find((row) => row.skill === 'listening');

    expect(listening.rawGrowthAverage).toBe(25);

    expect(listening.adjustedGseGrowthAverage).toBe(12.5);

  });

});

