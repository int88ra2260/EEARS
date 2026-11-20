import React from 'react';

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

export function formatMeasure(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatSignedMeasure(value) {
  const text = formatMeasure(value);
  if (!text) return '';
  return Number(value) > 0 ? `+${text}` : text;
}

function skillDetail(skills, side) {
  return (skills || []).map((row) => {
    const cell = row?.[side];
    if (!cell) return null;
    const bits = [SKILL_LABELS[row.skill] || row.skill];
    if (cell.invalidScore) bits.push('無效分');
    else if (cell.rawScore != null) bits.push(formatMeasure(cell.rawScore));
    if (cell.cefr) bits.push(cell.cefr);
    if (cell.gse != null) bits.push(`GSE ${formatMeasure(cell.gse)}`);
    return bits.join(' ');
  }).filter(Boolean).join('；');
}

export default function ExamPhaseScore({ phase, skills, side }) {
  if (!phase || !phase.skillCount) return <span className="text-muted">—</span>;
  const cefr = phase.mixedCefr ? '各科不同' : (phase.cefr || '沒有 CEFR');
  const gse = phase.gse != null ? `GSE ${formatMeasure(phase.gse)}` : 'GSE 無法換算';
  const meta = [
    phase.mixedInstrument ? '多種英檢' : phase.instrument,
    phase.examDate,
    phase.mappedSkillCount > 0 && phase.mappedSkillCount < 4 ? `${phase.mappedSkillCount} 科平均` : '',
    phase.cefrSource === 'gse_band' && !phase.mixedCefr ? 'CEFR 由 GSE 對應' : '',
  ].filter(Boolean);
  const detail = skillDetail(skills, side);
  return (
    <div title={detail || undefined}>
      <div>{cefr} · {gse}</div>
      {meta.length ? <div className="small text-muted">{meta.join(' · ')}</div> : null}
    </div>
  );
}
