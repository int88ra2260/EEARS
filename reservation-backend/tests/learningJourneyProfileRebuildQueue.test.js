'use strict';

jest.mock('../models', () => ({
  Student: {},
  StudentSemesterProfile: {},
  ExamAttempt: {},
}));

jest.mock('../services/learningJourney/learningJourneyProfileService', () => ({
  getStudentProfile: jest.fn(),
}));

const { enqueueProfileRebuild } = require('../services/learningJourney/learningJourneyRebuildService');

describe('learning journey profile rebuild queue', () => {
  test('runs overlapping rebuilds one after another', async () => {
    const order = [];
    let releaseFirst;
    const gate = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const first = enqueueProfileRebuild(async () => {
      order.push('start-1');
      await gate;
      order.push('end-1');
    });
    const second = enqueueProfileRebuild(async () => {
      order.push('start-2');
    });

    await Promise.resolve();
    expect(order).toEqual(['start-1']);
    releaseFirst();
    await first;
    await second;
    expect(order).toEqual(['start-1', 'end-1', 'start-2']);
  });
});
