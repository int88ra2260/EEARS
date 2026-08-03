/**
 * 匯出語彙連橋題庫（wordBridgeThemes.js）為 Excel，供整理與維護。
 *
 * 用法：npm run export:word-bridge-bank
 * 輸出：reservation-frontend/exports/word-bridge-bank-YYYYMMDD.xlsx
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { WORD_BRIDGE_THEME_BANKS, THEMES_PER_LEVEL } from '../src/data/wordBridgeThemes.js';
import { getWordZh } from '../src/data/wordBridgeGlossary.js';

const GAME_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportsDir = path.join(__dirname, '..', 'exports');

function zh(word) {
  return getWordZh(word) ?? '';
}

function buildThemeRows() {
  const header = [
    'CEFR難度',
    '遊戲使用',
    '主題ID',
    '主題(英文)',
    '單字1', '中文1',
    '單字2', '中文2',
    '單字3', '中文3',
    '單字4', '中文4',
  ];

  const rows = [header];

  for (const level of LEVEL_ORDER) {
    const themes = WORD_BRIDGE_THEME_BANKS[level] || [];
    for (const item of themes) {
      const [w1, w2, w3, w4] = item.words;
      rows.push([
        level,
        GAME_LEVELS.has(level) ? '是' : '否（題庫備用）',
        item.id,
        item.theme,
        w1, zh(w1),
        w2, zh(w2),
        w3, zh(w3),
        w4, zh(w4),
      ]);
    }
  }

  return rows;
}

function buildVocabularyRows() {
  const header = ['CEFR難度', '主題ID', '主題(英文)', '詞序', '英文', '中文'];
  const rows = [header];

  for (const level of LEVEL_ORDER) {
    const themes = WORD_BRIDGE_THEME_BANKS[level] || [];
    for (const item of themes) {
      item.words.forEach((word, index) => {
        rows.push([level, item.id, item.theme, index + 1, word, zh(word)]);
      });
    }
  }

  return rows;
}

function buildSummaryRows() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = [
    ['語彙連橋題庫匯出說明'],
    ['匯出日期', today],
    ['資料來源', 'reservation-frontend/src/data/wordBridgeThemes.js'],
    [''],
    ['每難度主題組數', String(THEMES_PER_LEVEL)],
    [''],
    ['難度', '主題組數', '單字數', '遊戲使用'],
  ];

  for (const level of LEVEL_ORDER) {
    const count = (WORD_BRIDGE_THEME_BANKS[level] || []).length;
    rows.push([
      level,
      count,
      count * 4,
      GAME_LEVELS.has(level) ? '是（A1→C2 階梯測驗）' : '否',
    ]);
  }

  const totalThemes = LEVEL_ORDER.reduce(
    (sum, level) => sum + (WORD_BRIDGE_THEME_BANKS[level] || []).length,
    0,
  );
  rows.push(['合計', totalThemes, totalThemes * 4, '']);

  rows.push(
    [''],
    ['整理提示'],
    ['1) 「主題組」工作表：一列一組四連詞，適合調整主題與用詞'],
    ['2) 「詞彙總表」工作表：一列一詞，適合檢查重複或補中文'],
    ['3) 修改後請同步更新 wordBridgeThemes.js 與 wordBridgeGlossary.js'],
    ['4) 遊戲內每輪組數：A1=2組、A2=3組、B1/B2/C1/C2=4組'],
  );

  return rows;
}

function main() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `word-bridge-bank-${stamp}.xlsx`;
  const outPath = path.join(exportsDir, filename);

  fs.mkdirSync(exportsDir, { recursive: true });

  const wb = XLSX.utils.book_new();

  const themeSheet = XLSX.utils.aoa_to_sheet(buildThemeRows());
  themeSheet['!cols'] = [
    { wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
    { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, themeSheet, '主題組');

  const vocabSheet = XLSX.utils.aoa_to_sheet(buildVocabularyRows());
  vocabSheet['!cols'] = [
    { wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 6 }, { wch: 16 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, vocabSheet, '詞彙總表');

  const summarySheet = XLSX.utils.aoa_to_sheet(buildSummaryRows());
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, '說明');

  XLSX.writeFile(wb, outPath);

  console.log(`已匯出：${outPath}`);
  console.log(`共 ${LEVEL_ORDER.length} 個難度、${LEVEL_ORDER.reduce((s, l) => s + (WORD_BRIDGE_THEME_BANKS[l] || []).length, 0)} 組主題`);
}

main();
