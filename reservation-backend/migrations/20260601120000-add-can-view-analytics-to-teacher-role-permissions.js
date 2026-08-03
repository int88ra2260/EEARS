'use strict';

const { buildBasePermissionSet } = require('../auth/accessProfile');

const TEACHER_ROLE_KEYS = [
  'teacher:regular',
  'teacher:et_manager',
  'teacher:if_manager',
  'teacher:jt_manager',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = [];
    for (const roleKey of TEACHER_ROLE_KEYS) {
      const parts = roleKey.split(':');
      const teacherLevel = parts[1] || 'regular';
      const perms = buildBasePermissionSet({ role: 'teacher', teacherLevel });
      for (const permission of perms) {
        rows.push({ role: roleKey, permission, createdAt: now, updatedAt: now });
      }
    }
    if (!rows.length) return;

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'mysql' || dialect === 'mariadb') {
      await queryInterface.bulkInsert('role_permissions', rows, {
        ignoreDuplicates: true,
      });
      return;
    }
    for (const row of rows) {
      const existing = await queryInterface.sequelize.query(
        `SELECT id FROM role_permissions WHERE role = :role AND permission = :permission LIMIT 1`,
        {
          replacements: { role: row.role, permission: row.permission },
          type: queryInterface.sequelize.QueryTypes.SELECT,
        }
      );
      if (!existing.length) {
        await queryInterface.bulkInsert('role_permissions', [row]);
      }
    }
  },

  async down() {
    // 權限表為累積設定，不自動刪除以免影響已調整之 production 資料
  },
};
