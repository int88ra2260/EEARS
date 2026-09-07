/**
 * 依 schema order 將自訂題插入預設題之間（不再「預設全部在前、自訂全部在後」）。
 */

export function getSectionQuestionsOrdered(questions, sectionId) {
  return (questions || [])
    .filter((q) => q && q.sectionId === sectionId && q.visible !== false)
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

/**
 * @param {object[]} questions schema.questions（需含預設＋自訂，才能對齊 order）
 * @param {string} sectionId
 * @param {string[]} builtinFieldKeys 此區塊硬編碼欄位由上到下的 fieldKey 順序
 * @returns {{ before: object[], after: Record<string, object[]>, trailing: object[] }}
 */
export function buildSectionExtraSlots(questions, sectionId, builtinFieldKeys = []) {
  const builtinSet = new Set(builtinFieldKeys);
  const ordered = getSectionQuestionsOrdered(questions, sectionId);
  const before = [];
  const after = Object.fromEntries(builtinFieldKeys.map((k) => [k, []]));
  const trailing = [];

  const hasBuiltinAnchor = ordered.some((q) => builtinSet.has(q.fieldKey));
  if (!hasBuiltinAnchor) {
    // 無完整 schema 時維持舊行為：自訂題整批放區塊末
    for (const q of ordered) {
      if (q.system && q.type === 'content_block') continue;
      if (builtinSet.has(q.fieldKey)) continue;
      trailing.push(q);
    }
    return { before, after, trailing };
  }

  let lastBuiltin = null;

  for (const q of ordered) {
    // 僅以「內建硬編碼欄位」當錨點；其餘（自訂、未內建的 system）依 order 插在錨點之間
    const isBuiltinAnchor = builtinSet.has(q.fieldKey);
    if (isBuiltinAnchor) {
      lastBuiltin = q.fieldKey;
      continue;
    }
    if (q.system && q.type === 'content_block') {
      // 證件照說明等由硬編碼區塊自行渲染，避免重複
      continue;
    }
    if (lastBuiltin == null) {
      before.push(q);
    } else if (after[lastBuiltin]) {
      after[lastBuiltin].push(q);
    } else {
      trailing.push(q);
    }
  }

  return { before, after, trailing };
}

/** 合併多個錨點後的自訂題（例如地址相關欄位渲染成一塊時） */
export function mergeSlotQuestions(slots, fieldKeys = []) {
  const out = [];
  const seen = new Set();
  for (const key of fieldKeys) {
    for (const q of slots?.after?.[key] || []) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      out.push(q);
    }
  }
  return out;
}
