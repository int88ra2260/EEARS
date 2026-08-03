/**
 * 各 teacherLevel 權限／範圍矩陣（與 accessProfile + scope guards 對齊）
 */
const { P } = require('../auth/permissions');
const { SCOPE } = require('../auth/scopes');
const { buildAccessProfile } = require('../auth/accessProfile');
const { buildClassScopeWhere } = require('../services/accessControl/classScopeGuard');
const { canAccessEventByRecord } = require('../services/accessControl/eventScopeGuard');
const { canAccessSurveyByRecord } = require('../services/accessControl/surveyScopeGuard');

const event = (eventType) => ({ id: 1, eventType });
const etSurvey = { surveyKey: 'english_table_feedback', name: 'English Table Feedback' };
const ifSurvey = { surveyKey: 'international_forum_feedback', name: 'International Forum' };

function profileFor(level, name = 'Teacher') {
  return buildAccessProfile({ role: 'teacher', teacherLevel: level, name });
}

function userFor(level, name = 'Teacher') {
  return { role: 'teacher', teacherLevel: level, name };
}

describe('teacher role access matrix', () => {
  describe('base permissions', () => {
    it('regular: own classes + teaching dashboard only; no LJ tracking', () => {
      const p = profileFor('regular');
      expect(p.permissionSet.has(P.CAN_VIEW_CLASSES)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ANALYTICS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_SURVEYS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_RESERVATIONS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_CHECKIN_STUDENTS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_RECORD_VIOLATIONS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_MANAGE_VIOLATIONS)).toBe(false);
      expect(p.finalScopes).toEqual([SCOPE.CLASS]);
    });

    it('executive: broad permissions + ALL scope', () => {
      const p = profileFor('executive');
      expect(p.hasAdminRights).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_CLASSES)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ANALYTICS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_LEARNING_ANALYTICS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_TESTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ACCOUNTS)).toBe(true);
      expect(p.finalScopes).toEqual([SCOPE.ALL]);
    });

    it('et_manager: ET/JT/EC events + surveys + leader-only accounts; no english/analytics', () => {
      const p = profileFor('et_manager');
      expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_EVENTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_RESERVATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_RESERVATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_SURVEYS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_CLASSES)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ACCOUNTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_RESET_PASSWORDS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ANALYTICS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_TESTS)).toBe(false);
      expect(p.finalScopes).toEqual(expect.arrayContaining([
        SCOPE.ENGLISH_TABLE,
        SCOPE.JOB_TALK,
        SCOPE.ENGLISH_CLUB,
        SCOPE.SURVEY_ENGLISH_TABLE,
        SCOPE.SURVEY_ENGLISH_CLUB,
        SCOPE.CLASS,
      ]));
      expect(canAccessEventByRecord(userFor('et_manager'), event('English Table')).allowed).toBe(true);
      expect(canAccessEventByRecord(userFor('et_manager'), event('Job Talk')).allowed).toBe(true);
      expect(canAccessEventByRecord(userFor('et_manager'), event('English Club')).allowed).toBe(true);
      expect(canAccessEventByRecord(userFor('et_manager'), event('International Forum')).allowed).toBe(false);
    });

    it('if_manager: International Forum scope + events admin + LJ', () => {
      const p = profileFor('if_manager');
      expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_CLASSES)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ANALYTICS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_SURVEYS)).toBe(false);
      expect(p.finalScopes).toEqual([SCOPE.INTERNATIONAL_FORUM]);
    });

    it('jt_manager: same modules as et_manager; events Job Talk only; no ET grouping', () => {
      const p = profileFor('jt_manager');
      expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_EVENTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_RESERVATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_RESERVATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_SURVEYS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_CLASSES)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ACCOUNTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_RESET_PASSWORDS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ET_GROUPING)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_ANALYTICS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING)).toBe(false);
      expect(p.finalScopes).toEqual(expect.arrayContaining([
        SCOPE.JOB_TALK,
        SCOPE.SURVEY_ENGLISH_TABLE,
        SCOPE.SURVEY_ENGLISH_CLUB,
        SCOPE.CLASS,
      ]));
      expect(p.finalScopes).not.toContain(SCOPE.ENGLISH_TABLE);
      expect(p.finalScopes).not.toContain(SCOPE.ENGLISH_CLUB);
      expect(canAccessEventByRecord(userFor('jt_manager'), event('Job Talk')).allowed).toBe(true);
      expect(canAccessEventByRecord(userFor('jt_manager'), event('English Table')).allowed).toBe(false);
      expect(canAccessEventByRecord(userFor('jt_manager'), event('English Club')).allowed).toBe(false);
    });
  });

  describe('office_staff permissions', () => {
    it('event_lead: events/reservations full + violations + governance modules', () => {
      const p = buildAccessProfile({ role: 'office_staff', staffLevel: 'event_lead' });
      expect(p.finalScopes).toEqual([SCOPE.ALL]);
      expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_EVENTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_RESERVATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_RESERVATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_EXPORT_RESERVATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_CHECKIN_STUDENTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_BLACKLIST)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_BLACKLIST)).toBe(true);
      expect(p.permissionSet.has(P.CAN_RECORD_VIOLATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_VIOLATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ANNOUNCEMENTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ET_GROUPING)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ET_GROUPING)).toBe(true);
      expect(p.permissionSet.has(P.CAN_EXPORT_ET_GROUPING)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ENGLISH_LEARNING_RULES)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_SITE_CONTENT)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ACCOUNTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_RESET_PASSWORDS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_SURVEYS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_MANAGE_SETTINGS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_ANALYTICS)).toBe(false);
    });

    it('curriculum_lead: class modules + shared office modules, no surveys', () => {
      const p = buildAccessProfile({ role: 'office_staff', staffLevel: 'curriculum_lead' });
      expect(p.permissionSet.has(P.CAN_MANAGE_CLASSES)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ANNOUNCEMENTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_SURVEYS)).toBe(false);
    });

    it('bestep_lead: english/bestep full + announcements/site/weekly; no account management', () => {
      const p = buildAccessProfile({ role: 'office_staff', staffLevel: 'bestep_lead' });
      expect(p.finalScopes).toEqual([SCOPE.ENGLISH_TEST, SCOPE.SURVEY_ENGLISH_TABLE]);
      expect(p.permissionSet.has(P.CAN_MANAGE_ENGLISH_TESTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ENGLISH_TEST_TRACKING)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING)).toBe(true);
      expect(p.permissionSet.has(P.CAN_IMPORT_BESTEP)).toBe(true);
      expect(p.permissionSet.has(P.CAN_EXPORT_BESTEP)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ANNOUNCEMENTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_SITE_CONTENT)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ACCOUNTS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_RESET_PASSWORDS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(false);
      expect(p.permissionSet.has(P.CAN_MANAGE_CLASSES)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_SURVEYS)).toBe(false);
    });

    it('deputy_manager: events/reservations full + english full + governance, no surveys/classes/analytics', () => {
      const p = buildAccessProfile({ role: 'office_staff', staffLevel: 'deputy_manager' });
      expect(p.finalScopes).toEqual([SCOPE.ALL]);
      expect(p.permissionSet.has(P.CAN_MANAGE_EVENTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_RESERVATIONS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ENGLISH_TESTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ENGLISH_TEST_TRACKING)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ANNOUNCEMENTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_SITE_CONTENT)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_ACCOUNTS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_RESET_PASSWORDS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_LEARNING_PARTNER_ADMIN)).toBe(true);
      expect(p.permissionSet.has(P.CAN_MANAGE_SETTINGS)).toBe(true);
      expect(p.permissionSet.has(P.CAN_VIEW_SURVEYS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_MANAGE_CLASSES)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_ANALYTICS)).toBe(false);
      expect(p.permissionSet.has(P.CAN_VIEW_BLACKLIST)).toBe(false);
    });
  });

  describe('own-class scope (buildClassScopeWhere)', () => {
    const levels = ['regular', 'et_manager', 'if_manager', 'jt_manager'];
    it.each(levels)('%s scopes to teacherName when named', (level) => {
      expect(buildClassScopeWhere(userFor(level, 'Alice'))).toEqual({ teacherName: 'Alice' });
    });

    it('executive has unrestricted class list', () => {
      expect(buildClassScopeWhere(userFor('executive'))).toEqual({});
    });
  });

  describe('event scope', () => {
    it('et_manager: English Table, Job Talk, English Club', () => {
      const u = userFor('et_manager');
      expect(canAccessEventByRecord(u, event('English Table')).allowed).toBe(true);
      expect(canAccessEventByRecord(u, event('Job Talk')).allowed).toBe(true);
      expect(canAccessEventByRecord(u, event('English Club')).allowed).toBe(true);
      expect(canAccessEventByRecord(u, event('International Forum')).allowed).toBe(false);
    });

    it('if_manager: International Forum only', () => {
      const u = userFor('if_manager');
      expect(canAccessEventByRecord(u, event('International Forum')).allowed).toBe(true);
      expect(canAccessEventByRecord(u, event('English Table')).allowed).toBe(false);
    });

    it('jt_manager: Job Talk only', () => {
      const u = userFor('jt_manager');
      expect(canAccessEventByRecord(u, event('Job Talk')).allowed).toBe(true);
      expect(canAccessEventByRecord(u, event('English Table')).allowed).toBe(false);
    });

    it('regular: no mapped event types', () => {
      const u = userFor('regular');
      expect(canAccessEventByRecord(u, event('English Table')).allowed).toBe(false);
    });
  });

  describe('survey scope', () => {
    it('et_manager: English Table and English Club surveys', () => {
      const u = userFor('et_manager');
      expect(canAccessSurveyByRecord(u, etSurvey).allowed).toBe(true);
      expect(canAccessSurveyByRecord(u, ifSurvey).allowed).toBe(false);
    });

    it('if_manager and regular: no survey scope', () => {
      expect(canAccessSurveyByRecord(userFor('if_manager'), etSurvey).allowed).toBe(false);
      expect(canAccessSurveyByRecord(userFor('regular'), etSurvey).allowed).toBe(false);
    });
  });
});
