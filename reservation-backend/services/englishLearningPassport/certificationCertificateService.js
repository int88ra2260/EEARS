'use strict';

const {
  EnglishLearningPassport,
  EnglishLearningSubmission,
  EnglishLearningPointRule,
} = require('../../models');
const {
  CERTIFICATION_STATUS,
  SUBMISSION_STATUS,
  CERTIFICATION_THRESHOLD,
} = require('./constants');
const { logElpAudit } = require('./auditService');

const CENTER_NAME = '國立中山大學 全英語卓越教學中心';

function escapeHtml(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const roc = y - 1911;
  return `${roc} 年 ${m} 月 ${day} 日（${y}-${m}-${day}）`;
}

function formatDateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

async function buildCertificationCertificateData(ctx) {
  const passport = await EnglishLearningPassport.findOne({
    where: { studentId: ctx.studentId },
    order: [['id', 'DESC']],
  });
  if (!passport) {
    const err = new Error('尚未申請護照');
    err.status = 404;
    err.code = 'PASSPORT_NOT_FOUND';
    throw err;
  }
  if (
    passport.studentName.trim() !== ctx.studentName ||
    passport.studentEmail.toLowerCase() !== ctx.studentEmail.toLowerCase()
  ) {
    const err = new Error('學生身分驗證失敗');
    err.status = 403;
    err.code = 'STUDENT_MISMATCH';
    throw err;
  }
  if (passport.certificationStatus !== CERTIFICATION_STATUS.APPROVED) {
    const err = new Error('尚未通過英語能力標準認證，無法匯出認證單');
    err.status = 403;
    err.code = 'CERTIFICATION_NOT_APPROVED';
    throw err;
  }

  const [rules, submissions] = await Promise.all([
    EnglishLearningPointRule.findAll({ order: [['sortOrder', 'ASC']] }),
    EnglishLearningSubmission.findAll({
      where: { passportId: passport.id, status: SUBMISSION_STATUS.APPROVED },
      order: [['reviewedAt', 'ASC'], ['id', 'ASC']],
    }),
  ]);

  const ruleNameByCode = {};
  rules.forEach((r) => {
    ruleNameByCode[r.code] = r.name;
  });

  const pointsByRule = {};
  const approvedItems = submissions.map((sub, index) => {
    const j = sub.toJSON();
    const pts = j.pointsApproved || 0;
    pointsByRule[j.ruleCode] = (pointsByRule[j.ruleCode] || 0) + pts;
    return {
      index: index + 1,
      ruleCode: j.ruleCode,
      ruleName: ruleNameByCode[j.ruleCode] || j.ruleCode,
      title: j.title || '—',
      activityDate: j.activityDate || '—',
      pointsApproved: pts,
      reviewedAt: j.reviewedAt,
    };
  });

  const p = passport.toJSON();
  const certDate = p.certificationReviewedAt || p.completedAt;

  return {
    generatedAt: new Date().toISOString(),
    centerName: CENTER_NAME,
    documentTitle: '英語實踐歷程護照 集點完成審核表（精簡版）',
    passport: {
      id: p.id,
      studentId: p.studentId,
      studentName: p.studentName,
      studentEmail: p.studentEmail,
      totalApprovedPoints: p.totalApprovedPoints,
      certificationStatus: p.certificationStatus,
      certificationReviewedAt: certDate,
      completedAt: p.completedAt,
    },
    threshold: CERTIFICATION_THRESHOLD,
    pointsByRule: Object.entries(pointsByRule).map(([code, points]) => ({
      code,
      name: ruleNameByCode[code] || code,
      points,
    })),
    approvedItems,
  };
}

function renderPointsByRuleRows(pointsByRule) {
  if (!pointsByRule.length) {
    return '<tr><td colspan="3" class="center muted">尚無核准項目</td></tr>';
  }
  return pointsByRule.map((row, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${escapeHtml(row.name)}</td>
      <td class="center">${row.points}</td>
    </tr>
  `).join('');
}

function renderApprovedItemRows(items) {
  if (!items.length) {
    return '<tr><td colspan="5" class="center muted">尚無核准項目明細</td></tr>';
  }
  return items.map((row) => `
    <tr>
      <td class="center">${row.index}</td>
      <td>${escapeHtml(row.ruleName)}</td>
      <td>${escapeHtml(row.title)}</td>
      <td class="center">${escapeHtml(row.activityDate)}</td>
      <td class="center">${row.pointsApproved}</td>
    </tr>
  `).join('');
}

function renderCertificationCertificateHtml(data, { autoPrint = false } = {}) {
  const p = data.passport;
  const certDateText = formatDate(p.certificationReviewedAt);
  const autoPrintScript = autoPrint
    ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},300);});</script>'
    : '';

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.documentTitle)} - ${escapeHtml(p.studentName)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", Arial, sans-serif;
      color: #111;
      margin: 0;
      padding: 16px 20px 24px;
      font-size: 13px;
      line-height: 1.45;
    }
    .no-print { margin-bottom: 12px; }
    .no-print button {
      font-size: 14px;
      padding: 8px 16px;
      cursor: pointer;
      border: 1px solid #334155;
      background: #fff;
      border-radius: 4px;
    }
    .header { text-align: center; margin-bottom: 18px; }
    .school { font-size: 15px; font-weight: 700; letter-spacing: 0.05em; }
    .center-name { font-size: 14px; margin-top: 4px; }
    .doc-title {
      font-size: 18px;
      font-weight: 700;
      margin-top: 14px;
      padding: 8px 0;
      border-top: 2px solid #111;
      border-bottom: 2px solid #111;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 16px;
    }
    th, td {
      border: 1px solid #111;
      padding: 6px 8px;
      vertical-align: middle;
    }
    th {
      background: #f3f4f6;
      font-weight: 700;
      text-align: center;
    }
    .info-table th { width: 18%; text-align: left; }
    .info-table td { width: 32%; }
    .center { text-align: center; }
    .section-title {
      font-weight: 700;
      margin: 14px 0 6px;
      font-size: 14px;
    }
    .statement {
      border: 1px solid #111;
      padding: 12px 14px;
      margin: 16px 0;
      min-height: 72px;
    }
    .sign-row {
      display: flex;
      justify-content: space-between;
      margin-top: 28px;
      gap: 24px;
    }
    .sign-box {
      flex: 1;
      border-top: 1px solid #111;
      padding-top: 8px;
      min-height: 64px;
    }
    .muted { color: #6b7280; }
    .footnote { font-size: 11px; color: #4b5563; margin-top: 12px; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button type="button" onclick="window.print()">列印 / 另存為 PDF</button>
  </div>

  <div class="header">
    <div class="school">國立中山大學</div>
    <div class="center-name">${escapeHtml(data.centerName)}</div>
    <div class="doc-title">${escapeHtml(data.documentTitle)}</div>
  </div>

  <table class="info-table">
    <tbody>
      <tr>
        <th>學號</th>
        <td>${escapeHtml(p.studentId)}</td>
        <th>姓名</th>
        <td>${escapeHtml(p.studentName)}</td>
      </tr>
      <tr>
        <th>Email</th>
        <td colspan="3">${escapeHtml(p.studentEmail)}</td>
      </tr>
      <tr>
        <th>累積核准點數</th>
        <td>${p.totalApprovedPoints} 點（門檻 ${data.threshold} 點）</td>
        <th>最終認證審核日</th>
        <td>${escapeHtml(certDateText)}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">一、各類別核准點數</div>
  <table>
    <thead>
      <tr><th style="width:8%">序號</th><th>項目類別</th><th style="width:18%">核准點數</th></tr>
    </thead>
    <tbody>
      ${renderPointsByRuleRows(data.pointsByRule)}
      <tr>
        <td colspan="2" class="center" style="font-weight:700">合計</td>
        <td class="center" style="font-weight:700">${p.totalApprovedPoints}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">二、核准項目明細</div>
  <table>
    <thead>
      <tr>
        <th style="width:8%">序號</th>
        <th style="width:22%">項目類別</th>
        <th>名稱</th>
        <th style="width:14%">活動／修課日期</th>
        <th style="width:12%">核准點數</th>
      </tr>
    </thead>
    <tbody>
      ${renderApprovedItemRows(data.approvedItems)}
    </tbody>
  </table>

  <div class="statement">
    茲證明上述學生已完成「英語實踐歷程護照」集點作業，累積核准點數達 ${data.threshold} 點以上，
    並經本中心審核通過<strong>英語文能力標準認證</strong>（英語實踐歷程檔案途徑）。
  </div>

  <div class="sign-row">
    <div class="sign-box">
      審核單位：${escapeHtml(data.centerName)}<br />
      （簽章）
    </div>
    <div class="sign-box">
      審核日期：${escapeHtml(certDateText)}
    </div>
  </div>

  <p class="footnote">
    本表由 EEARS 英語實踐歷程護照系統產生（${escapeHtml(formatDateShort(data.generatedAt))}）。
    列印後可另存為 PDF；正式認證以中心核准紀錄為準。
  </p>
  ${autoPrintScript}
</body>
</html>`;
}

async function exportCertificationCertificate(ctx, req, { autoPrint = false } = {}) {
  const data = await buildCertificationCertificateData(ctx);
  const html = renderCertificationCertificateHtml(data, { autoPrint });
  const fileName = `英語實踐歷程護照_集點完成審核表_${data.passport.studentId}.html`;

  await logElpAudit({
    req,
    studentContext: ctx,
    action: 'certification_certificate_export',
    targetType: 'EnglishLearningPassport',
    targetId: data.passport.id,
    after: { studentId: data.passport.studentId, format: 'html' },
  });

  return { html, fileName, data };
}

module.exports = {
  buildCertificationCertificateData,
  renderCertificationCertificateHtml,
  exportCertificationCertificate,
};
