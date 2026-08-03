'use strict';

/**
 * 對齊 `survey_responses`（SurveyModuleResponse, tableName: survey_responses）與 model / services 實際查詢欄位。
 *
 * 背景：部分環境先有「不完整」的 survey_responses（略過 20260410120000 的 createTable），
 * 後續 migration 只補了部分欄位，導致 Sequelize 查詢 studentName / eventId / submittedAt 等失敗。
 *
 * - 僅 forward：不修改既有已執行過的 migration 檔案。
 * - 每個欄位、index、FK 皆以 describeTable / information_schema 檢查後再建立，避免重複失敗。
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, DATE, JSON: JSONTYPE } = Sequelize;
    const table = 'survey_responses';
    const qi = queryInterface.sequelize;

    const desc0 = await queryInterface.describeTable(table).catch(() => null);
    if (!desc0) return;

    async function describe() {
      return queryInterface.describeTable(table).catch(() => ({}));
    }

    async function addColIfMissing(col, spec) {
      const d = await describe();
      if (d && !d[col]) {
        await queryInterface.addColumn(table, col, spec);
      }
    }

    async function indexExists(indexName) {
      const dialect = qi.getDialect();
      if (dialect === 'mysql' || dialect === 'mariadb') {
        const [rows] = await qi.query(
          `SELECT COUNT(*) AS c FROM information_schema.statistics
           WHERE table_schema = DATABASE() AND table_name = :t AND index_name = :i`,
          { replacements: { t: table, i: indexName } }
        );
        return Number(rows[0]?.c || 0) > 0;
      }
      return false;
    }

    async function fkExists(name) {
      const dialect = qi.getDialect();
      if (dialect === 'mysql' || dialect === 'mariadb') {
        const [rows] = await qi.query(
          `SELECT COUNT(*) AS c FROM information_schema.table_constraints
           WHERE constraint_schema = DATABASE() AND table_name = :t AND constraint_name = :n`,
          { replacements: { t: table, n: name } }
        );
        return Number(rows[0]?.c || 0) > 0;
      }
      return false;
    }

    async function safeAddIndex(columns, options) {
      const name = options.name;
      if (!name) return;
      if (await indexExists(name)) return;
      await queryInterface.addIndex(table, columns, options).catch(() => {});
    }

    async function safeAddFk(name, fields, refTable, refField, onDelete, onUpdate) {
      if (await fkExists(name)) return;
      await queryInterface
        .addConstraint(table, {
          fields,
          type: 'foreign key',
          name,
          references: { table: refTable, field: refField },
          onDelete: onDelete || 'RESTRICT',
          onUpdate: onUpdate || 'CASCADE',
        })
        .catch(() => {});
    }

    // --- 與 SurveyModuleResponse 對齊之欄位（與 20260410120000 + 202604131200 + 202604131830 合併語意一致）---
    await addColIfMissing('surveyId', { type: INTEGER.UNSIGNED, allowNull: true });
    await addColIfMissing('surveyVersionId', { type: INTEGER.UNSIGNED, allowNull: true });
    await addColIfMissing('studentId', { type: STRING(80), allowNull: true });
    await addColIfMissing('studentName', { type: STRING(120), allowNull: true });
    await addColIfMissing('studentEmail', { type: STRING(200), allowNull: true });
    await addColIfMissing('eventId', { type: INTEGER.UNSIGNED, allowNull: true });
    await addColIfMissing('eventType', { type: STRING(120), allowNull: true });
    await addColIfMissing('semesterKey', { type: STRING(64), allowNull: true });
    await addColIfMissing('submittedAt', { type: DATE, allowNull: true });
    await addColIfMissing('status', { type: STRING(32), allowNull: false, defaultValue: 'completed' });
    await addColIfMissing('answersJson', { type: JSONTYPE, allowNull: true });
    await addColIfMissing('metadataJson', { type: JSONTYPE, allowNull: true });

    await addColIfMissing('semester', { type: STRING(10), allowNull: true });
    await addColIfMissing('semesterId', { type: INTEGER.UNSIGNED, allowNull: true });
    await addColIfMissing('ruleId', { type: INTEGER.UNSIGNED, allowNull: true });
    await addColIfMissing('reservationId', { type: INTEGER.UNSIGNED, allowNull: true });
    await addColIfMissing('activityType', { type: STRING(120), allowNull: true });
    await addColIfMissing('submissionStatus', {
      type: STRING(32),
      allowNull: false,
      defaultValue: 'submitted',
    });
    await addColIfMissing('source', { type: STRING(60), allowNull: true });

    await addColIfMissing('createdAt', {
      type: DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
    await addColIfMissing('updatedAt', {
      type: DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });

    // answersJson：補預設空物件後改為 NOT NULL（與 model allowNull: false 一致）
    const dAfter = await describe();
    if (dAfter.answersJson) {
      const dialect = qi.getDialect();
      if (dialect === 'mysql' || dialect === 'mariadb') {
        await qi.query(`UPDATE \`${table}\` SET answersJson = JSON_OBJECT() WHERE answersJson IS NULL`).catch(() => {});
      } else {
        await qi.query(`UPDATE "${table}" SET answersJson = '{}' WHERE answersJson IS NULL`).catch(() => {});
      }
      await queryInterface.changeColumn(table, 'answersJson', { type: JSONTYPE, allowNull: false }).catch(() => {});
    }

    // semester：與既有 migration 一致，盡量由 semesterKey 回填後設為 NOT NULL
    if ((await describe()).semester) {
      const dialect = qi.getDialect();
      if (dialect === 'mysql' || dialect === 'mariadb') {
        await qi
          .query(
            `UPDATE \`${table}\` SET semester = CASE
              WHEN semesterKey IS NOT NULL AND semesterKey REGEXP '^[0-9]{3}-[12]$' THEN semesterKey
              ELSE '114-1'
            END
            WHERE semester IS NULL OR semester = ''`
          )
          .catch(() => {});
      } else {
        await qi.query(`UPDATE "${table}" SET semester = '114-1' WHERE semester IS NULL OR semester = ''`).catch(() => {});
      }
      await queryInterface.changeColumn(table, 'semester', { type: STRING(10), allowNull: false }).catch(() => {});
    }

    // 與 202604131830 一致之資料補齊（僅 MySQL/MariaDB；欄位已存在時仍安全執行）
    const dialect = qi.getDialect();
    if (dialect === 'mysql' || dialect === 'mariadb') {
      const d = await describe();
      if (d.eventType && d.activityType) {
        await qi
          .query(
            `UPDATE \`${table}\` SET activityType = eventType WHERE activityType IS NULL AND eventType IS NOT NULL`
          )
          .catch(() => {});
      }
      if (d.source) {
        await qi.query(`UPDATE \`${table}\` SET source = 'legacy_dual_write' WHERE source IS NULL`).catch(() => {});
      }
      if (d.submissionStatus) {
        await qi
          .query(
            `UPDATE \`${table}\` SET submissionStatus = 'submitted' WHERE submissionStatus IS NULL OR submissionStatus = ''`
          )
          .catch(() => {});
      }
    }

    // --- 索引（與 product create migration 命名一致；已存在則跳過）---
    await safeAddIndex(['surveyId', 'studentId'], { name: 'survey_responses_survey_student_idx' });
    await safeAddIndex(['surveyVersionId'], { name: 'survey_responses_version_idx' });
    await safeAddIndex(['submittedAt'], { name: 'survey_responses_submitted_idx' });
    await safeAddIndex(['eventId'], { name: 'survey_responses_event_idx' });
    await safeAddIndex(['semesterId'], { name: 'survey_responses_semester_id_idx' });
    await safeAddIndex(['surveyId', 'submittedAt'], { name: 'survey_responses_survey_submitted_idx' });

    // --- FK（與 20260410120000 一致；若參照資料不完整則略過）---
    await safeAddFk('survey_responses_survey_fk', ['surveyId'], 'surveys', 'id', 'CASCADE', 'CASCADE');
    await safeAddFk('survey_responses_version_fk', ['surveyVersionId'], 'survey_versions', 'id', 'RESTRICT', 'CASCADE');
  },

  async down() {
    // Forward-only alignment：不在此移除欄位，避免破壞已寫入之資料與相依流程。
  },
};
