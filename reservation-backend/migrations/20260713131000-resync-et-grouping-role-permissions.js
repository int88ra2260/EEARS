'use strict';

const { buildBasePermissionSet } = require('../auth/accessProfile');

const ROLE_SEEDS = [
  { role: 'teacher', teacherLevel: 'executive', staffLevel: null, roleKey: 'teacher:executive' },
  { role: 'teacher', teacherLevel: 'et_manager', staffLevel: null, roleKey: 'teacher:et_manager' },
  { role: 'office_staff', teacherLevel: null, staffLevel: 'event_lead', roleKey: 'office_staff:event_lead' },
  { role: 'office_staff', teacherLevel: null, staffLevel: 'deputy_manager', roleKey: 'office_staff:deputy_manager' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const seed of ROLE_SEEDS) {
      await queryInterface.bulkDelete('role_permissions', { role: seed.roleKey });
      const perms = Array.from(buildBasePermissionSet({
        role: seed.role,
        teacherLevel: seed.teacherLevel,
        staffLevel: seed.staffLevel,
      }));
      if (!perms.length) continue;
      const rows = perms.map((permission) => ({
        role: seed.roleKey,
        permission,
        createdAt: now,
        updatedAt: now,
      }));
      await queryInterface.bulkInsert('role_permissions', rows);
    }
  },

  async down() {
    // 權限表為累積設定，down 不自動還原
  },
};
