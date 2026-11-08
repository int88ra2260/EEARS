'use strict';

/**
 * 已有角色權限列的職務補上 can_view_student_feedback。
 * 角色完全沒有列時不插入，避免把空的 admin 角色變成只剩這一鍵。
 */

const PERMISSION = 'can_view_student_feedback';
const ROLE_KEYS = [
  'admin',
  'teacher:executive',
  'office_staff:event_lead',
  'office_staff:curriculum_lead',
  'office_staff:bestep_lead',
  'office_staff:deputy_manager',
];

module.exports = {
  async up(queryInterface) {
    for (const roleKey of ROLE_KEYS) {
      const [rows] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) AS n FROM role_permissions WHERE role = :role',
        { replacements: { role: roleKey } },
      );
      const count = Number(rows?.[0]?.n || 0);
      if (!count) continue;
      await queryInterface.sequelize.query(
        `INSERT INTO role_permissions (role, permission, createdAt, updatedAt)
         SELECT :role, :permission, NOW(), NOW() FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM role_permissions
           WHERE role = :role AND permission = :permission
         )`,
        { replacements: { role: roleKey, permission: PERMISSION } },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', { permission: PERMISSION });
  },
};
