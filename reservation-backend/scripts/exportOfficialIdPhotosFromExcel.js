'use strict';

/**
 * 依官方提交用 Excel 名單匯出證件照：
 * - 檔名 = 身分證字號 + 原副檔名（超過 1MB 則壓成 .jpg）
 * - 依 Excel 列順序，每 20 張一個資料夾
 *
 * 用法：
 *   node scripts/exportOfficialIdPhotosFromExcel.js
 *   node scripts/exportOfficialIdPhotosFromExcel.js --excel "D:/path/file.xlsx" --out "D:/path/out"
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DEFAULT_EXCEL = path.resolve(
  __dirname,
  '../../培力英檢報名資料_已通過_115-1_2026-09-17排序-final.xlsx'
);
const DEFAULT_OUT = path.resolve(
  __dirname,
  '../../official-id-photos-export-115-1'
);
const ID_PHOTO_DIR = path.join(__dirname, '../uploads/english-test/id-photos');
const BATCH_SIZE = 20;
const MAX_BYTES = 1024 * 1024; // 1MB

function parseArgs(argv) {
  const args = { excel: DEFAULT_EXCEL, out: DEFAULT_OUT, batchSize: BATCH_SIZE };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--excel' && argv[i + 1]) {
      args.excel = path.resolve(argv[++i]);
    } else if (a === '--out' && argv[i + 1]) {
      args.out = path.resolve(argv[++i]);
    } else if (a === '--batch-size' && argv[i + 1]) {
      args.batchSize = Math.max(1, parseInt(argv[++i], 10) || BATCH_SIZE);
    }
  }
  return args;
}

function findHeaderKey(headers, predicates) {
  for (const h of headers) {
    const normalized = String(h || '').replace(/\r?\n/g, '').trim();
    if (predicates.some((fn) => fn(normalized))) return h;
  }
  return null;
}

function loadExcelRows(excelPath) {
  if (!fs.existsSync(excelPath)) {
    throw new Error(`找不到 Excel：${excelPath}`);
  }
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (!rows.length) throw new Error('Excel 沒有資料列');

  const headers = Object.keys(rows[0]);
  const idNumberKey = findHeaderKey(headers, [
    (h) => h.includes('身分證字號'),
    (h) => h === 'idNumber' || h === 'nationalId',
  ]);
  const studentIdKey = findHeaderKey(headers, [
    (h) => h.includes('學號') && !h.includes('身分'),
    (h) => h === 'studentId',
  ]);
  const nameKey = findHeaderKey(headers, [
    (h) => h.includes('中文姓名'),
    (h) => h.includes('姓名'),
  ]);
  const seqKey = findHeaderKey(headers, [
    (h) => h === '序號' || h.replace(/\s/g, '') === '序號',
  ]);

  if (!idNumberKey) throw new Error('Excel 找不到「身分證字號」欄');
  if (!studentIdKey) throw new Error('Excel 找不到「學號」欄');

  return rows.map((row, index) => ({
    excelIndex: index + 1,
    sequence: seqKey ? Number(row[seqKey]) || index + 1 : index + 1,
    idNumber: String(row[idNumberKey] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
    studentId: String(row[studentIdKey] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
    name: nameKey ? String(row[nameKey] || '').trim() : '',
  }));
}

function buildPhotoIndex(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`證件照目錄不存在：${dir}`);
  }
  /** @type {Map<string, string[]>} */
  const byPrefix = new Map();
  for (const file of fs.readdirSync(dir)) {
    const abs = path.join(dir, file);
    if (!fs.statSync(abs).isFile()) continue;
    const m = file.match(/^([A-Za-z0-9]+)-/);
    if (!m) continue;
    const key = m[1].toUpperCase();
    if (!byPrefix.has(key)) byPrefix.set(key, []);
    byPrefix.get(key).push(abs);
  }
  return byPrefix;
}

function pickPhotoPath(candidates) {
  if (!candidates || !candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  // 多檔時取最新修改者
  return candidates
    .slice()
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function resolvePhotoPath(photoIndex, row) {
  // 歷史檔名可能是「學號-姓名-證件照」或「身分證字號-姓名-證件照」
  return (
    pickPhotoPath(photoIndex.get(row.studentId))
    || pickPhotoPath(photoIndex.get(row.idNumber))
  );
}

async function loadSharp() {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    return require('sharp');
  } catch (_) {
    return null;
  }
}

async function writeUnder1MB(sharp, srcPath, destPathWithoutExt, preferExt) {
  const srcStat = fs.statSync(srcPath);
  const srcExt = path.extname(srcPath).toLowerCase() || preferExt || '.jpg';

  if (srcStat.size <= MAX_BYTES) {
    const dest = `${destPathWithoutExt}${srcExt}`;
    fs.copyFileSync(srcPath, dest);
    return { dest, bytes: srcStat.size, compressed: false };
  }

  if (!sharp) {
    const dest = `${destPathWithoutExt}${srcExt}`;
    fs.copyFileSync(srcPath, dest);
    return { dest, bytes: srcStat.size, compressed: false, oversize: true };
  }

  // 超過 1MB：轉 JPEG 並逐步降低品質／尺寸
  let quality = 85;
  let width = null;
  let lastBuf = null;

  const meta = await sharp(srcPath).metadata();
  if (meta.width && meta.width > 1600) width = 1600;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    let pipeline = sharp(srcPath).rotate();
    if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
    lastBuf = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    if (lastBuf.length <= MAX_BYTES) break;
    if (quality > 40) {
      quality -= 10;
    } else if (!width || width > 800) {
      width = width ? Math.round(width * 0.85) : 1200;
      quality = Math.max(quality, 55);
    } else {
      quality = Math.max(28, quality - 5);
    }
  }

  const dest = `${destPathWithoutExt}.jpg`;
  fs.writeFileSync(dest, lastBuf);
  return {
    dest,
    bytes: lastBuf.length,
    compressed: true,
    oversize: lastBuf.length > MAX_BYTES,
    quality,
  };
}

function batchFolderName(batchIndex, batchSize, total) {
  const start = batchIndex * batchSize + 1;
  const end = Math.min((batchIndex + 1) * batchSize, total);
  const label = String(batchIndex + 1).padStart(2, '0');
  return `${label}_${String(start).padStart(3, '0')}-${String(end).padStart(3, '0')}`;
}

async function main() {
  const args = parseArgs(process.argv);
  console.log('Excel:', args.excel);
  console.log('Out  :', args.out);
  console.log('Photos:', ID_PHOTO_DIR);

  const rows = loadExcelRows(args.excel);
  const photoIndex = buildPhotoIndex(ID_PHOTO_DIR);
  const sharp = await loadSharp();
  if (!sharp) {
    console.warn('⚠️ 未安裝 sharp：超過 1MB 的照片將原樣複製（建議先 npm install sharp）');
  }

  if (fs.existsSync(args.out)) {
    fs.rmSync(args.out, { recursive: true, force: true });
  }
  fs.mkdirSync(args.out, { recursive: true });

  const ok = [];
  const missing = [];
  const oversize = [];
  const usedIdNumbers = new Map();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const batchIndex = Math.floor(i / args.batchSize);
    const folder = path.join(args.out, batchFolderName(batchIndex, args.batchSize, rows.length));
    fs.mkdirSync(folder, { recursive: true });

    if (!row.idNumber) {
      missing.push({ ...row, reason: '缺身分證字號' });
      continue;
    }
    if (!row.studentId) {
      missing.push({ ...row, reason: '缺學號' });
      continue;
    }
    if (usedIdNumbers.has(row.idNumber)) {
      missing.push({
        ...row,
        reason: `身分證字號重複（先前序 ${usedIdNumbers.get(row.idNumber)}）`,
      });
      continue;
    }

    const src = resolvePhotoPath(photoIndex, row);
    if (!src) {
      missing.push({ ...row, reason: '找不到證件照檔案' });
      continue;
    }

    const destBase = path.join(folder, row.idNumber);
    const result = await writeUnder1MB(sharp, src, destBase);
    usedIdNumbers.set(row.idNumber, row.sequence);
    ok.push({
      sequence: row.sequence,
      studentId: row.studentId,
      idNumber: row.idNumber,
      name: row.name,
      src: path.basename(src),
      dest: path.relative(args.out, result.dest),
      bytes: result.bytes,
      compressed: result.compressed,
    });
    if (result.oversize) {
      oversize.push({ idNumber: row.idNumber, bytes: result.bytes });
    }

    if ((i + 1) % 50 === 0 || i + 1 === rows.length) {
      console.log(`進度 ${i + 1}/${rows.length}`);
    }
  }

  const report = {
    excel: args.excel,
    out: args.out,
    totalInExcel: rows.length,
    exported: ok.length,
    missing: missing.length,
    oversizeRemaining: oversize.length,
    batchSize: args.batchSize,
    folderCount: Math.ceil(rows.length / args.batchSize),
    generatedAt: new Date().toISOString(),
    missingRows: missing,
    oversizeRows: oversize,
  };
  fs.writeFileSync(
    path.join(args.out, '_export-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  const missingCsv = [
    'sequence,studentId,idNumber,name,reason',
    ...missing.map((m) =>
      [m.sequence, m.studentId, m.idNumber, JSON.stringify(m.name || ''), JSON.stringify(m.reason || '')].join(',')
    ),
  ].join('\n');
  fs.writeFileSync(path.join(args.out, '_missing.csv'), missingCsv, 'utf8');

  console.log('---');
  console.log(`Excel 筆數: ${rows.length}`);
  console.log(`成功匯出: ${ok.length}`);
  console.log(`缺檔/異常: ${missing.length}`);
  console.log(`仍 >1MB: ${oversize.length}`);
  console.log(`資料夾數: ${report.folderCount}`);
  console.log(`輸出目錄: ${args.out}`);
  if (missing.length) {
    console.log('缺檔清單:', path.join(args.out, '_missing.csv'));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
