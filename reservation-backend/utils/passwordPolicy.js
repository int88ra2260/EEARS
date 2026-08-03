/**
 * 後台管理者帳號密碼政策（建立／重設／自行變更共用）
 */

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

const WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  'admin',
  'admin123',
  'admin123456',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'qwerty123',
  'letmein',
  'welcome',
  'changeme',
  'test1234',
  'nsysu123',
  'eears123',
]);

const PASSWORD_POLICY_USER_MESSAGE =
  '密碼需至少 12 碼，並符合至少三種字元類型：大寫英文、小寫英文、數字、符號。不可使用常見弱密碼，亦不可包含帳號、Email 或姓名。';

const CHARSET_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CHARSET_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const CHARSET_DIGIT = '23456789';
const CHARSET_SYMBOL = '@$!';

function pickChar(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildPasswordPolicyContext(context = {}) {
  const username = context.username != null ? String(context.username).trim() : '';
  const email = context.email != null ? String(context.email).trim() : '';
  const name = context.name != null ? String(context.name).trim() : '';
  const displayName = context.displayName != null ? String(context.displayName).trim() : '';
  const emailLocal = email.includes('@') ? email.split('@')[0].trim() : email;

  const nameCandidates = [];
  for (const part of [name, displayName]) {
    if (!part) continue;
    nameCandidates.push(part);
    for (const token of part.split(/\s+/)) {
      if (token) nameCandidates.push(token);
    }
  }

  return {
    username,
    email,
    emailLocal,
    name,
    displayName,
    role: context.role != null ? String(context.role).trim() : '',
    nameCandidates: [...new Set(nameCandidates)],
  };
}

function fail(code, message, errors = null) {
  const list = errors && errors.length
    ? errors
    : [{ code, message }];
  return {
    valid: false,
    code,
    message: message || list[0].message,
    errors: list,
  };
}

function ok() {
  return { valid: true, code: 'OK', message: '', errors: [] };
}

function countCharClasses(password) {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
}

function containsInsensitive(haystack, needle) {
  if (!needle || needle.length < 2) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function hasLongRepeatingRun(value, minLen = 6) {
  if (!value || value.length < minLen) return false;
  let run = 1;
  for (let i = 1; i < value.length; i += 1) {
    if (value[i] === value[i - 1]) run += 1;
    else run = 1;
    if (run >= minLen) return true;
  }
  return false;
}

function hasLongSequentialRun(value, minLen = 6) {
  if (!value || value.length < minLen) return false;
  const s = value.toLowerCase();
  let asc = 1;
  let desc = 1;
  for (let i = 1; i < s.length; i += 1) {
    const diff = s.charCodeAt(i) - s.charCodeAt(i - 1);
    asc = diff === 1 ? asc + 1 : 1;
    desc = diff === -1 ? desc + 1 : 1;
    if (asc >= minLen || desc >= minLen) return true;
  }
  return false;
}

function isWeakPassword(normalized) {
  if (WEAK_PASSWORDS.has(normalized)) return true;
  for (const weak of WEAK_PASSWORDS) {
    if (weak.length >= 6 && normalized.includes(weak)) return true;
  }
  return false;
}

/**
 * @param {string} password
 * @param {object} [context]
 * @returns {{ valid: boolean, code: string, message: string, errors: Array<{code:string,message:string}> }}
 */
function validatePasswordPolicy(password, context = {}) {
  const errors = [];

  if (password == null || typeof password !== 'string') {
    return fail('PASSWORD_REQUIRED', '請輸入密碼');
  }

  if (password.trim() === '') {
    return fail('PASSWORD_EMPTY', '密碼不可為空白');
  }

  if (password !== password.trim()) {
    errors.push({ code: 'PASSWORD_TRIM', message: '密碼不可包含開頭或結尾空白' });
  }

  if (password.length < MIN_LENGTH) {
    errors.push({ code: 'PASSWORD_TOO_SHORT', message: `密碼至少需 ${MIN_LENGTH} 碼` });
  }

  if (password.length > MAX_LENGTH) {
    errors.push({ code: 'PASSWORD_TOO_LONG', message: `密碼不可超過 ${MAX_LENGTH} 碼` });
  }

  if (countCharClasses(password) < 3) {
    errors.push({
      code: 'PASSWORD_COMPLEXITY',
      message: '密碼須包含大寫英文、小寫英文、數字、符號中的至少三種',
    });
  }

  const normalized = password.toLowerCase();
  if (isWeakPassword(normalized)) {
    errors.push({ code: 'WEAK_PASSWORD', message: '不可使用常見弱密碼' });
  }

  const ctx = buildPasswordPolicyContext(context);
  if (ctx.username && ctx.username.length >= 3 && containsInsensitive(password, ctx.username)) {
    errors.push({ code: 'PASSWORD_CONTAINS_USERNAME', message: '密碼不可包含帳號名稱' });
  }
  if (ctx.emailLocal && ctx.emailLocal.length >= 3 && containsInsensitive(password, ctx.emailLocal)) {
    errors.push({ code: 'PASSWORD_CONTAINS_EMAIL', message: '密碼不可包含 Email 帳號前綴' });
  }
  for (const namePart of ctx.nameCandidates) {
    if (namePart && namePart.length >= 2 && containsInsensitive(password, namePart)) {
      errors.push({ code: 'PASSWORD_CONTAINS_NAME', message: '密碼不可包含姓名' });
      break;
    }
  }

  if (hasLongRepeatingRun(password, 6)) {
    errors.push({ code: 'PASSWORD_REPEATING', message: '密碼不可使用過多重複字元' });
  }
  if (hasLongSequentialRun(password, 6)) {
    errors.push({ code: 'PASSWORD_SEQUENTIAL', message: '密碼不可使用連續字元序列' });
  }

  if (errors.length) {
    const hasWeak = errors.some((e) => e.code === 'WEAK_PASSWORD');
    return fail(
      hasWeak ? 'WEAK_PASSWORD' : 'PASSWORD_POLICY_VIOLATION',
      errors[0].message,
      errors
    );
  }

  return ok();
}

/**
 * 產生符合政策的臨時密碼（用於建立／重設；不含帳號資訊比對時請傳入 context）
 */
function generateCompliantTempPassword(length = 14, context = {}) {
  const targetLen = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, length));
  const all = CHARSET_UPPER + CHARSET_LOWER + CHARSET_DIGIT + CHARSET_SYMBOL;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const chars = [
      pickChar(CHARSET_UPPER),
      pickChar(CHARSET_LOWER),
      pickChar(CHARSET_DIGIT),
      pickChar(CHARSET_SYMBOL),
    ];
    while (chars.length < targetLen) {
      chars.push(pickChar(all));
    }
    const candidate = shuffleArray(chars).join('');
    if (validatePasswordPolicy(candidate, context).valid) {
      return candidate;
    }
  }

  throw new Error('無法產生符合密碼政策的臨時密碼');
}

function passwordPolicyHttpBody(result) {
  const code = result.code === 'WEAK_PASSWORD' ? 'WEAK_PASSWORD' : 'PASSWORD_POLICY_VIOLATION';
  return {
    success: false,
    code,
    error: result.message || PASSWORD_POLICY_USER_MESSAGE,
    errors: (result.errors || []).map((e) => ({ code: e.code, message: e.message })),
  };
}

module.exports = {
  MIN_LENGTH,
  MAX_LENGTH,
  PASSWORD_POLICY_USER_MESSAGE,
  buildPasswordPolicyContext,
  validatePasswordPolicy,
  generateCompliantTempPassword,
  passwordPolicyHttpBody,
};
