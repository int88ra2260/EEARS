'use strict';

/**
 * 移除 survey_responses 上錯誤的 studentId 單欄唯一索引（會阻擋同學同學期填 ET+EC）。
 * 保留 uniq_student_survey_semester (studentId, surveyId, semester)。
 */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'mysql' && dialect !== 'mariadb') return;

    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM survey_responses');
    const studentOnly = (indexes || []).filter(
      (idx) => idx.Key_name === 'studentId' && idx.Non_unique === 0
    );
    if (studentOnly.length === 1 && studentOnly[0].Column_name === 'studentId') {
      await queryInterface.removeIndex('survey_responses', 'studentId').catch(() => {});
    }
  },

  async down() {
    // 不回復錯誤索引
  },
};
