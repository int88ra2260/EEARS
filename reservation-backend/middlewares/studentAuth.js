const jwt = require('jsonwebtoken');
const { secretKey } = require('../config/jwtSecret');
const { StudentAccount } = require('../models');
const { TOKEN_TYP } = require('../services/studentAuthService');

function isStudentAccessToken(decoded) {
  return Boolean(decoded && decoded.typ === TOKEN_TYP);
}

function unauthorized(res, code = 'STUDENT_AUTH_REQUIRED', message = '請先登入學生帳號') {
  return res.status(401).json({ success: false, code, message });
}

function studentAuthMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return unauthorized(res);

  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err || !isStudentAccessToken(decoded) || !decoded.id) {
      const code = err && err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'STUDENT_AUTH_REQUIRED';
      const message = code === 'TOKEN_EXPIRED' ? '登入已過期，請重新登入' : '請先登入學生帳號';
      return unauthorized(res, code, message);
    }
    try {
      const account = await StudentAccount.findByPk(decoded.id);
      if (!account || account.status !== 'active' || account.studentId !== decoded.studentId) {
        return unauthorized(res);
      }
      req.studentAccount = account;
      return next();
    } catch (error) {
      return next(error);
    }
  });
}

/**
 * 以登入帳號覆寫請求裡的學號／姓名。email 預設一併覆寫。
 * 培力報名保留表單信箱（可能另有驗證），只綁學號與姓名。
 */
function bindStudentIdentity(options = {}) {
  const bindEmail = options.email !== false;
  return function bindStudentIdentityMiddleware(req, res, next) {
    const account = req.studentAccount;
    if (!account) return unauthorized(res);
    const apply = (target) => {
      if (!target || typeof target !== 'object') return;
      target.studentId = account.studentId;
      target.studentName = account.name;
      target.name = account.name;
      if (bindEmail) {
        target.studentEmail = account.email;
        target.email = account.email;
      }
    };
    apply(req.body);
    apply(req.query);
    return next();
  };
}

module.exports = {
  isStudentAccessToken,
  studentAuthMiddleware,
  bindStudentIdentity,
};
