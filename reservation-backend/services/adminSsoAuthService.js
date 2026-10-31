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

/**
 * 用 SSO 登入後台
 * @param {Object} params
 * @param {string} params.userName - 員工編號
 * @param {string} params.password - 密碼
 * @param {Object} [sso] - SSO 客戶端（測試用）
 * @returns {Promise<Object>} 包含 teacher 資料和 ssoProfile
 */
async function loginWithCampusSso({ userName, password }, sso = nsysuSsoClient) {
  const normalizedUserName = String(userName || '').trim().toUpperCase();
  
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

  // 5. 對應到 teachers 表（優先用 EMPNO → username，否則用 EMAIL → email）
  let teacher = await Teacher.findOne({
    where: sequelize.where(
      sequelize.fn('UPPER', sequelize.col('username')),
      normalizedUserName
    ),
  });

  if (!teacher && ssoProfile.EMAIL) {
    const normalizedEmail = ssoProfile.EMAIL.trim().toLowerCase();
    teacher = await Teacher.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        normalizedEmail
      ),
    });
  }

  if (!teacher) {
    throw httpError(403, 'ACCOUNT_NOT_FOUND', 
      '您的員工編號尚未在系統中建立帳號，請聯繫管理員'
    );
  }

  if (!teacher.isActive) {
    throw httpError(403, 'ACCOUNT_DISABLED', '此帳號已停用');
  }

  // 6. 更新最後登入時間
  await teacher.update({ lastLoginAt: new Date() });

  return {
    teacher,
    ssoProfile,
    authMethod: 'campus_sso',
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
  isEnabled,
  CAMPUS_SSO_HOME,
};
