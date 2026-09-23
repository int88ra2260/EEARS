'use strict';

const QRCode = require('qrcode');
const { formatBookingCode } = require('../utils/bookingCode');

const CHECKIN_QR_CID = 'eears-checkin-qr';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 產生預約現場簽到 QR（內容為 bookingCode，例 R-000360）
 * @param {number|string} reservationId
 * @returns {Promise<{ bookingCode: string, pngBuffer: Buffer, cid: string }|null>}
 */
async function buildReservationCheckinQr(reservationId) {
  const bookingCode = formatBookingCode(reservationId);
  if (!bookingCode) return null;

  const pngBuffer = await QRCode.toBuffer(bookingCode, {
    type: 'png',
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#111111', light: '#ffffff' },
  });

  return {
    bookingCode,
    pngBuffer,
    cid: CHECKIN_QR_CID,
  };
}

function appendCheckinCodeToText(textBody, bookingCode) {
  const body = String(textBody || '');
  if (!bookingCode) return body;
  if (body.includes(bookingCode) && body.includes('現場簽到')) return body;
  return `${body.trimEnd()}

【現場簽到碼／Check-in Code】
請於活動現場出示下列簽到碼或確認信中的 QR：
${bookingCode}

[On-site Check-in]
Please show this code (or the QR in this email) at the venue:
${bookingCode}
`;
}

function buildReservationSuccessHtml(bodyContent, bookingCode, cid = CHECKIN_QR_CID, { bodyIsHtml = false } = {}) {
  const safeCode = escapeHtml(bookingCode);
  const bodyBlock = bodyIsHtml
    ? `<div style="font-size:14px;line-height:1.55">${bodyContent}</div>`
    : `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:14px">${escapeHtml(bodyContent)}</pre>`;
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="utf-8" /><title>預約成功</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;line-height:1.55;color:#222;max-width:640px;margin:0 auto;padding:16px">
  <div style="border:1px solid #d9e2ec;border-radius:8px;padding:16px;margin-bottom:16px;background:#f8fafc">
    <p style="margin:0 0 8px;font-size:16px;font-weight:700">現場簽到 QR</p>
    <p style="margin:0 0 12px">簽到碼：<strong style="letter-spacing:0.04em">${safeCode}</strong></p>
    <img src="cid:${cid}" alt="Check-in QR ${safeCode}" width="220" height="220" style="display:block;border:0;margin:0 auto 8px" />
    <p style="margin:0;font-size:13px;color:#52606d;text-align:center">請於活動現場出示此圖或簽到碼</p>
  </div>
  ${bodyBlock}
</body>
</html>`;
}

/**
 * 若有 reservationId，為預約成功信附加 QR（html + cid attachment）
 * @param {object} mailOptions
 * @param {object} data
 */
async function attachReservationCheckinQr(mailOptions, data = {}) {
  const reservationId = data.reservationId ?? data.id;
  if (!reservationId || !mailOptions) return mailOptions;

  try {
    const qr = await buildReservationCheckinQr(reservationId);
    if (!qr) return mailOptions;

    const next = { ...mailOptions };
    next.text = appendCheckinCodeToText(next.text, qr.bookingCode);

    const existingHtml = next.html ? String(next.html) : '';
    const bodyIsHtml = Boolean(existingHtml.trim());
    if (bodyIsHtml) {
      // 已有富文字 HTML：在文件開頭插入 QR 區塊
      const qrBlock = `<div style="border:1px solid #d9e2ec;border-radius:8px;padding:16px;margin-bottom:16px;background:#f8fafc">
    <p style="margin:0 0 8px;font-size:16px;font-weight:700">現場簽到 QR</p>
    <p style="margin:0 0 12px">簽到碼：<strong style="letter-spacing:0.04em">${escapeHtml(qr.bookingCode)}</strong></p>
    <img src="cid:${qr.cid}" alt="Check-in QR ${escapeHtml(qr.bookingCode)}" width="220" height="220" style="display:block;border:0;margin:0 auto 8px" />
    <p style="margin:0;font-size:13px;color:#52606d;text-align:center">請於活動現場出示此圖或簽到碼</p>
  </div>`;
      if (/<body[^>]*>/i.test(existingHtml)) {
        next.html = existingHtml.replace(/<body([^>]*)>/i, `<body$1>${qrBlock}`);
      } else {
        next.html = buildReservationSuccessHtml(existingHtml, qr.bookingCode, qr.cid, { bodyIsHtml: true });
      }
    } else {
      next.html = buildReservationSuccessHtml(next.text, qr.bookingCode, qr.cid, { bodyIsHtml: false });
    }

    next.attachments = [
      ...(Array.isArray(next.attachments) ? next.attachments : []),
      {
        filename: `eears-checkin-${qr.bookingCode}.png`,
        content: qr.pngBuffer,
        cid: qr.cid,
        contentType: 'image/png',
      },
    ];
    return next;
  } catch (err) {
    console.error('[reservationCheckinQr] QR attach failed:', err.message || err);
    return mailOptions;
  }
}


/**
 * 後台預覽用：產生 data URL，並把 html 內 cid 換成可直接顯示的圖。
 * @param {object} mailOptions - 已跑過 attachReservationCheckinQr
 * @returns {{ bookingCode: string, dataUrl: string, htmlPreview: string|null, note: string }|null}
 */
function buildCheckinQrPreviewFromMail(mailOptions) {
  if (!mailOptions) return null;
  const att = (mailOptions.attachments || []).find((a) => a && a.cid === CHECKIN_QR_CID);
  if (!att || !Buffer.isBuffer(att.content)) return null;

  const bookingCode = String(att.filename || '')
    .replace(/^eears-checkin-/, '')
    .replace(/\.png$/i, '') || null;
  const dataUrl = `data:image/png;base64,${att.content.toString('base64')}`;
  const htmlPreview = mailOptions.html
    ? String(mailOptions.html).replace(`cid:${CHECKIN_QR_CID}`, dataUrl)
    : null;

  return {
    bookingCode,
    dataUrl,
    htmlPreview,
    note: '實際寄出時以此圖作為內嵌附件（CID）；純文字客戶端會看到簽到碼文字。',
  };
}

module.exports = {
  CHECKIN_QR_CID,
  formatBookingCode,
  buildReservationCheckinQr,
  appendCheckinCodeToText,
  buildReservationSuccessHtml,
  attachReservationCheckinQr,
  buildCheckinQrPreviewFromMail,
};
