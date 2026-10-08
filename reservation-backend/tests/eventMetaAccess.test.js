'use strict';

const { decideEventMetaAccess } = require('../services/etGrouping/eventMetaAccess');

describe('decideEventMetaAccess', () => {
  const leader = { role: 'leader' };

  it('lets an assigned leader read an English Table event', () => {
    expect(decideEventMetaAccess(leader, 'english_table', 1)).toBe('ok');
  });

  it('refuses a leader who is not assigned to the event', () => {
    expect(decideEventMetaAccess(leader, 'english_table', 0)).toBe('unassigned');
  });

  it('refuses a leader for a non English Table event', () => {
    expect(decideEventMetaAccess(leader, 'job_talk', 2)).toBe('denied');
  });

  it('refuses a user without reservation or leader mark permission', () => {
    expect(decideEventMetaAccess({ role: 'teacher', teacherLevel: 'regular' }, 'english_table', 1)).toBe('denied');
  });
});
