'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bestep_attendance', 'importBatchId', {
      type: Sequelize.STRING(64),
      allowNull: true,
      comment: '匯入批次 ID，供匯入紀錄中心回滾',
    });
    await queryInterface.addIndex('bestep_attendance', ['importBatchId'], {
      name: 'idx_bestep_attendance_import_batch',
    });

    await queryInterface.addColumn('bestep_exam_scores', 'importBatchId', {
      type: Sequelize.STRING(64),
      allowNull: true,
      comment: '匯入批次 ID，供匯入紀錄中心回滾',
    });
    await queryInterface.addIndex('bestep_exam_scores', ['importBatchId'], {
      name: 'idx_bestep_exam_scores_import_batch',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('bestep_attendance', 'idx_bestep_attendance_import_batch');
    await queryInterface.removeColumn('bestep_attendance', 'importBatchId');
    await queryInterface.removeIndex('bestep_exam_scores', 'idx_bestep_exam_scores_import_batch');
    await queryInterface.removeColumn('bestep_exam_scores', 'importBatchId');
  },
};
