'use strict';

const { buildBasePermissionSet } = require('../auth/accessProfile');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const seed = {
      role: 'teacher',
      teacherLevel: 'executive',
      staffLevel: null,
      roleKey: 'teacher:executive',
    };
    await queryInterface.bulkDelete('role_permissions', { role: seed.roleKey });
    const perms = Array.from(buildBasePermissionSet({
      role: seed.role,
      teacherLevel: seed.teacherLevel,
      staffLevel: seed.staffLevel,
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
    // 權限表為累積設定，down 不自動還原以免影響 production 手動調整
  },
};
