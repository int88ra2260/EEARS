/* eslint-disable no-console */
const { sequelize } = require('../models');
const { syncRolePermissionsIfNeeded } = require('../services/accessControl/writeService');
const { buildBasePermissionSet } = require('../auth/accessProfile');

function unique(arr) {
  return Array.from(new Set(arr));
}

function roleSeeds() {
  return [
    { role: 'admin', teacherLevel: null, staffLevel: null, roleKey: 'admin' },
    { role: 'worker', teacherLevel: null, staffLevel: null, roleKey: 'worker' },
    { role: 'teacher', teacherLevel: 'executive', staffLevel: null, roleKey: 'teacher:executive' },
    { role: 'teacher', teacherLevel: 'et_manager', staffLevel: null, roleKey: 'teacher:et_manager' },
    { role: 'teacher', teacherLevel: 'if_manager', staffLevel: null, roleKey: 'teacher:if_manager' },
    { role: 'teacher', teacherLevel: 'jt_manager', staffLevel: null, roleKey: 'teacher:jt_manager' },
    { role: 'teacher', teacherLevel: 'regular', staffLevel: null, roleKey: 'teacher:regular' },
    { role: 'office_staff', teacherLevel: null, staffLevel: 'event_lead', roleKey: 'office_staff:event_lead' },
    { role: 'office_staff', teacherLevel: null, staffLevel: 'curriculum_lead', roleKey: 'office_staff:curriculum_lead' },
    { role: 'office_staff', teacherLevel: null, staffLevel: 'bestep_lead', roleKey: 'office_staff:bestep_lead' },
    { role: 'office_staff', teacherLevel: null, staffLevel: 'deputy_manager', roleKey: 'office_staff:deputy_manager' },
  ];
}

async function run() {
  const tx = await sequelize.transaction();
  try {
    const summary = [];
    for (const seed of roleSeeds()) {
      const perms = unique(Array.from(buildBasePermissionSet({
        role: seed.role,
        teacherLevel: seed.teacherLevel,
        staffLevel: seed.staffLevel,
      })));
      const result = await syncRolePermissionsIfNeeded(seed.roleKey, perms, { transaction: tx });
      summary.push({
        role: seed.role,
        teacherLevel: seed.teacherLevel,
        staffLevel: seed.staffLevel,
        roleKey: seed.roleKey,
        permissionCount: result.count,
      });
    }
    await tx.commit();
    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } catch (err) {
    await tx.rollback();
    console.error('[seed-role-permissions] fatal', err);
    process.exit(1);
  }
}

run().then(() => process.exit(0));

