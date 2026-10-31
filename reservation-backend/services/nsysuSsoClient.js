'use strict';

const SOAP_NAMESPACE = 'urn:xmethods-delayed-demo';
const DEFAULT_ENDPOINT = 'https://sso.nsysu.edu.tw/ssoWebservice/ws_server.php';

// 學生屬性
const AUTH_ATTRS = ['STUID', 'CNAME', 'EMAIL', 'STAT_COD'];
const STUDENT_ATTRS = [
  'STUID',
  'CNAME',
  'DPT_DESC',
  'T_CID',
  'GRADE',
  'TEL_NO',
  'ZIP_COD2',
  'CITY2',
  'ADDR2',
  'EMAIL',
  'BIRTH_YR',
  'BIRTH_MM',
  'BIRTH_DD',
  'STAT_COD',
];

// 教職員屬性（不含 IDNO 身分證號，避免 PII 風險）
const EMPLOYEE_AUTH_ATTRS = ['EMPNO', 'NAME', 'EMAIL', 'LEAVE'];
const EMPLOYEE_ATTRS = [
  'EMPNO',      // 員工編號
  'NAME',       // 姓名
  'PKIND',      // 屬性（身分類別）
  'GRPNO',      // 群組代號
  'UNICOD1',    // 一級單位代號
  'DPT_DESC1',  // 一級單位名稱
  'UNICOD2',    // 二級單位代號
  'DPT_DESC2',  // 二級單位名稱
  'LEAVE',      // 是否離職
  'TITCOD',     // 職稱編號
  'TITLE',      // 職稱名稱
  'EMAIL',      // 電子信箱
  'POFTEL',     // 辦公室電話
];

function isEnabled() {
  return String(process.env.NSYSU_SSO_ENABLED || '').toLowerCase() === 'true';
}

function endpoint() {
  return process.env.NSYSU_SSO_ENDPOINT || DEFAULT_ENDPOINT;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildEnvelope(operation, params) {
  const parts = params.map((value, index) => (
    `<param${index + 1} xsi:type="xsd:string">${escapeXml(value)}</param${index + 1}>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="${SOAP_NAMESPACE}">`
    + `<soapenv:Body><urn:${operation} soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">${parts}</urn:${operation}></soapenv:Body>`
    + `</soapenv:Envelope>`;
}

function parseResult(xml) {
  const match = String(xml || '').match(/<Result\b[^>]*>([\s\S]*?)<\/Result>/i);
  if (!match) {
    const err = new Error('單一入口沒有回傳核對結果');
    err.code = 'SSO_BAD_RESPONSE';
    throw err;
  }
  return match[1].trim();
}

function isAccepted(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

async function callOperation(operation, params, deps = {}) {
  const fetchImpl = deps.fetch || global.fetch;
  const url = deps.endpoint || endpoint();
  const timeoutMs = deps.timeoutMs || 12000;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `${SOAP_NAMESPACE}#${operation}`,
    },
    body: buildEnvelope(operation, params),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    const err = new Error('單一入口連線失敗');
    err.code = 'SSO_HTTP';
    throw err;
  }
  return parseResult(text);
}

async function authStu({ stuid, password, statCod = '1;2' }, deps) {
  const result = await callOperation('authStu', [stuid, password, 'ENC', statCod], deps);
  return isAccepted(result);
}

async function verifyPasswordExpired(userName, deps) {
  return callOperation('verifypwdexpired', [userName], deps);
}

async function getStuAttr({ stuid, password, statCod = '1;2', attrs = STUDENT_ATTRS }, deps) {
  const fields = Array.isArray(attrs) && attrs.length ? attrs : STUDENT_ATTRS;
  const raw = await callOperation(
    'getStuAttr',
    [stuid, password, 'ENC', statCod, fields.join(';')],
    deps,
  );
  if (!raw) return null;
  const parts = raw.split(';');
  return fields.reduce((profile, key, index) => {
    profile[key] = String(parts[index] || '').trim();
    return profile;
  }, {});
}

// ========== 教職員 API ==========

/**
 * 教職員認證
 * @param {Object} params
 * @param {string} params.userName - 員工編號
 * @param {string} params.password - 密碼
 * @param {Object} [deps] - 依賴注入（測試用）
 * @returns {Promise<boolean>} 認證成功返回 true
 */
async function authUser({ userName, password }, deps) {
  const result = await callOperation('authUser', [userName, password, 'ENC'], deps);
  return isAccepted(result);
}

/**
 * 取得教職員屬性
 * @param {Object} params
 * @param {string} params.userName - 員工編號
 * @param {string} params.password - 密碼
 * @param {string[]} [params.attrs] - 要取得的屬性，預設 EMPLOYEE_ATTRS
 * @param {Object} [deps] - 依賴注入（測試用）
 * @returns {Promise<Object|null>} 教職員資料物件
 */
async function getAttr({ userName, password, attrs = EMPLOYEE_ATTRS }, deps) {
  const fields = Array.isArray(attrs) && attrs.length ? attrs : EMPLOYEE_ATTRS;
  const raw = await callOperation(
    'getAttr',
    [userName, password, 'ENC', fields.join(';')],
    deps,
  );
  if (!raw) return null;
  const parts = raw.split(';');
  return fields.reduce((profile, key, index) => {
    profile[key] = String(parts[index] || '').trim();
    return profile;
  }, {});
}

module.exports = {
  // 通用
  isEnabled,
  endpoint,
  buildEnvelope,
  parseResult,
  isAccepted,
  verifyPasswordExpired,
  
  // 學生 API
  authStu,
  getStuAttr,
  AUTH_ATTRS,
  STUDENT_ATTRS,
  
  // 教職員 API
  authUser,
  getAttr,
  EMPLOYEE_AUTH_ATTRS,
  EMPLOYEE_ATTRS,
};
