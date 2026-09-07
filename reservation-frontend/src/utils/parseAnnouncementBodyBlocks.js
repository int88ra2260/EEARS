/**
 * 將公告純文字拆成可閱讀的結構化區塊（不改原文語意，僅利於排版）。
 * - decision：含「請依…情況」類標題 → 條件清單
 * - changelog：含「已修復」類標題 → 修復紀錄
 * - paragraphs / section：其餘段落
 */

function stripHeadingMarks(title) {
  return String(title || '')
    .replace(/^【\s*/, '')
    .replace(/\s*】$/, '')
    .trim();
}

function classifyHeading(title) {
  const t = stripHeadingMarks(title);
  if (/請依|情況處理|如何處理|請這樣做/.test(t)) return 'decision';
  if (/已修復|修復項目|修復內容|更新項目/.test(t)) return 'changelog';
  return 'section';
}

function parseBulletCase(line) {
  const raw = String(line || '').replace(/^[•\-\*]\s*/, '').trim();
  if (!raw) return null;
  const split = raw.split(/[：:]/);
  if (split.length >= 2) {
    return {
      caseLabel: split[0].trim(),
      actionText: split.slice(1).join('：').trim(),
    };
  }
  return { caseLabel: null, actionText: raw };
}

function parseNumberedItem(line) {
  const m = String(line || '').match(/^\d+[\.、]\s*(.+)$/);
  if (!m) return null;
  return m[1].trim();
}

function flushParagraph(buf, blocks) {
  const text = buf.join('\n').trim();
  if (!text) return;
  blocks.push({ type: 'paragraphs', text });
}

/**
 * @param {string} raw
 * @returns {Array<{type: string, title?: string, items?: any[], text?: string}>}
 */
export function parseAnnouncementBodyBlocks(raw) {
  const source = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!source) return [];

  const lines = source.split('\n');
  const blocks = [];
  let paragraphBuf = [];
  let mode = 'prose'; // prose | decision | changelog | section
  let currentTitle = '';
  let itemBuf = [];

  const endSpecial = () => {
    const cleaned = itemBuf.map((l) => String(l).trim()).filter(Boolean);
    if (mode === 'decision') {
      const items = cleaned.map(parseBulletCase).filter(Boolean);
      if (currentTitle || items.length) {
        blocks.push({ type: 'decision', title: currentTitle, items });
      }
    } else if (mode === 'changelog') {
      const items = cleaned
        .map((line) => parseNumberedItem(line) || line.replace(/^[•\-\*]\s*/, '').trim())
        .filter(Boolean);
      if (currentTitle || items.length) {
        blocks.push({ type: 'changelog', title: currentTitle, items });
      }
    } else if (mode === 'section') {
      blocks.push({
        type: 'section',
        title: currentTitle,
        text: cleaned.join('\n').trim(),
      });
    }
    itemBuf = [];
    currentTitle = '';
    mode = 'prose';
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^【([^】]+)】\s*$/);

    if (headingMatch) {
      flushParagraph(paragraphBuf, blocks);
      paragraphBuf = [];
      endSpecial();
      currentTitle = stripHeadingMarks(headingMatch[1]);
      mode = classifyHeading(currentTitle);
      continue;
    }

    if (mode === 'prose') {
      if (trimmed === '') {
        flushParagraph(paragraphBuf, blocks);
        paragraphBuf = [];
      } else {
        paragraphBuf.push(line);
      }
      continue;
    }

    if (mode === 'decision') {
      if (trimmed === '') continue;
      if (/^[•\-\*]/.test(trimmed)) {
        itemBuf.push(trimmed);
        continue;
      }
      endSpecial();
      paragraphBuf.push(line);
      continue;
    }

    if (mode === 'changelog') {
      if (trimmed === '') continue;
      if (/^\d+[\.、]/.test(trimmed) || /^[•\-\*]/.test(trimmed)) {
        itemBuf.push(trimmed);
        continue;
      }
      endSpecial();
      paragraphBuf.push(line);
      continue;
    }

    if (mode === 'section') {
      if (trimmed === '' && itemBuf.length > 0) {
        itemBuf.push('');
        continue;
      }
      if (trimmed !== '') itemBuf.push(trimmed);
    }
  }

  flushParagraph(paragraphBuf, blocks);
  endSpecial();
  return blocks;
}

export function renderLinesWithBreaks(text) {
  return String(text || '').split('\n');
}
