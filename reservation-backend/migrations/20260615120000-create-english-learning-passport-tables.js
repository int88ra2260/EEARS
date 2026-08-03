'use strict';

/**
 * 英語實踐歷程檔案電子化（English Learning Passport）
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, TEXT, JSON: JSONTYPE, BOOLEAN, DATE, DATEONLY } = Sequelize;

    const passports = await queryInterface.describeTable('english_learning_passports').catch(() => null);
    if (!passports) {
      await queryInterface.createTable('english_learning_passports', {
        id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        student_id: { type: STRING(50), allowNull: false },
        student_name: { type: STRING(120), allowNull: false },
        student_email: { type: STRING(200), allowNull: false },
        status: {
          type: STRING(32),
          allowNull: false,
          defaultValue: 'pending',
          comment: 'pending|active|rejected|revoked|completed',
        },
        application_reason: { type: TEXT, allowNull: true },
        reviewed_by: { type: INTEGER.UNSIGNED, allowNull: true },
        reviewed_at: { type: DATE, allowNull: true },
        rejection_reason: { type: TEXT, allowNull: true },
        total_approved_points: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        completed_at: { type: DATE, allowNull: true },
        certification_status: {
          type: STRING(32),
          allowNull: false,
          defaultValue: 'none',
          comment: 'none|pending|approved|rejected',
        },
        certification_requested_at: { type: DATE, allowNull: true },
        certification_reviewed_by: { type: INTEGER.UNSIGNED, allowNull: true },
        certification_reviewed_at: { type: DATE, allowNull: true },
        certification_rejection_reason: { type: TEXT, allowNull: true },
        created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('english_learning_passports', ['student_id'], {
        name: 'elp_passports_student_id_idx',
      });
      await queryInterface.addIndex('english_learning_passports', ['status'], {
        name: 'elp_passports_status_idx',
      });
      await queryInterface.addIndex('english_learning_passports', ['certification_status'], {
        name: 'elp_passports_cert_status_idx',
      });
    }

    const rules = await queryInterface.describeTable('english_learning_point_rules').catch(() => null);
    if (!rules) {
      await queryInterface.createTable('english_learning_point_rules', {
        id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        code: { type: STRING(64), allowNull: false, unique: true },
        name: { type: STRING(200), allowNull: false },
        description: { type: TEXT, allowNull: true },
        base_points: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        max_points_per_week: { type: INTEGER.UNSIGNED, allowNull: true },
        max_points_total: { type: INTEGER.UNSIGNED, allowNull: true },
        is_once_only: { type: BOOLEAN, allowNull: false, defaultValue: false },
        requires_attachment: { type: BOOLEAN, allowNull: false, defaultValue: false },
        is_enabled: { type: BOOLEAN, allowNull: false, defaultValue: true },
        sort_order: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('english_learning_point_rules', ['code'], {
        unique: true,
        name: 'elp_rules_code_uq',
      });
      await queryInterface.addIndex('english_learning_point_rules', ['is_enabled', 'sort_order'], {
        name: 'elp_rules_enabled_sort_idx',
      });

      const now = new Date();
      await queryInterface.bulkInsert('english_learning_point_rules', [
        { code: 'TUTOR_CONSULTATION', name: '英語小老師諮詢', description: '英語口說諮詢或英語討論會，每次 2 點，每週上限 20 點', base_points: 2, max_points_per_week: 20, max_points_total: null, is_once_only: false, requires_attachment: false, is_enabled: true, sort_order: 1, created_at: now, updated_at: now },
        { code: 'ASSIGNED_TASK', name: '英語指定任務', description: '自學園指定書籍學習單通過，每次 2 點', base_points: 2, max_points_per_week: null, max_points_total: null, is_once_only: false, requires_attachment: true, is_enabled: true, sort_order: 2, created_at: now, updated_at: now },
        { code: 'SELF_STUDY_SOFTWARE', name: '英語自學軟體試卷', description: 'Live ABC / Live CNN 試卷通過，每次 2 點，每週上限 20 點', base_points: 2, max_points_per_week: 20, max_points_total: null, is_once_only: false, requires_attachment: true, is_enabled: true, sort_order: 3, created_at: now, updated_at: now },
        { code: 'ENGLISH_COURSE', name: '英語相關課程', description: '以英語授課之選修課程及格，每門 60 點', base_points: 60, max_points_per_week: null, max_points_total: null, is_once_only: false, requires_attachment: true, is_enabled: true, sort_order: 4, created_at: now, updated_at: now },
        { code: 'ENGLISH_COMPETITION', name: '英語文相關競賽', description: '參賽 20 點；得獎 50 點', base_points: 20, max_points_per_week: null, max_points_total: null, is_once_only: false, requires_attachment: true, is_enabled: true, sort_order: 5, created_at: now, updated_at: now },
        { code: 'EXTERNAL_EXAM', name: '校外英檢考試', description: '有效成績 20 點；達加碼門檻 40 點；僅採計一次', base_points: 20, max_points_per_week: null, max_points_total: null, is_once_only: true, requires_attachment: true, is_enabled: true, sort_order: 6, created_at: now, updated_at: now },
        { code: 'SELF_LEARNING_ACTIVITY', name: '英語自學園活動', description: '自學園、西灣沙龍、英語寫作工作坊，每次 5 點', base_points: 5, max_points_per_week: null, max_points_total: null, is_once_only: false, requires_attachment: false, is_enabled: true, sort_order: 7, created_at: now, updated_at: now },
        { code: 'COLLEGE_ENGLISH_CORNER', name: '學院英語學習角落活動', description: '每次 5 點，此類別最多採計 30 點', base_points: 5, max_points_per_week: null, max_points_total: 30, is_once_only: false, requires_attachment: true, is_enabled: true, sort_order: 8, created_at: now, updated_at: now },
      ]);
    }

    const submissions = await queryInterface.describeTable('english_learning_submissions').catch(() => null);
    if (!submissions) {
      await queryInterface.createTable('english_learning_submissions', {
        id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        passport_id: { type: INTEGER.UNSIGNED, allowNull: false },
        student_id: { type: STRING(50), allowNull: false },
        rule_code: { type: STRING(64), allowNull: false },
        status: {
          type: STRING(32),
          allowNull: false,
          defaultValue: 'draft',
          comment: 'draft|submitted|approved|rejected|cancelled',
        },
        activity_date: { type: DATEONLY, allowNull: true },
        title: { type: STRING(255), allowNull: true },
        description: { type: TEXT, allowNull: true },
        points_requested: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        points_approved: { type: INTEGER.UNSIGNED, allowNull: true },
        metadata_json: { type: JSONTYPE, allowNull: true },
        submitted_at: { type: DATE, allowNull: true },
        reviewed_by: { type: INTEGER.UNSIGNED, allowNull: true },
        reviewed_at: { type: DATE, allowNull: true },
        rejection_reason: { type: TEXT, allowNull: true },
        created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('english_learning_submissions', ['passport_id'], {
        name: 'elp_submissions_passport_idx',
      });
      await queryInterface.addIndex('english_learning_submissions', ['student_id'], {
        name: 'elp_submissions_student_idx',
      });
      await queryInterface.addIndex('english_learning_submissions', ['rule_code', 'status'], {
        name: 'elp_submissions_rule_status_idx',
      });
      await queryInterface.addIndex('english_learning_submissions', ['status', 'submitted_at'], {
        name: 'elp_submissions_status_submitted_idx',
      });
      await queryInterface.addConstraint('english_learning_submissions', {
        fields: ['passport_id'],
        type: 'foreign key',
        name: 'elp_submissions_passport_fk',
        references: { table: 'english_learning_passports', field: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }

    const attachments = await queryInterface.describeTable('english_learning_attachments').catch(() => null);
    if (!attachments) {
      await queryInterface.createTable('english_learning_attachments', {
        id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        submission_id: { type: INTEGER.UNSIGNED, allowNull: false },
        file_name: { type: STRING(255), allowNull: false },
        file_path: { type: STRING(500), allowNull: false },
        mime_type: { type: STRING(120), allowNull: true },
        file_size: { type: INTEGER.UNSIGNED, allowNull: true },
        uploaded_by: { type: STRING(80), allowNull: true },
        created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('english_learning_attachments', ['submission_id'], {
        name: 'elp_attachments_submission_idx',
      });
      await queryInterface.addConstraint('english_learning_attachments', {
        fields: ['submission_id'],
        type: 'foreign key',
        name: 'elp_attachments_submission_fk',
        references: { table: 'english_learning_submissions', field: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }

    const auditLogs = await queryInterface.describeTable('english_learning_audit_logs').catch(() => null);
    if (!auditLogs) {
      await queryInterface.createTable('english_learning_audit_logs', {
        id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        actor_id: { type: STRING(80), allowNull: true },
        actor_role: { type: STRING(40), allowNull: true },
        action: { type: STRING(64), allowNull: false },
        target_type: { type: STRING(64), allowNull: false },
        target_id: { type: STRING(64), allowNull: false },
        before_json: { type: JSONTYPE, allowNull: true },
        after_json: { type: JSONTYPE, allowNull: true },
        ip_address: { type: STRING(64), allowNull: true },
        user_agent: { type: STRING(500), allowNull: true },
        created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('english_learning_audit_logs', ['target_type', 'target_id'], {
        name: 'elp_audit_target_idx',
      });
      await queryInterface.addIndex('english_learning_audit_logs', ['action', 'created_at'], {
        name: 'elp_audit_action_created_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('english_learning_audit_logs').catch(() => {});
    await queryInterface.dropTable('english_learning_attachments').catch(() => {});
    await queryInterface.dropTable('english_learning_submissions').catch(() => {});
    await queryInterface.dropTable('english_learning_point_rules').catch(() => {});
    await queryInterface.dropTable('english_learning_passports').catch(() => {});
  },
};
