'use strict';

const { GSE_CEFR_SUMMARY } = require('./gseMappingDefaults');

const CEFR_DISPLAY_LABELS = Object.freeze({
  BELOW_A1: '低於 A1',
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
  C1: 'C1',
  C2: 'C2',
});

const VALID_CEFR_KEYS = Object.freeze(Object.keys(GSE_CEFR_SUMMARY));

function normalizeCefrKey(cefr) {
  if (!cefr) return null;
  const raw = String(cefr).trim().toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (raw === 'BELOW_A1' || raw === 'PRE_A1' || raw === '未達_A1') return 'BELOW_A1';
  return VALID_CEFR_KEYS.includes(raw) ? raw : null;
}

module.exports = {
  CEFR_DISPLAY_LABELS,
  VALID_CEFR_KEYS,
  normalizeCefrKey,
};
