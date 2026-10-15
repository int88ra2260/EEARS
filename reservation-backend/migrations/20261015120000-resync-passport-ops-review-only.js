'use strict';

const { buildBasePermissionSet } = require('../auth/accessProfile');

/** 實踐歷程工讀只保留點數審核。 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const seed = {
      role: 'worker',
      teacherLevel: null,
      staffLevel: null,
      workerLevel: 'passport_ops',
      roleKey: 'worker:passport_ops',
    };
    await queryInterface.bulkDelete('role_permissions', { role: seed.roleKey });
    const perms = Array.from(buildBasePermissionSet({
      role: seed.role,
      teacherLevel: seed.teacherLevel,
      staffLevel: seed.staffLevel,
      workerLevel: seed.workerLevel,
    }));
    if (!perms.length) return;
    const rows = perms.map((permission) => ({
      role: seed.roleKey,
      permission,
      createdAt: now,
      updatedAt: now,
    }));
    await queryInterface.bulkInsert('role_permissions', rows);
  },

  async down() {
    // 權限表為累積設定，down 不自動還原
  },
};
