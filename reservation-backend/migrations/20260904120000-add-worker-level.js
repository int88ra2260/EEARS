'use strict';

const { buildBasePermissionSet } = require('../auth/accessProfile');

const WORKER_LEVELS = ['event_ops', 'bestep_ops', 'content_editor', 'passport_ops'];

/**
 * 新增工讀生職務欄位 workerLevel，並 seed worker:<level> role_permissions。
 * MySQL：以 raw SQL 新增 ENUM，避免 Sequelize alter 與既有 enum 衝突。
 */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('teachers');

    if (!table.workerLevel) {
      await queryInterface.sequelize.query(
        "ALTER TABLE `teachers` ADD COLUMN `workerLevel` ENUM('event_ops','bestep_ops','content_editor','passport_ops') NULL COMMENT '工讀生職務（僅 role=worker）' AFTER `staffLevel`"
      );
    }

    await queryInterface.sequelize.query(
      "UPDATE `teachers` SET `workerLevel` = 'event_ops' WHERE `role` = 'worker' AND (`workerLevel` IS NULL OR `workerLevel` = '')"
    );

    const now = new Date();
    await queryInterface.bulkDelete('role_permissions', { role: 'worker' });

    for (const workerLevel of WORKER_LEVELS) {
      const roleKey = `worker:${workerLevel}`;
      await queryInterface.bulkDelete('role_permissions', { role: roleKey });
      const perms = Array.from(buildBasePermissionSet({
        role: 'worker',
        teacherLevel: null,
        staffLevel: null,
        workerLevel,
      }));
      if (!perms.length) continue;
      await queryInterface.bulkInsert(
        'role_permissions',
        perms.map((permission) => ({
          role: roleKey,
          permission,
          createdAt: now,
          updatedAt: now,
        }))
      );
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('teachers');
    if (table.workerLevel) {
      await queryInterface.sequelize.query(
        "UPDATE `teachers` SET `workerLevel` = NULL WHERE `role` = 'worker'"
      );
      await queryInterface.removeColumn('teachers', 'workerLevel');
    }

    for (const workerLevel of WORKER_LEVELS) {
      await queryInterface.bulkDelete('role_permissions', { role: `worker:${workerLevel}` });
    }
  },
};
