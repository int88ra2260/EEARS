// controllers/teacherController.js
const { Teacher, Class, ClassMembership, ClassTeacher, sequelize } = require('../models');
const loginAccountCooldown = require('../utils/loginAccountCooldown');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const auditLogService = require('../services/auditLogService');
const {
  syncPermissionOverrides,
  syncUserScopes,
  bumpAccessVersion,
} = require('../services/accessControl/writeService');
const {
  getUserOverrides,
  getUserScopes,
} = require('../services/accessControl/readService');
const { buildAccessDebugApiPayload } = require('../services/accessControl/debugService');
const {
  validateCreatePermissionOverrides,
  resolveUpdatePermissionOverrides,
  assignmentDeniedResponse,
} = require('../auth/permissionAssignmentPolicy');
const {
  validatePasswordPolicy,
  buildPasswordPolicyContext,
  generateCompliantTempPassword,
  passwordPolicyHttpBody,
} = require('../utils/passwordPolicy');
const { isLeaderOnlyAccountManagerUser } = require('../auth/accessProfile');

const ALLOWED_ROLES = ['admin', 'worker', 'teacher', 'office_staff', 'leader'];
const ALLOWED_TEACHER_LEVELS = ['regular', 'executive', 'et_manager', 'if_manager', 'jt_manager'];
const ALLOWED_STAFF_LEVELS = ['event_lead', 'curriculum_lead', 'bestep_lead', 'deputy_manager'];

function passwordPolicyContextFromTeacher(teacher) {
  return buildPasswordPolicyContext({
    username: teacher.username,
    email: teacher.email,
    name: teacher.name,
    displayName: teacher.name,
    role: teacher.role,
  });
}

function passwordPolicyContextFromPayload({ username, email, name, role }) {
  return buildPasswordPolicyContext({
    username,
    email,
    name,
    displayName: name,
    role,
  });
}

function isFlagEnabled(name, defaultValue = false) {
  const val = process.env[name];
  if (val == null || val === '') return defaultValue;
  return String(val).toLowerCase() === 'true' || String(val) === '1';
}

function mapTeacherResponse(teacher, accessData = null) {
  const resolvedPermissions = accessData && accessData.permissions !== undefined
    ? accessData.permissions
    : (teacher.permissions || null);
  const resolvedScopes = accessData && accessData.scopes !== undefined
    ? accessData.scopes
    : (Array.isArray(teacher.scopes) ? teacher.scopes : null);
  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    username: teacher.username,
    role: teacher.role,
    teacherLevel: teacher.teacherLevel || null,
    staffLevel: teacher.staffLevel || null,
    department: teacher.department,
    phone: teacher.phone,
    isActive: teacher.isActive,
    mustResetPassword: teacher.mustResetPassword,
    disabledReason: teacher.disabledReason || null,
    permissions: resolvedPermissions,
    scopes: resolvedScopes,
    accessVersion: teacher.accessVersion || 1,
    lastLoginAt: teacher.lastLoginAt,
    createdAt: teacher.createdAt,
    updatedAt: teacher.updatedAt
  };
}

function isSystemAdminReq(req) {
  return !!(req && req.user && req.user.role === 'admin');
}

function forbidIfManagingAdminByNonAdmin(req, targetTeacher, nextRole) {
  // 副理／執行長可管理一般帳號，但不可管理 admin
  if (isSystemAdminReq(req)) return null;
  if (targetTeacher && targetTeacher.role === 'admin') return '僅系統管理員可管理 admin 帳號';
  if (nextRole === 'admin') return '僅系統管理員可建立或升級為 admin';
  return null;
}

function forbidIfManagingNonLeaderByLeaderOnlyManager(req, targetTeacher, nextRole) {
  if (!isLeaderOnlyAccountManagerUser(req.user)) return null;
  const role = nextRole || (targetTeacher && targetTeacher.role);
  if (role !== 'leader') {
    return '僅可管理 ET Leader（學生桌長）帳號';
  }
  return null;
}

function accountGovernanceForbidden(req, targetTeacher, nextRole) {
  return forbidIfManagingAdminByNonAdmin(req, targetTeacher, nextRole)
    || forbidIfManagingNonLeaderByLeaderOnlyManager(req, targetTeacher, nextRole);
}

function validateUsernameInput(raw) {
  const username = String(raw || '').trim();
  if (!username) return { ok: false, error: '帳號名稱不可為空' };
  if (username.length < 3 || username.length > 50) {
    return { ok: false, error: '帳號名稱需為 3～50 字元' };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return { ok: false, error: '帳號名稱僅可使用英文、數字、點、底線、連字號' };
  }
  return { ok: true, username };
}

async function findTeacherByUsernameInsensitive(username, { excludeId, transaction } = {}) {
  const normalized = loginAccountCooldown.normalizeUsername(username);
  const where = {
    [Op.and]: [
      sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), normalized),
    ],
  };
  if (excludeId != null) {
    where[Op.and].push({ id: { [Op.ne]: excludeId } });
  }
  return Teacher.findOne({ where, transaction });
}

function shouldBumpAccessVersion(before, after) {
  const fields = [
    'role',
    'teacherLevel',
    'staffLevel',
    'permissions',
    'scopes',
    'isActive',
    'mustResetPassword',
    'email',
    'username',
  ];
  return fields.some((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

/**
 * 創建老師帳號
 * POST /api/admin/teachers
 */
async function createTeacher(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const {
      name,
      email,
      username,
      password,
      department,
      phone,
      role = 'teacher',
      teacherLevel = 'regular',
      staffLevel = null,
      studentId = null,
      isActive = true,
      permissions = null,
      scopes = null,
      disabledReason = null,
    } = req.body;

    if (!name || !email || !username) {
      await transaction.rollback();
      return res.status(400).json({
        error: '缺少必要欄位',
        required: ['name', 'email', 'username']
      });
    }

    const normalizedRole = ALLOWED_ROLES.includes(role) ? role : 'teacher';
    if (normalizedRole === 'office_staff') {
      const sl = staffLevel && ALLOWED_STAFF_LEVELS.includes(staffLevel) ? staffLevel : null;
      if (!sl) {
        await transaction.rollback();
        return res.status(400).json({
          error: '行政職員須指定職務',
          allowedStaffLevels: ALLOWED_STAFF_LEVELS,
        });
      }
    }
    const forbidCreate = accountGovernanceForbidden(req, null, normalizedRole);
    if (forbidCreate) {
      await transaction.rollback();
      return res.status(403).json({ error: forbidCreate });
    }

    const existingTeacher = await Teacher.findOne({
      where: {
        [Op.or]: [
          { email },
          { username }
        ]
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (existingTeacher) {
      await transaction.rollback();
      return res.status(409).json({
        error: '帳號或信箱已存在',
        field: existingTeacher.email === email ? 'email' : 'username'
      });
    }

    const policyContext = passwordPolicyContextFromPayload({
      username,
      email,
      name,
      role: normalizedRole,
    });
    const tempPassword = password || generateCompliantTempPassword(14, policyContext);
    const policyResult = validatePasswordPolicy(tempPassword, policyContext);
    if (!policyResult.valid) {
      await transaction.rollback();
      return res.status(400).json(passwordPolicyHttpBody(policyResult));
    }
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const jsonMirrorWrite = isFlagEnabled('ACCESS_PROFILE_JSON_MIRROR_WRITE', false);
    const permissionOverrides = permissions && typeof permissions === 'object' ? permissions : null;
    const scopeOverrides = Array.isArray(scopes) ? scopes : null;

    const createPermErr = validateCreatePermissionOverrides(req, permissionOverrides);
    if (createPermErr) {
      await transaction.rollback();
      const denied = assignmentDeniedResponse();
      return res.status(denied.status).json(denied.body);
    }

    const teacher = await Teacher.create({
      name,
      email,
      username,
      studentId: normalizedRole === 'leader' ? (String(studentId || '').trim() || null) : null,
      password: hashedPassword,
      department: department || null,
      phone: phone || null,
      role: normalizedRole,
      teacherLevel: normalizedRole === 'teacher' ? (teacherLevel || 'regular') : null,
      staffLevel: normalizedRole === 'office_staff' ? staffLevel : null,
      isActive: !!isActive,
      disabledReason: !!isActive ? null : (disabledReason || null),
      mustResetPassword: true,
      passwordChangedAt: null,
      permissions: jsonMirrorWrite ? permissionOverrides : null,
      scopes: jsonMirrorWrite ? scopeOverrides : null,
      createdBy: req.user?.username || null
    }, { transaction });

    await syncPermissionOverrides(teacher.id, permissionOverrides, req.user, { transaction });
    await syncUserScopes(teacher.id, scopeOverrides, req.user, { transaction });

    await transaction.commit();

    auditLogService.logAccessGovernanceAudit({
      action: 'account_created',
      entityId: teacher.id,
      targetSummary: `${teacher.username} / ${teacher.role}`,
      beforeData: null,
      afterData: {
        id: teacher.id,
        username: teacher.username,
        role: teacher.role,
        teacherLevel: teacher.teacherLevel,
        staffLevel: teacher.staffLevel || null,
        permissions: permissionOverrides,
        scopes: scopeOverrides,
        isActive: teacher.isActive,
        accessVersion: teacher.accessVersion || 1,
      },
      req,
      changeReason: 'create_teacher_account',
    });

    res.status(201).json({
      success: true,
      data: {
        ...mapTeacherResponse(teacher),
        permissions: permissionOverrides,
        scopes: scopeOverrides,
        temporaryPassword: password ? undefined : tempPassword
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * 獲取老師列表
 * GET /api/admin/teachers
 */
async function getTeachers(req, res, next) {
  try {
    const {
      page = 1,
      pageSize = 20,
      search = '',
      role,
      status,
      teacherLevel,
      staffLevel,
      mustResetPassword,
    } = req.query;
    const offset = (page - 1) * pageSize;

    const whereClause = {};
    if (role && ALLOWED_ROLES.includes(role)) {
      whereClause.role = role;
    }
    if (teacherLevel && ALLOWED_TEACHER_LEVELS.includes(teacherLevel)) {
      whereClause.teacherLevel = teacherLevel;
    }
    if (staffLevel && ALLOWED_STAFF_LEVELS.includes(staffLevel)) {
      whereClause.staffLevel = staffLevel;
    }
    if (status === 'active') {
      whereClause.isActive = true;
    } else if (status === 'inactive') {
      whereClause.isActive = false;
    }
    if (mustResetPassword === 'true' || mustResetPassword === '1') {
      whereClause.mustResetPassword = true;
    } else if (mustResetPassword === 'false' || mustResetPassword === '0') {
      whereClause.mustResetPassword = false;
    }
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } }
      ];
    }

    if (isLeaderOnlyAccountManagerUser(req.user)) {
      whereClause.role = 'leader';
      delete whereClause.teacherLevel;
      delete whereClause.staffLevel;
    } else if (!isSystemAdminReq(req)) {
      if (whereClause.role === 'admin') {
        return res.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            totalPages: 0,
            currentPage: parseInt(page),
            pageSize: parseInt(pageSize),
          },
        });
      }
      if (!whereClause.role) {
        whereClause.role = { [Op.ne]: 'admin' };
      }
    }

    const { count, rows: teachers } = await Teacher.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'name', 'email', 'username', 'studentId', 'role', 'teacherLevel', 'staffLevel', 'department', 'phone', 'isActive', 'disabledReason', 'mustResetPassword', 'permissions', 'scopes', 'accessVersion', 'lastLoginAt', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    });

    const accessRows = await Promise.all(
      teachers.map(async (t) => {
        const [permissions, scopes] = await Promise.all([
          getUserOverrides(t.id),
          getUserScopes(t.id),
        ]);
        return [t.id, { permissions, scopes }];
      })
    );
    const accessByTeacherId = new Map(accessRows);

    res.json({
      success: true,
      data: teachers.map((t) => mapTeacherResponse(t, accessByTeacherId.get(t.id))),
      pagination: {
        total: count,
        totalPages: Math.ceil(count / pageSize),
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * 獲取老師負責的班級
 * GET /api/admin/teachers/:teacherId/classes
 */
async function getTeacherClasses(req, res, next) {
  try {
    const { teacherId } = req.params;
    const { semester = '114-1' } = req.query;

    const teacher = await Teacher.findByPk(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: '老師不存在' });
    }

    const classes = await Class.findAll({
      include: [{
        model: ClassMembership,
        as: 'ClassMemberships',
        attributes: ['studentId']
      }],
      where: {
        semester,
        teacherName: teacher.name
      },
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        department: teacher.department
      },
      classes: classes.map(cls => ({
        id: cls.id,
        name: cls.name,
        department: cls.department,
        studentCount: cls.ClassMemberships.length
      }))
    });

  } catch (error) {
    next(error);
  }
}

/**
 * 老師查看學生參與狀況
 * GET /api/teachers/students/participation
 */
async function getStudentParticipation(req, res, next) {
  try {
    const { semester = '114-1', classId } = req.query;
    const teacherId = req.user.id; // 從 JWT 中獲取

    // 獲取老師負責的班級
    const classes = await Class.findAll({
      where: {
        semester,
        teacherName: req.user.name // 使用 JWT 中的老師姓名
      }
    });

    if (classes.length === 0) {
      return res.status(404).json({
        error: '沒有找到您負責的班級'
      });
    }

    // 如果指定了特定班級，只查詢該班級
    let targetClasses = classes;
    if (classId) {
      targetClasses = classes.filter(cls => cls.id === parseInt(classId));
      if (targetClasses.length === 0) {
        return res.status(404).json({
          error: '您沒有權限查看此班級'
        });
      }
    }

    // 獲取班級統計
    const classStats = await Promise.all(targetClasses.map(async (classRecord) => {
      const studentIds = await ClassMembership.findAll({
        where: { classId: classRecord.id, semester },
        attributes: ['studentId']
      }).then(memberships => memberships.map(m => m.studentId));

      // 這裡可以添加參與統計邏輯
      // 暫時返回基本資訊
      return {
        classId: classRecord.id,
        className: classRecord.name,
        department: classRecord.department,
        studentCount: studentIds.length
      };
    }));

    res.json({
      success: true,
      data: classStats
    });

  } catch (error) {
    next(error);
  }
}

/**
 * 更新老師帳號資訊
 * PATCH /api/admin/teachers/:teacherId
 */
async function updateTeacher(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const { teacherId } = req.params;
    const {
      name,
      email,
      username,
      department,
      phone,
      role,
      teacherLevel,
      staffLevel,
      studentId,
      isActive,
      permissions,
      scopes,
      disabledReason,
      mustResetPassword,
    } = req.body;

    const teacher = await Teacher.findByPk(teacherId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: '找不到指定帳號' });
    }

    const nextRole = role || teacher.role;
    let nextStaffLevel = null;
    if (nextRole === 'office_staff') {
      nextStaffLevel = staffLevel !== undefined && staffLevel !== null ? staffLevel : teacher.staffLevel;
      if (!nextStaffLevel || !ALLOWED_STAFF_LEVELS.includes(nextStaffLevel)) {
        await transaction.rollback();
        return res.status(400).json({
          error: '行政職員須指定有效職務',
          allowedStaffLevels: ALLOWED_STAFF_LEVELS,
        });
      }
    }
    const forbid = accountGovernanceForbidden(req, teacher, nextRole);
    if (forbid) {
      await transaction.rollback();
      return res.status(403).json({ error: forbid });
    }
    const before = {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      username: teacher.username,
      department: teacher.department,
      phone: teacher.phone,
      role: teacher.role,
      teacherLevel: teacher.teacherLevel || null,
      staffLevel: teacher.staffLevel || null,
      isActive: teacher.isActive,
      mustResetPassword: teacher.mustResetPassword,
      disabledReason: teacher.disabledReason || null,
      permissions: null,
      scopes: null,
      accessVersion: teacher.accessVersion || 1,
    };
    const beforeAccess = {
      permissions: await getUserOverrides(teacher.id, { transaction }),
      scopes: await getUserScopes(teacher.id, { transaction }),
    };
    before.permissions = beforeAccess.permissions;
    before.scopes = beforeAccess.scopes;

    if (email && email !== teacher.email) {
      const emailTaken = await Teacher.findOne({ where: { email }, transaction });
      if (emailTaken) {
        await transaction.rollback();
        return res.status(409).json({ error: 'Email 已被使用', field: 'email' });
      }
    }

    let nextUsername = teacher.username;
    if (username !== undefined) {
      const usernameCheck = validateUsernameInput(username);
      if (!usernameCheck.ok) {
        await transaction.rollback();
        return res.status(400).json({ error: usernameCheck.error, field: 'username' });
      }
      nextUsername = usernameCheck.username;
      if (
        loginAccountCooldown.normalizeUsername(nextUsername)
        !== loginAccountCooldown.normalizeUsername(teacher.username)
      ) {
        const usernameTaken = await findTeacherByUsernameInsensitive(nextUsername, {
          excludeId: teacher.id,
          transaction,
        });
        if (usernameTaken) {
          await transaction.rollback();
          return res.status(409).json({ error: '帳號名稱已被使用', field: 'username' });
        }
      }
    }

    if (role && !ALLOWED_ROLES.includes(role)) {
      await transaction.rollback();
      return res.status(400).json({ error: '角色不合法', allowed: ALLOWED_ROLES });
    }

    const nextIsActive = typeof isActive === 'boolean' ? isActive : teacher.isActive;
    const nextDisabledReason = nextIsActive ? null : (disabledReason ?? teacher.disabledReason ?? null);

    const updatePayload = {
      name: name ?? teacher.name,
      email: email ?? teacher.email,
      username: nextUsername,
      studentId: nextRole === 'leader'
        ? (studentId !== undefined ? (String(studentId || '').trim() || null) : teacher.studentId)
        : null,
      department: department ?? teacher.department,
      phone: phone ?? teacher.phone,
      role: nextRole,
      teacherLevel: nextRole === 'teacher' ? (teacherLevel ?? teacher.teacherLevel ?? 'regular') : null,
      staffLevel: nextStaffLevel,
      isActive: nextIsActive,
      disabledReason: nextDisabledReason,
    };
    const jsonMirrorWrite = isFlagEnabled('ACCESS_PROFILE_JSON_MIRROR_WRITE', false);
    let nextPermissionOverrides = beforeAccess.permissions;
    if (permissions !== undefined) {
      const resolved = resolveUpdatePermissionOverrides(req, permissions, beforeAccess.permissions);
      if (!resolved.ok) {
        await transaction.rollback();
        const denied = assignmentDeniedResponse();
        return res.status(denied.status).json(denied.body);
      }
      if (resolved.merged !== undefined) {
        nextPermissionOverrides = resolved.merged;
      }
    }
    const nextScopes = scopes !== undefined
      ? (Array.isArray(scopes) ? scopes : null)
      : beforeAccess.scopes;

    // permission overrides/scopes：null 代表清除覆寫（回到 base）
    if (permissions !== undefined) {
      updatePayload.permissions = jsonMirrorWrite ? nextPermissionOverrides : null;
    }
    if (scopes !== undefined) {
      updatePayload.scopes = jsonMirrorWrite ? nextScopes : null;
    }
    if (typeof mustResetPassword === 'boolean') {
      updatePayload.mustResetPassword = mustResetPassword;
    }

    await teacher.update(updatePayload, { transaction });

    const afterForVersion = {
      role: teacher.role,
      teacherLevel: teacher.teacherLevel || null,
      staffLevel: teacher.staffLevel || null,
      permissions: nextPermissionOverrides,
      scopes: nextScopes,
      isActive: teacher.isActive,
      mustResetPassword: teacher.mustResetPassword,
      email: teacher.email,
      username: nextUsername,
    };

    if (permissions !== undefined) {
      await syncPermissionOverrides(teacher.id, nextPermissionOverrides, req.user, { transaction });
    }
    if (scopes !== undefined) {
      await syncUserScopes(teacher.id, nextScopes, req.user, { transaction });
    }

    if (shouldBumpAccessVersion(before, afterForVersion)) {
      await bumpAccessVersion(teacher.id, 'teacher_access_fields_updated', { transaction });
      await teacher.reload({ transaction });
    }

    await transaction.commit();

    auditLogService.logAccessGovernanceAudit({
      action: 'account_updated',
      entityId: teacher.id,
      targetSummary: `${teacher.username || teacher.email || ''} / ${teacher.role}`,
      beforeData: {
        ...before,
        permissions: beforeAccess.permissions,
        scopes: beforeAccess.scopes,
      },
      afterData: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
        phone: teacher.phone,
        role: teacher.role,
        teacherLevel: teacher.teacherLevel || null,
        staffLevel: teacher.staffLevel || null,
        isActive: teacher.isActive,
        disabledReason: teacher.disabledReason || null,
        permissions: nextPermissionOverrides,
        scopes: nextScopes,
        mustResetPassword: teacher.mustResetPassword,
        accessVersion: teacher.accessVersion || 1,
      },
      req,
      changeReason: 'update_teacher_access_governance',
    });

    if (before.isActive !== teacher.isActive) {
      auditLogService.logSecurityAuditImmediate(req, {
        module: 'accounts',
        action: teacher.isActive ? 'account_enabled' : 'account_disabled',
        entityType: 'Teacher',
        entityId: String(teacher.id),
        targetSummary: teacher.username || String(teacher.id),
        afterData: { isActive: teacher.isActive, disabledReason: teacher.disabledReason || null },
        operatorId: req.user?.id != null ? req.user.id : null,
        operatorRole: req.user?.role || null,
        operatorName: req.user?.name || req.user?.user || null,
      });
    }

    if (
      permissions !== undefined &&
      JSON.stringify(beforeAccess.permissions || null) !== JSON.stringify(nextPermissionOverrides || null)
    ) {
      auditLogService.logSecurityAuditImmediate(req, {
        module: 'accounts',
        action: 'permission_override_changed',
        entityType: 'Teacher',
        entityId: String(teacher.id),
        targetSummary: teacher.username || String(teacher.id),
        beforeData: { permissions: beforeAccess.permissions },
        afterData: { permissions: nextPermissionOverrides },
        operatorId: req.user?.id != null ? req.user.id : null,
        operatorRole: req.user?.role || null,
        operatorName: req.user?.name || req.user?.user || null,
      });
    }

    res.json({
      success: true,
      data: mapTeacherResponse(teacher, {
        permissions: nextPermissionOverrides,
        scopes: nextScopes,
      })
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * 重設老師密碼
 * POST /api/admin/teachers/:teacherId/reset-password
 */
async function resetTeacherPassword(req, res, next) {
  try {
    const { teacherId } = req.params;
    const teacher = await Teacher.findByPk(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: '找不到指定帳號' });
    }

    const forbid = accountGovernanceForbidden(req, teacher, teacher.role);
    if (forbid) {
      return res.status(403).json({ error: forbid });
    }

    const before = {
      id: teacher.id,
      mustResetPassword: teacher.mustResetPassword,
      passwordChangedAt: teacher.passwordChangedAt || null,
    };

    const policyContext = passwordPolicyContextFromTeacher(teacher);
    let newPassword;
    try {
      newPassword = generateCompliantTempPassword(14, policyContext);
    } catch (_err) {
      return res.status(500).json({ success: false, error: '無法產生符合政策的臨時密碼，請稍後再試' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);

    await teacher.update({
      password: hashed,
      mustResetPassword: true,
      passwordChangedAt: null
    });

    await bumpAccessVersion(teacher.id, 'reset_teacher_password');
    await teacher.reload();

    auditLogService.logAuditAsync({
      module: 'accounts',
      action: 'account_password_reset',
      entityType: 'Teacher',
      entityId: teacher.id,
      targetSummary: `teacherId=${teacher.id}`,
      beforeData: before,
      afterData: {
        mustResetPassword: true,
        passwordChangedAt: null,
      },
      req,
    });

    res.json({
      success: true,
      data: {
        ...mapTeacherResponse(teacher),
        temporaryPassword: newPassword
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 使用者自行變更密碼
 * POST /api/teachers/change-password
 */
async function changeOwnPassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const teacher = await Teacher.findByPk(req.user.id);
    if (!teacher || !teacher.isActive) {
      return res.status(404).json({ error: '帳號不存在或已停用' });
    }

    if (!newPassword) {
      return res.status(400).json({ success: false, code: 'PASSWORD_REQUIRED', error: '請輸入新密碼' });
    }

    const policyResult = validatePasswordPolicy(newPassword, passwordPolicyContextFromTeacher(teacher));
    if (!policyResult.valid) {
      return res.status(400).json(passwordPolicyHttpBody(policyResult));
    }

    const before = {
      id: teacher.id,
      mustResetPassword: teacher.mustResetPassword,
      passwordChangedAt: teacher.passwordChangedAt || null,
    };

    if (!teacher.mustResetPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: '請提供目前密碼' });
      }
      const match = await bcrypt.compare(currentPassword, teacher.password);
      if (!match) {
        return res.status(401).json({ error: '目前密碼不正確' });
      }
    }

    const duplicated = await bcrypt.compare(newPassword, teacher.password);
    if (duplicated) {
      return res.status(400).json({ error: '新密碼不可與舊密碼相同' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    const now = new Date();

    await teacher.update({
      password: hashed,
      mustResetPassword: false,
      passwordChangedAt: now
    });

    await bumpAccessVersion(teacher.id, 'change_own_password');
    await teacher.reload();

    auditLogService.logAuditAsync({
      module: 'accounts',
      action: 'account_password_changed',
      entityType: 'Teacher',
      entityId: teacher.id,
      targetSummary: `teacherId=${teacher.id}`,
      beforeData: before,
      afterData: {
        mustResetPassword: false,
        passwordChangedAt: now,
      },
      req,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * 刪除後台帳號
 * DELETE /api/admin/teachers/:teacherId
 */
async function deleteTeacher(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const teacherId = parseInt(req.params.teacherId, 10);
    if (!Number.isFinite(teacherId) || teacherId <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'teacherId 無效' });
    }

    const teacher = await Teacher.findByPk(teacherId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: '找不到指定帳號' });
    }

    const forbid = accountGovernanceForbidden(req, teacher, teacher.role);
    if (forbid) {
      await transaction.rollback();
      return res.status(403).json({ success: false, error: forbid });
    }

    if (Number(req.user?.id) === Number(teacher.id)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        code: 'CANNOT_DELETE_SELF',
        error: '無法刪除目前登入中的帳號',
      });
    }

    if (teacher.role === 'admin') {
      const adminCount = await Teacher.count({ where: { role: 'admin' }, transaction });
      if (adminCount <= 1) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          code: 'LAST_ADMIN_ACCOUNT',
          error: '系統至少需保留一個管理員帳號',
        });
      }
    }

    const before = {
      id: teacher.id,
      username: teacher.username,
      email: teacher.email,
      role: teacher.role,
      name: teacher.name,
      isActive: teacher.isActive,
    };

    await ClassTeacher.destroy({ where: { teacherId: teacher.id }, transaction });
    await teacher.destroy({ transaction });
    await transaction.commit();

    auditLogService.logAccessGovernanceAudit({
      action: 'account_deleted',
      entityId: before.id,
      targetSummary: `${before.username || before.email || ''} / ${before.role}`,
      beforeData: before,
      afterData: null,
      actor: req.user,
      req,
    });

    return res.json({ success: true, data: before });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * GET /api/admin/teachers/:teacherId/access-debug
 * 權限來源除錯（不含密碼／token）
 */
async function getTeacherAccessDebug(req, res, next) {
  try {
    const teacherId = parseInt(req.params.teacherId, 10);
    if (!Number.isFinite(teacherId) || teacherId <= 0) {
      return res.status(400).json({ success: false, error: 'teacherId 無效' });
    }
    const payload = await buildAccessDebugApiPayload(teacherId);
    if (!payload) {
      return res.status(404).json({ success: false, error: '找不到此帳號。', code: 'TEACHER_NOT_FOUND' });
    }
    return res.json({ success: true, data: payload, requestId: req.requestId });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  createTeacher,
  getTeachers,
  getTeacherClasses,
  getStudentParticipation,
  updateTeacher,
  deleteTeacher,
  resetTeacherPassword,
  changeOwnPassword,
  getTeacherAccessDebug,
};
