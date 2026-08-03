'use strict';

const TABLES = {
  EVENTS: 'lj_student_events',
  ANALYTIC_STUDENTS: 'lj_analytic_students',
  ANALYTIC_EXAMS: 'lj_analytic_exams',
};

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(tableName);
}

async function addIndexSafe(queryInterface, tableName, fields, options, transaction) {
  try {
    await queryInterface.addIndex(tableName, fields, { ...options, transaction });
  } catch (error) {
    const message = (error && error.message) || '';
    const mysqlCode = error && error.original && error.original.code;
    if (mysqlCode !== 'ER_DUP_KEYNAME' && !message.includes('Duplicate key name')) throw error;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      if (!(await tableExists(queryInterface, TABLES.EVENTS))) {
        await queryInterface.createTable(TABLES.EVENTS, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          student_id: { type: Sequelize.STRING(20), allowNull: false },
          event_type: {
            type: Sequelize.ENUM('baseline_score', 'exam_event', 'course_event', 'activity_event'),
            allowNull: false,
          },
          event_date: { type: Sequelize.DATEONLY, allowNull: true },
          academic_year: { type: Sequelize.SMALLINT.UNSIGNED, allowNull: true },
          academic_term: { type: Sequelize.STRING(12), allowNull: true },
          sem_index: { type: Sequelize.SMALLINT, allowNull: true },
          source_system: { type: Sequelize.STRING(40), allowNull: false },
          source_record_id: { type: Sequelize.STRING(80), allowNull: false },
          status: {
            type: Sequelize.ENUM('valid', 'registered_no_score', 'void', 'excluded'),
            allowNull: false,
            defaultValue: 'valid',
          },
          exclude_flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          reason_code: { type: Sequelize.STRING(40), allowNull: true },
          timing: { type: Sequelize.STRING(20), allowNull: true },
          instrument: { type: Sequelize.STRING(40), allowNull: true },
          skill: { type: Sequelize.STRING(20), allowNull: true },
          raw_score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          cefr_level: { type: Sequelize.STRING(10), allowNull: true },
          hours: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
          title: { type: Sequelize.STRING(200), allowNull: true },
          subtitle: { type: Sequelize.STRING(200), allowNull: true },
          rule_version: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'lj-analytics-2026-v1' },
          raw_payload: { type: Sequelize.JSON, allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }
      await addIndexSafe(
        queryInterface,
        TABLES.EVENTS,
        ['source_system', 'source_record_id', 'event_type', 'skill'],
        { unique: true, name: 'uk_lj_events_source' },
        transaction
      );
      await addIndexSafe(
        queryInterface,
        TABLES.EVENTS,
        ['student_id', 'event_date'],
        { name: 'idx_lj_events_student_date' },
        transaction
      );
      await addIndexSafe(
        queryInterface,
        TABLES.EVENTS,
        ['student_id', 'event_type'],
        { name: 'idx_lj_events_student_type' },
        transaction
      );

      if (!(await tableExists(queryInterface, TABLES.ANALYTIC_STUDENTS))) {
        await queryInterface.createTable(TABLES.ANALYTIC_STUDENTS, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          student_id: { type: Sequelize.STRING(20), allowNull: false },
          cohort: { type: Sequelize.STRING(10), allowNull: true },
          enrollment_term: { type: Sequelize.STRING(12), allowNull: true },
          college: { type: Sequelize.STRING(120), allowNull: true },
          department: { type: Sequelize.STRING(120), allowNull: true },
          admission_type: { type: Sequelize.STRING(40), allowNull: true },
          is_overseas_student: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          baseline_english_score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          baseline_level: { type: Sequelize.STRING(20), allowNull: true },
          baseline_cefr: { type: Sequelize.STRING(10), allowNull: true },
          exam_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
          retest_flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          first_exam_date: { type: Sequelize.DATEONLY, allowNull: true },
          last_exam_date: { type: Sequelize.DATEONLY, allowNull: true },
          best_listening_score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          best_reading_score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          best_speaking_score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          best_writing_score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          best_cefr: { type: Sequelize.STRING(10), allowNull: true },
          is_b2plus: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          total_course_hours: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
          total_activity_hours: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
          total_resource_hours: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
          pre_exam_course_hours: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          pre_exam_activity_hours: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          post_exam_course_hours: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          post_exam_activity_hours: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          exposure_level: { type: Sequelize.STRING(20), allowNull: true },
          has_valid_exam: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          has_registered_no_score: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          exclude_flag_summary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          reason_codes_summary: { type: Sequelize.STRING(500), allowNull: true },
          snapshot_version: { type: Sequelize.STRING(120), allowNull: true },
          rule_version: { type: Sequelize.STRING(30), allowNull: true },
          derived_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }
      await addIndexSafe(
        queryInterface,
        TABLES.ANALYTIC_STUDENTS,
        ['student_id', 'snapshot_version'],
        { unique: true, name: 'uk_lj_analytic_student_snap' },
        transaction
      );
      await addIndexSafe(
        queryInterface,
        TABLES.ANALYTIC_STUDENTS,
        ['cohort', 'exposure_level'],
        { name: 'idx_lj_analytic_student_cohort' },
        transaction
      );

      if (!(await tableExists(queryInterface, TABLES.ANALYTIC_EXAMS))) {
        await queryInterface.createTable(TABLES.ANALYTIC_EXAMS, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          student_id: { type: Sequelize.STRING(20), allowNull: false },
          exam_event_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
          exam_date: { type: Sequelize.DATEONLY, allowNull: false },
          instrument: { type: Sequelize.STRING(40), allowNull: false },
          skill: { type: Sequelize.STRING(20), allowNull: false },
          raw_score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          cefr_level: { type: Sequelize.STRING(10), allowNull: true },
          is_b2plus: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          exam_seq: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
          timing: { type: Sequelize.STRING(20), allowNull: true },
          previous_exam_event_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
          previous_raw_score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          delta_raw_score: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          improved_flag: { type: Sequelize.BOOLEAN, allowNull: true },
          retest_flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          course_hours_before_exam: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
          activity_hours_before_exam: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
          resource_hours_before_exam: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
          course_count_before_exam: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
          activity_count_before_exam: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
          exposure_before_exam_flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          registered_no_score_flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          exclude_flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          reason_code: { type: Sequelize.STRING(40), allowNull: true },
          status: { type: Sequelize.STRING(30), allowNull: true },
          snapshot_version: { type: Sequelize.STRING(120), allowNull: true },
          rule_version: { type: Sequelize.STRING(30), allowNull: true },
          derived_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }
      await addIndexSafe(
        queryInterface,
        TABLES.ANALYTIC_EXAMS,
        ['student_id', 'instrument', 'skill', 'exam_date', 'snapshot_version'],
        { name: 'idx_lj_analytic_exam_student' },
        transaction
      );
      await addIndexSafe(
        queryInterface,
        TABLES.ANALYTIC_EXAMS,
        ['exam_seq', 'improved_flag', 'exposure_before_exam_flag'],
        { name: 'idx_lj_analytic_exam_filters' },
        transaction
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const table of [TABLES.ANALYTIC_EXAMS, TABLES.ANALYTIC_STUDENTS, TABLES.EVENTS]) {
        if (await tableExists(queryInterface, table)) {
          await queryInterface.dropTable(table, { transaction });
        }
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
