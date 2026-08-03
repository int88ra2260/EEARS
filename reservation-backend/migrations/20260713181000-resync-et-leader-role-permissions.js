'use strict';

const { buildBasePermissionSet } = require('../auth/accessProfile');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const roleKey = 'leader';
    await queryInterface.bulkDelete('role_permissions', { role: roleKey });
    const perms = Array.from(buildBasePermissionSet({ role: 'leader' }));
    if (!perms.length) return;
    const rows = perms.map((permission) => ({
      role: roleKey,
      permission,
      createdAt: now,
      updatedAt: now,
    }));
    await queryInterface.bulkInsert('role_permissions', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', { role: 'leader' });
  },
};
