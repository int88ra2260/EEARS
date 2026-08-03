'use strict';

const TABLES = {
  EVENTS: 'lj_student_events',
};

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // MySQL UNIQUE 索引中 NULL 視為互不相等，導致 upsert 無法去重。
      await queryInterface.sequelize.query(`
        DELETE t1 FROM ${TABLES.EVENTS} t1
        INNER JOIN ${TABLES.EVENTS} t2
          ON t1.source_system = t2.source_system
          AND t1.source_record_id = t2.source_record_id
          AND t1.event_type = t2.event_type
          AND (t1.skill <=> t2.skill)
          AND t1.id > t2.id
      `, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE ${TABLES.EVENTS}
        SET skill = ''
        WHERE skill IS NULL
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down() {
    // 無法安全還原已刪除的重複列
  },
};
