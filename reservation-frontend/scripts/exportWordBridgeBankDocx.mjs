/**
 * 匯出語彙連橋題庫為 Word（.docx），供紙本校對。
 *
 * 用法：npm run export:word-bridge-docx
 * 輸出：reservation-frontend/exports/word-bridge-bank-校對-YYYYMMDD.docx
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { WORD_BRIDGE_THEME_BANKS, THEMES_PER_LEVEL } from '../src/data/wordBridgeThemes.js';
import { getWordZh } from '../src/data/wordBridgeGlossary.js';

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const GAME_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportsDir = path.join(__dirname, '..', 'exports');

const FONT = 'Microsoft JhengHei';
const HEADER_FILL = 'E8E8E8';

function zh(word) {
  const translation = getWordZh(word);
  return translation ?? '（待補）';
}

function cell(text, opts = {}) {
  const {
    bold = false,
    widthPct,
    shading = false,
    align = AlignmentType.LEFT,
    size = 20,
  } = opts;

  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: shading
      ? { fill: HEADER_FILL, type: ShadingType.CLEAR, color: 'auto' }
      : undefined,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(text ?? ''),
            font: FONT,
            size,
            bold,
          }),
        ],
      }),
    ],
  });
}

function headerRow(cells) {
  return new TableRow({
    tableHeader: true,
    children: cells.map(({ text, widthPct, align }) => cell(text, {
      bold: true,
      widthPct,
      shading: true,
      align: align ?? AlignmentType.CENTER,
      size: 18,
    })),
  });
}

function dataRow(cells) {
  return new TableRow({
    children: cells.map(({ text, widthPct, align, size }) => cell(text, {
      widthPct,
      align,
      size: size ?? 20,
    })),
  });
}

function buildCoverSection(today) {
  const totalThemes = LEVEL_ORDER.reduce(
    (sum, level) => sum + (WORD_BRIDGE_THEME_BANKS[level] || []).length,
    0,
  );
  const missingZh = countMissingTranslations();

  return [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '語彙連橋（Word Bridge）題庫校對稿', font: FONT, size: 36, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: `匯出日期：${today}`, font: FONT, size: 22 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: '資料來源：src/data/wordBridgeThemes.js、wordBridgeGlossary.js', font: FONT, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `難度：${LEVEL_ORDER.join('、')}（每級 ${THEMES_PER_LEVEL} 組 × 4 詞）`, font: FONT, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `主題組合計：${totalThemes} 組；單字合計：${totalThemes * 4} 詞`, font: FONT, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `中文待補：${missingZh} 詞`, font: FONT, size: 20, bold: missingZh > 0 })],
    }),
    new Paragraph({ spacing: { before: 300 }, children: [] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: '紙本校對建議', font: FONT, size: 24, bold: true })],
    }),
    new Paragraph({
      children: [new TextRun({ text: '1. 「主題組」：確認四詞是否同主題、難度是否合適。', font: FONT, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: '2. 「詞彙總表」：逐詞核對英文拼字與中文譯法；「（待補）」請補上譯文。', font: FONT, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: '3. 請在「校對備註」欄手寫修改建議；定稿後同步更新程式碼。', font: FONT, size: 20 })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function countMissingTranslations() {
  let missing = 0;
  for (const level of LEVEL_ORDER) {
    for (const item of WORD_BRIDGE_THEME_BANKS[level] || []) {
      for (const word of item.words) {
        if (!getWordZh(word)) missing += 1;
      }
    }
  }
  return missing;
}

function buildThemeGroupSection(level) {
  const themes = WORD_BRIDGE_THEME_BANKS[level] || [];
  const gameNote = GAME_LEVELS.has(level) ? '（遊戲使用）' : '（題庫備用）';

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow([
        { text: '#', widthPct: 4 },
        { text: '主題ID', widthPct: 14 },
        { text: '主題', widthPct: 10 },
        { text: '單字1', widthPct: 9 },
        { text: '中文1', widthPct: 8 },
        { text: '單字2', widthPct: 9 },
        { text: '中文2', widthPct: 8 },
        { text: '單字3', widthPct: 9 },
        { text: '中文3', widthPct: 8 },
        { text: '單字4', widthPct: 9 },
        { text: '中文4', widthPct: 8 },
        { text: '校對備註', widthPct: 14 },
      ]),
      ...themes.map((item, index) => {
        const [w1, w2, w3, w4] = item.words;
        return dataRow([
          { text: String(index + 1), widthPct: 4, align: AlignmentType.CENTER },
          { text: item.id, widthPct: 14 },
          { text: item.theme, widthPct: 10 },
          { text: w1, widthPct: 9 },
          { text: zh(w1), widthPct: 8 },
          { text: w2, widthPct: 9 },
          { text: zh(w2), widthPct: 8 },
          { text: w3, widthPct: 9 },
          { text: zh(w3), widthPct: 8 },
          { text: w4, widthPct: 9 },
          { text: zh(w4), widthPct: 8 },
          { text: '', widthPct: 14 },
        ]);
      }),
    ],
  });

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `${level} 主題組 ${gameNote}`, font: FONT, size: 28, bold: true })],
    }),
    table,
    new Paragraph({ spacing: { after: 300 }, children: [] }),
  ];
}

function buildVocabularySection() {
  /** @type {Array<{ level: string, themeId: string, theme: string, word: string, wordIndex: number }>} */
  const entries = [];
  for (const level of LEVEL_ORDER) {
    for (const item of WORD_BRIDGE_THEME_BANKS[level] || []) {
      item.words.forEach((word, wordIndex) => {
        entries.push({
          level,
          themeId: item.id,
          theme: item.theme,
          word,
          wordIndex: wordIndex + 1,
        });
      });
    }
  }

  entries.sort((a, b) => {
    const levelDiff = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
    if (levelDiff !== 0) return levelDiff;
    return a.word.localeCompare(b.word, 'en');
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow([
        { text: '#', widthPct: 5 },
        { text: 'CEFR', widthPct: 6 },
        { text: '主題', widthPct: 12 },
        { text: '詞序', widthPct: 5 },
        { text: '英文', widthPct: 16 },
        { text: '中文', widthPct: 14 },
        { text: '校對備註', widthPct: 42 },
      ]),
      ...entries.map((entry, index) => dataRow([
        { text: String(index + 1), widthPct: 5, align: AlignmentType.CENTER },
        { text: entry.level, widthPct: 6, align: AlignmentType.CENTER },
        { text: entry.theme, widthPct: 12 },
        { text: String(entry.wordIndex), widthPct: 5, align: AlignmentType.CENTER },
        { text: entry.word, widthPct: 16 },
        { text: zh(entry.word), widthPct: 14 },
        { text: '', widthPct: 42 },
      ])),
    ],
  });

  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: '詞彙總表（逐詞校對）', font: FONT, size: 28, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: '依難度、英文字母排序。', font: FONT, size: 20 })],
    }),
    table,
  ];
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const stamp = today.replace(/-/g, '');
  const filename = `word-bridge-bank-校對-${stamp}.docx`;
  const outPath = path.join(exportsDir, filename);

  fs.mkdirSync(exportsDir, { recursive: true });

  const children = [
    ...buildCoverSection(today),
    ...LEVEL_ORDER.flatMap((level) => buildThemeGroupSection(level)),
    ...buildVocabularySection(),
  ];

  const doc = new Document({
    creator: 'EEARS Word Bridge Export',
    title: '語彙連橋題庫校對稿',
    description: 'Word Bridge vocabulary bank for paper proofreading',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);

  const totalThemes = LEVEL_ORDER.reduce(
    (sum, level) => sum + (WORD_BRIDGE_THEME_BANKS[level] || []).length,
    0,
  );

  console.log(`已匯出 Word 校對稿：${outPath}`);
  console.log(`共 ${LEVEL_ORDER.length} 個難度、${totalThemes} 組主題、${totalThemes * 4} 個單字`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
