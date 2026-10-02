/**
 * 培力英檢寄信前預覽：收件對象、主旨、學生會看到的中文內容。
 * 個人欄位以 {{ }} 表示，實際寄出時依每位報名資料帶入。
 */
import { getRejectionReasonText } from '../constants/englishTestRejectionReasons';

const PERSONAL_NOTE = '姓名、學號、報名編號、報考項目會依每位學生的報名資料帶入。同一封信後面會附上英文說明。';

const MAIL_SPECS = {
  revision: {
    subject: '[培力英檢] 報名資料請修正通知 / BESTEP Registration Revision Required',
    audience: '狀態將改為「請修正」，並寄出請修正通知',
    body: `親愛的 {{姓名}}（{{學號}}）您好，

您的 BESTEP 培力英檢報名需請依下列說明修正後重新提交。

【報名資料確認】
審核狀態：請修正

【請修正原因】
{{請修正原因}}

【後續流程】
請至培力英檢報名頁，使用「查看與編輯」依上述原因修正後重新提交。
如有疑問，請聯繫全英語卓越教學中心（emicenter@mail.nsysu.edu.tw）。`,
  },
  failed: {
    subject: '[培力英檢] 報名結果通知 / BESTEP Registration Result',
    audience: '狀態為「報名失敗」者',
    body: `親愛的 {{姓名}}（{{學號}}）您好，

感謝您報名 BESTEP 培力英檢。經審核後，本次報名未通過。

【報名資料】
狀態：報名失敗

【報名失敗原因】
{{失敗原因}}

如有疑問，請聯繫全英語卓越教學中心（emicenter@mail.nsysu.edu.tw）。`,
  },
  success: {
    subject: '[培力英檢] 報名成功通知 / BESTEP Registration Success',
    audience: '狀態為「報名成功」的全部報名者',
    body: `親愛的 {{姓名}}（{{學號}}）您好，

恭喜！您的 BESTEP 培力英檢報名已確認成功。

【報名資料確認】
狀態：報名成功

【後續流程】
考試相關資訊（時間、地點、注意事項等）將另行通知，請密切關注您的 Email。

感謝您的報名，祝您考試順利！
全英語卓越教學中心`,
  },
  group_promo: {
    subject: '找學伴一起考英檢｜組隊報名最高可拿 5,000 元',
    audience: '狀態為「報名成功」且四項皆報考（LRSW）者',
    body: `親愛的 {{姓名}} 您好：

想準備英檢，卻總是少一點動力或沒人一起？
這學期，西灣學院全英中心推出【學習有伴培力英檢獎勵專案】，邀請你和朋友組隊一起報考培力英檢。

活動重點：
• 3–4 人自由組隊
• 全員應考聽說讀寫即可獲得基本獎勵金
• 表現優異可獲得最高 5,000 元獎勵金
• 名額有限，額滿即止

專案說明與報名方式會附上團體報名連結。
西灣學院 全英語卓越教學中心`,
  },
};

const CATALOG_KIND = {
  englishTestRegistrationRejected: 'revision',
  englishTestRegistrationFinalFailure: 'failed',
  englishTestRegistrationFinalSuccess: 'success',
  englishTestRegistrationGroupPromo: 'group_promo',
};

function formatReasons(reasons, other) {
  const list = (Array.isArray(reasons) ? reasons : [])
    .map((id) => getRejectionReasonText(id))
    .filter(Boolean);
  const extra = String(other || '').trim();
  if (extra) list.push(`其他：${extra}`);
  return list.length > 0 ? list.join('\n') : '（依每位學生的原因帶入）';
}

function applyReasonPlaceholders(body, { reasons, reasonOther } = {}) {
  const text = formatReasons(reasons, reasonOther);
  return body
    .replace('{{請修正原因}}', text)
    .replace('{{失敗原因}}', text);
}

export function getEnglishTestMailSpec(kind) {
  return MAIL_SPECS[kind] || null;
}

export function getEnglishTestCatalogMailPreview(templateKey) {
  const kind = CATALOG_KIND[templateKey];
  if (!kind) return null;
  const spec = MAIL_SPECS[kind];
  return {
    subject: spec.subject,
    body: applyReasonPlaceholders(spec.body),
    personalNote: PERSONAL_NOTE,
  };
}

/**
 * @param {'success'|'failed'|'group_promo'|'revision'} kind
 */
export function buildBatchMailPreview({ kind, semester, total, reasons, reasonOther } = {}) {
  const spec = MAIL_SPECS[kind];
  if (!spec) return null;
  const sem = String(semester || '').trim();
  const countKnown = Number.isFinite(Number(total));
  const count = countKnown ? Number(total) : null;
  const audience = [
    sem ? `只寄學期 ${sem}` : '尚未指定學期',
    spec.audience,
    '不會寄給其他學期的報名者',
    '畫面的搜尋、年級、日期篩選不會縮小這次寄送範圍',
  ];
  if (count == null) audience.push('正在計算收件人數…');
  else if (count <= 0) audience.push('預計寄出 0 封（沒有符合的報名者，不會寄信）');
  else audience.push(`預計寄出 ${count} 封`);

  return {
    audience,
    subject: spec.subject,
    body: applyReasonPlaceholders(spec.body, { reasons, reasonOther }),
    personalNote: PERSONAL_NOTE,
    count,
    empty: count === 0,
  };
}

export function buildSelectedMailPreview({
  kind,
  semester,
  count = 1,
  recipientLabel,
  reasons,
  reasonOther,
} = {}) {
  const spec = MAIL_SPECS[kind === 'failed' ? 'failed' : 'revision'];
  const sem = String(semester || '').trim();
  const n = Number(count) || 1;
  const audience = [
    sem ? `只處理學期 ${sem} 的勾選資料` : '尚未指定學期',
    recipientLabel || (n > 1 ? `已勾選 ${n} 筆` : '這一筆報名'),
    n > 1
      ? `這 ${n} 筆會改為「${kind === 'failed' ? '報名失敗' : '請修正'}」，並各寄 1 封`
      : `這筆會改為「${kind === 'failed' ? '報名失敗' : '請修正'}」，並寄 1 封`,
    '若勾選混有其他學期，整批會取消，不會更新也不會寄信',
  ];
  return {
    audience,
    subject: spec.subject,
    body: applyReasonPlaceholders(spec.body, { reasons, reasonOther }),
    personalNote: PERSONAL_NOTE,
    count: n,
    empty: false,
  };
}
