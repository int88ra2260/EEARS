'use strict';

/**
 * 後台 SSO 登入服務
 * 使用中山單一入口認證教職員，並對應到 teachers 表
 */

const { Teacher, sequelize } = require('../models');
const nsysuSsoClient = require('./nsysuSsoClient');
const logger = require('../utils/logger');

const CAMPUS_SSO_HOME = 'https://sso.nsysu.edu.tw';

/**
 * 建立 HTTP 錯誤
 */
function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeEmpno(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function findTeacherByUsername(empno) {
  const normalized = normalizeEmpno(empno);
  if (!normalized) return null;
  return Teacher.findOne({
    where: sequelize.where(
      sequelize.fn('UPPER', sequelize.col('username')),
      normalized
    ),
  });
}

async function findTeacherByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return Teacher.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      normalized
    ),
  });
}

/**
 * 依 SSO 資料對應 teachers 帳號（僅允許中心已建檔帳號，絕不自動建立）。
 * 對應鍵只用強識別：員工編號(username) → 信箱。
 * 不用姓名單獨對應，避免校內其他同名教職員誤入中心帳號。
 *
 * @returns {Promise<{ teacher: object, matchBy: string }|null>}
 */
async function resolveTeacherFromSsoProfile(ssoProfile, empno) {
  const ssoEmail = normalizeEmail(ssoProfile?.EMAIL);
  const ssoEmpno = normalizeEmpno(empno || ssoProfile?.EMPNO);

  // 1) 員工編號 → username（中心建帳時建議 username＝員編）
  if (ssoEmpno) {
    const byUsername = await findTeacherByUsername(ssoEmpno);
    if (byUsername) {
      return { teacher: byUsername, matchBy: 'empno' };
    }
  }

  // 2) 信箱 → email（既有帳號 username 未必是員編時的備援）
  if (ssoEmail) {
    const byEmail = await findTeacherByEmail(ssoEmail);
    if (byEmail) {
      return { teacher: byEmail, matchBy: 'email' };
    }
  }

  return null;
}

/**
 * 用 SSO 登入後台
 * @param {Object} params
 * @param {string} params.userName - 員工編號
 * @param {string} params.password - 密碼
 * @param {Object} [sso] - SSO 客戶端（測試用）
 * @returns {Promise<Object>} 包含 teacher 資料和 ssoProfile
 */
async function loginWithCampusSso({ userName, password }, sso = nsysuSsoClient) {
  const normalizedUserName = normalizeEmpno(userName);

  if (!normalizedUserName || !password) {
    throw httpError(400, 'INVALID_INPUT', '請輸入員工編號和密碼');
  }

  // 1. 認證
  let authenticated = false;
  try {
    authenticated = await sso.authUser({ userName: normalizedUserName, password });
  } catch (e) {
    logger.error('SSO authUser 失敗', { error: e.message, userName: normalizedUserName });
    const err = httpError(503, 'SSO_UNAVAILABLE', '單一入口暫時無法連線，請稍後再試');
    err.redirectUrl = CAMPUS_SSO_HOME;
    throw err;
  }

  if (!authenticated) {
    throw httpError(401, 'INVALID_CREDENTIALS', '員工編號或密碼錯誤');
  }

  // 2. 檢查密碼狀態
  let passwordStatus = '';
  try {
    passwordStatus = String(await sso.verifyPasswordExpired(normalizedUserName) || '').trim().toUpperCase();
  } catch (e) {
    logger.error('SSO verifyPasswordExpired 失敗', { error: e.message, userName: normalizedUserName });
    const err = httpError(503, 'SSO_UNAVAILABLE', '單一入口暫時無法連線，請稍後再試');
    err.redirectUrl = CAMPUS_SSO_HOME;
    throw err;
  }

  // NO_NODATA: 使用預設密碼或未曾變更過密碼
  // NO_EXPIRE: 密碼已到期
  if (passwordStatus === 'NO_NODATA' || passwordStatus === 'NO_EXPIRE') {
    const err = httpError(403, 'PASSWORD_CHANGE_REQUIRED',
      passwordStatus === 'NO_NODATA'
        ? '您使用預設密碼或未曾變更過密碼，請先至單一入口變更密碼'
        : '您的密碼已到期，請先至單一入口變更密碼'
    );
    err.redirectUrl = CAMPUS_SSO_HOME;
    throw err;
  }

  if (passwordStatus !== 'OK') {
    logger.warn('SSO 密碼狀態異常', { userName: normalizedUserName, passwordStatus });
    const err = httpError(503, 'SSO_UNAVAILABLE', '單一入口暫時無法確認密碼狀態，請稍後再試');
    err.redirectUrl = CAMPUS_SSO_HOME;
    throw err;
  }

  // 3. 取得教職員資料
  let ssoProfile = null;
  try {
    ssoProfile = await sso.getAttr({
      userName: normalizedUserName,
      password,
      attrs: sso.EMPLOYEE_AUTH_ATTRS,
    });
  } catch (e) {
    logger.error('SSO getAttr 失敗', { error: e.message, userName: normalizedUserName });
    const err = httpError(503, 'SSO_UNAVAILABLE', '單一入口暫時無法連線，請稍後再試');
    err.redirectUrl = CAMPUS_SSO_HOME;
    throw err;
  }

  if (!ssoProfile || !ssoProfile.EMPNO) {
    throw httpError(503, 'SSO_UNAVAILABLE', '單一入口沒有回傳個人資料，請稍後再試');
  }

  // 4. 檢查離職狀態
  if (ssoProfile.LEAVE && ssoProfile.LEAVE.toUpperCase() !== 'N') {
    throw httpError(403, 'ACCOUNT_DISABLED', '此帳號已離職，無法登入');
  }

  // 5. 僅對應中心已建檔帳號（員工編號／信箱）；未建檔一律拒絕，不自動開通
  const resolved = await resolveTeacherFromSsoProfile(ssoProfile, normalizedUserName);
  if (!resolved) {
    logger.warn('SSO 登入拒絕：系統尚未建檔', {
      userName: normalizedUserName,
      empno: ssoProfile.EMPNO,
      email: ssoProfile.EMAIL ? normalizeEmail(ssoProfile.EMAIL) : null,
    });
    throw httpError(403, 'ACCOUNT_NOT_FOUND',
      '您的帳號尚未由英語中心建立，無法登入。請聯繫管理員開通後再試'
    );
  }

  const { teacher, matchBy } = resolved;
  logger.info('SSO 帳號對應成功', {
    userName: normalizedUserName,
    teacherId: teacher.id,
    matchBy,
  });

  if (!teacher.isActive) {
    throw httpError(403, 'ACCOUNT_DISABLED', '此帳號已停用');
  }

  // 6. 更新最後登入時間
  await teacher.update({ lastLoginAt: new Date() });

  return {
    teacher,
    ssoProfile,
    authMethod: 'campus_sso',
    matchBy,
  };
}

/**
 * 檢查 SSO 是否啟用
 */
function isEnabled() {
  return nsysuSsoClient.isEnabled();
}

module.exports = {
  loginWithCampusSso,
  resolveTeacherFromSsoProfile,
  isEnabled,
  CAMPUS_SSO_HOME,
};
