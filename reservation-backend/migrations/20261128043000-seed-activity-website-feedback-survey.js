'use strict';

const { ACTIVITY_FEEDBACK_SURVEY_KEY, buildActivityFeedbackSchema } = require('../constants/activityFeedbackSurvey');

/**
 * 手機首頁暫代週報的意見調查。
 * 匿名、非必填、活動類型不對到 ET/EC，因此不會變成預約 Gate，也不進問卷選擇頁。
 */
module.exports = {
  async up(queryInterface) {
    const schema = buildActivityFeedbackSchema();
    const now = new Date();
    // bulkInsert 不會自動序列化 JSON 欄位，必須傳字串（避免 Invalid value [Object]）
    const schemaJson = JSON.stringify(schema);
    const settingsJson = JSON.stringify({
      successMessage: '問卷已送出，謝謝你的回饋。',
      relatedEventTypes: [],
    });

    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM surveys WHERE surveyKey = ? LIMIT 1',
      { replacements: [ACTIVITY_FEEDBACK_SURVEY_KEY] }
    );
    let surveyId = existing[0]?.id;
    if (!surveyId) {
      await queryInterface.bulkInsert('surveys', [{
        surveyKey: ACTIVITY_FEEDBACK_SURVEY_KEY,
        code: ACTIVITY_FEEDBACK_SURVEY_KEY,
        name: '增能活動與網站問卷',
        title: '增能活動與網站問卷',
        description: schema.description,
        category: 'feedback',
        targetType: 'student',
        activityType: 'website_feedback',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }]);
      const [surveyRows] = await queryInterface.sequelize.query(
        'SELECT id FROM surveys WHERE surveyKey = ? LIMIT 1',
        { replacements: [ACTIVITY_FEEDBACK_SURVEY_KEY] }
      );
      surveyId = surveyRows[0].id;
    }

    const [versionRows] = await queryInterface.sequelize.query(
      'SELECT id FROM survey_versions WHERE surveyId = ? ORDER BY versionNumber DESC, id DESC LIMIT 1',
      { replacements: [surveyId] }
    );
    let versionId = versionRows[0]?.id;
    if (!versionId) {
      await queryInterface.bulkInsert('survey_versions', [{
        surveyId,
        versionNumber: 1,
        schemaJson,
        changeSummary: '手機首頁暫代週報的意見調查',
        status: 'published',
        isPublished: true,
        publishedAt: now,
        publishedBy: null,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      }]);
      const [createdVersions] = await queryInterface.sequelize.query(
        'SELECT id FROM survey_versions WHERE surveyId = ? ORDER BY id DESC LIMIT 1',
        { replacements: [surveyId] }
      );
      versionId = createdVersions[0].id;
    }

    await queryInterface.sequelize.query(
      `UPDATE surveys
       SET currentPublishedVersionId = COALESCE(currentPublishedVersionId, ?),
           currentVersionId = COALESCE(currentVersionId, ?)
       WHERE id = ?`,
      { replacements: [versionId, versionId, surveyId] }
    );

    const [rules] = await queryInterface.sequelize.query(
      'SELECT id FROM survey_rules WHERE surveyId = ? LIMIT 1',
      { replacements: [surveyId] }
    );
    if (!rules.length) {
      await queryInterface.bulkInsert('survey_rules', [{
        surveyId,
        semesterId: null,
        activityType: 'website_feedback',
        surveyVersionId: versionId,
        isEnabled: true,
        isRequired: false,
        triggerMode: null,
        fillScope: 'unlimited',
        appliesToAllEvents: false,
        eventId: null,
        startAt: null,
        endAt: null,
        priority: 200,
        startDate: null,
        endDate: null,
        gatingMode: 'none',
        retakePolicy: 'unlimited',
        retakeScope: null,
        semesterKey: null,
        targetEventType: null,
        targetEventId: null,
        collectStudentId: false,
        collectStudentName: false,
        collectStudentEmail: false,
        allowEditAfterSubmit: false,
        isAnonymous: true,
        settingsJson,
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      }]);
    }
  },

  async down(queryInterface) {
    const [surveyRows] = await queryInterface.sequelize.query(
      'SELECT id FROM surveys WHERE surveyKey = ? LIMIT 1',
      { replacements: [ACTIVITY_FEEDBACK_SURVEY_KEY] }
    );
    if (!surveyRows.length) return;
    const surveyId = surveyRows[0].id;

    const [responses] = await queryInterface.sequelize.query(
      'SELECT id FROM survey_responses WHERE surveyId = ?',
      { replacements: [surveyId] }
    );
    const responseIds = responses.map((row) => row.id);
    if (responseIds.length) {
      await queryInterface.bulkDelete('survey_response_answers', { responseId: responseIds });
      await queryInterface.bulkDelete('survey_responses', { surveyId });
    }
    await queryInterface.bulkDelete('survey_rules', { surveyId });
    await queryInterface.sequelize.query(
      'UPDATE surveys SET currentPublishedVersionId = NULL, currentVersionId = NULL WHERE id = ?',
      { replacements: [surveyId] }
    );
    await queryInterface.bulkDelete('survey_versions', { surveyId });
    await queryInterface.bulkDelete('surveys', { id: surveyId });
  },
};
