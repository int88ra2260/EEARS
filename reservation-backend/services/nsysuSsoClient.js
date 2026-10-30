'use strict';

const SOAP_NAMESPACE = 'urn:xmethods-delayed-demo';
const DEFAULT_ENDPOINT = 'https://sso.nsysu.edu.tw/ssoWebservice/ws_server.php';
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

module.exports = {
  isEnabled,
  endpoint,
  buildEnvelope,
  parseResult,
  isAccepted,
  authStu,
  verifyPasswordExpired,
  getStuAttr,
  AUTH_ATTRS,
  STUDENT_ATTRS,
};
