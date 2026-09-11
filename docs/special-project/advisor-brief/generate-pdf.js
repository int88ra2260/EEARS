/**
 * Generate one-page advisor brief PDF for Prof. Ming-Chi Liu.
 * Run: node generate-pdf.js
 * Optional: place PNG screenshots in ./screenshots/ (see README).
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const HERE = __dirname;
const OUT = path.join(HERE, process.argv[2] || 'EEARS-advisor-brief-Chen.pdf');
const FONT_REG = 'C:/Windows/Fonts/NotoSansCJKtc-Regular.otf';
const FONT_BOLD = 'C:/Windows/Fonts/NotoSansCJKtc-Bold.otf';
const LOGO = path.resolve(HERE, '../../../reservation-frontend/public/images/og-home.jpg');

const ACCENT = '#1f4f82';
const MUTED = '#5b6573';
const INK = '#1a2332';
const SOFT = '#f3f6fa';
const LINE = '#d8dee6';

function shotPath(id) {
  const png = path.join(HERE, 'screenshots', `${id}.png`);
  const jpg = path.join(HERE, 'screenshots', `${id}.jpg`);
  if (fs.existsSync(png)) return png;
  if (fs.existsSync(jpg)) return jpg;
  return null;
}

function drawPlaceholder(doc, x, y, w, h, title, hint) {
  doc.save();
  doc.roundedRect(x, y, w, h, 4).fillAndStroke('#f6f8fa', LINE);
  doc.fillColor(MUTED).font('Bold').fontSize(9)
    .text(title, x + 8, y + h / 2 - 14, { width: w - 16, align: 'center' });
  doc.font('Regular').fontSize(8)
    .text(hint, x + 8, y + h / 2 + 2, { width: w - 16, align: 'center' });
  doc.restore();
}

function drawShot(doc, file, x, y, w, h, title, caption) {
  const imgH = h - 28;
  if (file) {
    try {
      doc.image(file, x, y, { width: w, height: imgH, fit: [w, imgH], align: 'center', valign: 'center' });
      doc.rect(x, y, w, imgH).stroke(LINE);
    } catch (_) {
      drawPlaceholder(doc, x, y, w, imgH, title, '截圖載入失敗，請改放 PNG');
    }
  } else {
    drawPlaceholder(doc, x, y, w, imgH, title, '請放入 screenshots 對應 PNG');
  }
  doc.fillColor(INK).font('Bold').fontSize(8).text(title, x, y + imgH + 4, { width: w });
  doc.fillColor(MUTED).font('Regular').fontSize(7.5).text(caption, x, y + imgH + 14, { width: w });
}

function main() {
  if (!fs.existsSync(FONT_REG) || !fs.existsSync(FONT_BOLD)) {
    console.error('Missing NotoSansCJKtc fonts under C:/Windows/Fonts');
    process.exit(1);
  }

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, bottom: 36, left: 40, right: 40 },
    info: {
      Title: 'EEARS 畢業專題提案摘要｜陳竑仰',
      Author: '陳竑仰 D0786893',
      Subject: '懇請劉明機教授擔任專題指導',
    },
  });

  const stream = fs.createWriteStream(OUT);
  doc.pipe(stream);

  doc.registerFont('Regular', FONT_REG);
  doc.registerFont('Bold', FONT_BOLD);

  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;
  const left = doc.page.margins.left;

  // Header
  if (fs.existsSync(LOGO)) {
    doc.image(LOGO, left, y, { width: 36, height: 36 });
  }
  doc.fillColor(ACCENT).font('Bold').fontSize(14)
    .text('EEARS 畢業專題提案摘要', left + 46, y + 2, { width: pageW - 160 });
  doc.fillColor(MUTED).font('Regular').fontSize(8.5)
    .text('校園英語學習支援系統 × 教育資料科學／學習分析', left + 46, y + 20);

  doc.fillColor(INK).font('Bold').fontSize(10)
    .text('陳竑仰', left + pageW - 110, y + 2, { width: 110, align: 'right' });
  doc.fillColor(MUTED).font('Regular').fontSize(8)
    .text('逢甲大學 資訊工程學系\n學號 D0786893\n2026 年 9 月', left + pageW - 110, y + 14, {
      width: 110,
      align: 'right',
      lineGap: 1,
    });

  y += 48;
  doc.moveTo(left, y).lineTo(left + pageW, y).lineWidth(1.5).strokeColor(ACCENT).stroke();
  y += 10;

  // Request box
  doc.save();
  doc.rect(left, y, pageW, 42).fill(SOFT);
  doc.rect(left, y, 4, 42).fill(ACCENT);
  doc.restore();
  doc.fillColor(INK).font('Regular').fontSize(9)
    .text(
      '請求：懇請劉明機教授考慮擔任大學畢業專題指導教授。系統已上線運作；至 12 月發表前，希望在老師指導下完成題目界定、去識別化學習分析與論文化發表。',
      left + 12,
      y + 8,
      { width: pageW - 20, lineGap: 1.5 }
    );
  y += 52;

  // Section 1
  doc.fillColor(ACCENT).font('Bold').fontSize(11).text('一、系統簡介', left, y);
  y += 16;
  doc.moveTo(left, y).lineTo(left + pageW, y).lineWidth(0.6).strokeColor(LINE).stroke();
  y += 8;
  doc.fillColor(INK).font('Regular').fontSize(9)
    .text(
      'EEARS（English Enhancement and Activity Reservation System）是供國立中山大學英語中心使用的英語學習支援平台，整合活動預約與取消、問卷門檻、英檢報名、學習歷程，以及管理端成效分析與維運。技術棧為 Node.js／Express＋React，並已完成正式環境部署。',
      left,
      y,
      { width: pageW, lineGap: 1.5 }
    );
  y = doc.y + 6;
  doc.fillColor(ACCENT).font('Regular').fontSize(8)
    .text('正式站：https://emieears-siwan.nsysu.edu.tw/', left, y);
  y += 12;
  doc.text('GitHub：https://github.com/int88ra2260/EEARS', left, y);
  y += 16;

  const chips = ['創新學習軟體（真實現場）', '學習歷程整合', '成效分析 KPI／技能成長', '問卷門檻與參與資料'];
  let cx = left;
  chips.forEach((c) => {
    const tw = doc.widthOfString(c) + 10;
    if (cx + tw > left + pageW) {
      cx = left;
      y += 16;
    }
    doc.save();
    doc.roundedRect(cx, y, tw, 13, 2).fill('#e8eef5');
    doc.restore();
    doc.fillColor(INK).font('Regular').fontSize(7.5).text(c, cx + 5, y + 2.5);
    cx += tw + 6;
  });
  y += 22;

  // Section 2
  doc.fillColor(ACCENT).font('Bold').fontSize(11).text('二、與指導方向的對齊', left, y);
  y += 16;
  doc.moveTo(left, y).lineTo(left + pageW, y).lineWidth(0.6).strokeColor(LINE).stroke();
  y += 8;
  doc.fillColor(INK).font('Regular').fontSize(9)
    .text(
      '本專題希望對齊老師專長中的「創新學習軟體設計」與「教育資料科學／學習分析」：EEARS 不僅是預約系統，更可持續累積活動參與、問卷完成與學習歷程資料，作為描述性學習分析與成效觀察的基礎（分析採去識別化彙總；不主張未經設計的因果推論）。',
      left,
      y,
      { width: pageW, lineGap: 1.5 }
    );
  y = doc.y + 10;

  // Section 3 screenshots
  doc.fillColor(ACCENT).font('Bold').fontSize(11).text('三、代表性畫面（著重成效／歷程）', left, y);
  y += 16;
  doc.moveTo(left, y).lineTo(left + pageW, y).lineWidth(0.6).strokeColor(LINE).stroke();
  y += 8;

  const gap = 10;
  const half = (pageW - gap) / 2;
  const shotH = 108;
  drawShot(
    doc,
    shotPath('01-learning-analytics'),
    left,
    y,
    half,
    shotH,
    '圖 1｜英語學習成效分析總覽',
    'B2+ 達標率、前後測樣本、技能成長等 KPI'
  );
  drawShot(
    doc,
    shotPath('02-student-profile'),
    left + half + gap,
    y,
    half,
    shotH,
    '圖 2｜學生事件時間軸（個資已遮罩）',
    '入學基準／英檢／修課／活動歷程整合'
  );
  y += shotH + 6;

  // 圖 3：正式站首頁 + footer 署名佐證
  const portalH = 72;
  const footerH = 48;
  const portalFile = shotPath('03-student-portal');
  const footerFile = shotPath('03b-footer-credit');
  const portalImgH = portalH - 22;
  if (portalFile) {
    try {
      doc.image(portalFile, left, y, {
        width: pageW,
        height: portalImgH,
        fit: [pageW, portalImgH],
        align: 'center',
        valign: 'center',
      });
      doc.rect(left, y, pageW, portalImgH).stroke(LINE);
    } catch (_) {
      drawPlaceholder(doc, left, y, pageW, portalImgH, '圖 3 首頁', '截圖載入失敗');
    }
  } else {
    drawPlaceholder(doc, left, y, pageW, portalImgH, '圖 3 首頁', '請放入 03-student-portal.png');
  }
  doc.fillColor(INK).font('Bold').fontSize(8)
    .text('圖 3｜正式環境學生端與開發者署名', left, y + portalImgH + 2, { width: pageW });
  y += portalH;

  const footerImgH = footerH - 16;
  if (footerFile) {
    try {
      doc.image(footerFile, left, y, {
        width: pageW,
        height: footerImgH,
        fit: [pageW, footerImgH],
        align: 'center',
        valign: 'center',
      });
      doc.rect(left, y, pageW, footerImgH).stroke(LINE);
    } catch (_) {
      drawPlaceholder(doc, left, y, pageW, footerImgH, 'footer', '署名截圖載入失敗');
    }
  }
  doc.fillColor(MUTED).font('Regular').fontSize(7.5)
    .text('正式站首頁與頁尾（含開發者署名）。', left, y + footerImgH + 2, {
      width: pageW,
    });
  y += footerH + 4;

  // Section 4
  doc.fillColor(ACCENT).font('Bold').fontSize(11).text('四、至 12 月發表的工作重點', left, y);
  y += 16;
  doc.moveTo(left, y).lineTo(left + pageW, y).lineWidth(0.6).strokeColor(LINE).stroke();
  y += 8;

  const colW = (pageW - gap) / 2;
  doc.save();
  doc.roundedRect(left, y, colW, 72, 4).stroke(LINE);
  doc.roundedRect(left + colW + gap, y, colW, 72, 4).stroke(LINE);
  doc.restore();

  doc.fillColor(ACCENT).font('Bold').fontSize(9).text('計畫內容', left + 8, y + 6);
  doc.fillColor(INK).font('Regular').fontSize(8)
    .text(
      '• 整理可發表題目與貢獻敘述\n• 規劃去識別化參與／歷程分析指標\n• 補強評測、書面與口頭發表',
      left + 8,
      y + 20,
      { width: colW - 16, lineGap: 2 }
    );

  doc.fillColor(ACCENT).font('Bold').fontSize(9).text('粗估時程', left + colW + gap + 8, y + 6);
  doc.fillColor(INK).font('Regular').fontSize(8)
    .text(
      '9–10 月　題目確認、指標設計、資料盤點\n10–11 月　分析實作、結果解釋、系統補強\n11–12 月　報告書／簡報定稿與發表',
      left + colW + gap + 8,
      y + 20,
      { width: colW - 16, lineGap: 2 }
    );
  y += 82;

  // Section 5
  doc.fillColor(ACCENT).font('Bold').fontSize(11).text('五、希望向老師學習', left, y);
  y += 16;
  doc.moveTo(left, y).lineTo(left + pageW, y).lineWidth(0.6).strokeColor(LINE).stroke();
  y += 8;
  doc.fillColor(INK).font('Regular').fontSize(9)
    .text(
      '• 如何用教育資料科學視角界定「可回答」的研究問題\n• 學習分析指標選擇、結果解釋與研究倫理（個資／去識別）\n• 如何把工程實作轉成清楚、可被檢視的專題貢獻',
      left,
      y,
      { width: pageW, lineGap: 2.5 }
    );
  y = doc.y + 14;

  doc.moveTo(left, y).lineTo(left + pageW, y).lineWidth(0.6).strokeColor(LINE).stroke();
  y += 8;
  doc.fillColor(MUTED).font('Regular').fontSize(7.5)
    .text(
      '聯絡人：陳竑仰（D0786893）｜可另約 15–20 分鐘線上／当面 demo（本文件不提供正式站帳密）',
      left,
      y,
      { width: pageW - 40 }
    );
  doc.text('第 1／1 頁', left + pageW - 40, y, { width: 40, align: 'right' });

  doc.end();

  stream.on('finish', () => {
    const stat = fs.statSync(OUT);
    console.log('Created:', OUT);
    console.log('Size:', stat.size, 'bytes');
  });
}

main();
