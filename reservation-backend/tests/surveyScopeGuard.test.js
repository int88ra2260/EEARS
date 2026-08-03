const mockSurveyFindAll = jest.fn();
const mockSurveyFindByPk = jest.fn();
const mockEventFindByPk = jest.fn();

jest.mock('../models', () => ({
  Survey: {
    findAll: (...args) => mockSurveyFindAll(...args),
    findByPk: (...args) => mockSurveyFindByPk(...args),
  },
  SurveyModuleResponse: {},
  Event: {
    findByPk: (...args) => mockEventFindByPk(...args),
  },
  RolePermission: { findAll: jest.fn() },
  UserPermissionOverride: { findAll: jest.fn() },
  UserScope: { findAll: jest.fn() },
}));

const {
  canAccessSurveyByRecord,
  buildSurveyScopeWhere,
  buildSurveyResponseScopeWhere,
  canAccessSurveyResponse,
} = require('../services/accessControl/surveyScopeGuard');

const etSurvey = {
  id: 1,
  surveyKey: 'english_table_feedback_114_1',
  name: 'English Table Feedback',
  activityType: 'English Table',
};

const ifSurvey = {
  id: 2,
  surveyKey: 'international_forum_feedback_114_1',
  name: 'International Forum Feedback',
  activityType: 'International Forum',
};

const ecSurvey = {
  id: 3,
  surveyKey: 'english_club_feedback_114_1',
  name: 'English Club Feedback',
  activityType: 'English Club',
};

describe('surveyScopeGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSurveyFindAll.mockResolvedValue([{ id: 1 }]);
    mockSurveyFindByPk.mockResolvedValue(etSurvey);
    mockEventFindByPk.mockResolvedValue({ id: 3, eventType: 'English Table' });
  });

  it('allows admin access to any survey', () => {
    expect(canAccessSurveyByRecord({ role: 'admin' }, ifSurvey).allowed).toBe(true);
    expect(buildSurveyScopeWhere({ role: 'admin' })).toEqual({});
  });

  it('allows executive access to any survey', () => {
    const user = { role: 'teacher', teacherLevel: 'executive' };
    expect(canAccessSurveyByRecord(user, ifSurvey).allowed).toBe(true);
    expect(buildSurveyScopeWhere(user)).toEqual({});
  });

  it('allows et_manager access to English Table and English Club survey', () => {
    const user = { role: 'teacher', teacherLevel: 'et_manager' };
    expect(canAccessSurveyByRecord(user, etSurvey).allowed).toBe(true);
    expect(canAccessSurveyByRecord(user, ecSurvey).allowed).toBe(true);
    expect(buildSurveyScopeWhere(user)).not.toBeNull();
  });

  it('denies et_manager access to International Forum survey', () => {
    const user = { role: 'teacher', teacherLevel: 'et_manager' };
    const result = canAccessSurveyByRecord(user, ifSurvey);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('SURVEY_SCOPE_DENIED');
  });

  it('denies office_staff event_lead without survey permissions', () => {
    const user = { role: 'office_staff', staffLevel: 'event_lead' };
    expect(canAccessSurveyByRecord(user, ecSurvey).allowed).toBe(false);
    expect(canAccessSurveyByRecord(user, etSurvey).allowed).toBe(false);
  });

  it('denies curriculum_lead office_staff without survey scope', () => {
    const user = { role: 'office_staff', staffLevel: 'curriculum_lead' };
    expect(canAccessSurveyByRecord(user, ecSurvey).allowed).toBe(false);
  });

  it('allows jt_manager access to English Table and English Club survey', () => {
    const user = { role: 'teacher', teacherLevel: 'jt_manager' };
    expect(canAccessSurveyByRecord(user, etSurvey).allowed).toBe(true);
    expect(canAccessSurveyByRecord(user, ecSurvey).allowed).toBe(true);
    expect(buildSurveyScopeWhere(user)).not.toBeNull();
  });

  it('denies jt_manager access to International Forum survey', () => {
    const user = { role: 'teacher', teacherLevel: 'jt_manager' };
    const result = canAccessSurveyByRecord(user, ifSurvey);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('SURVEY_SCOPE_DENIED');
  });

  it('denies if_manager without productized survey scope', () => {
    expect(canAccessSurveyByRecord({ role: 'teacher', teacherLevel: 'if_manager' }, ifSurvey).allowed).toBe(false);
  });

  it('denies regular teacher and worker global survey response access', async () => {
    expect(await buildSurveyResponseScopeWhere({ role: 'teacher', teacherLevel: 'regular' }, {})).toBeNull();
    expect(await buildSurveyResponseScopeWhere({ role: 'worker' }, {})).toBeNull();
  });

  it('allows et_manager scoped response access for ET event context', async () => {
    const result = await canAccessSurveyResponse(
      { role: 'teacher', teacherLevel: 'et_manager' },
      { surveyId: 1, eventId: 3, eventType: 'English Table' }
    );
    expect(result.allowed).toBe(true);
  });

  it('denies unknown survey type by fail-close', () => {
    const result = canAccessSurveyByRecord(
      { role: 'teacher', teacherLevel: 'et_manager' },
      { id: 9, surveyKey: 'unknown', name: 'Unknown' }
    );
    expect(result.allowed).toBe(false);
  });
});
