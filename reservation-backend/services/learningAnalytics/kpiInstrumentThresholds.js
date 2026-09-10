'use strict';

/**
 * KPI 同場合計／成對達標門檻預設（可被政策 definition.instruments 覆寫）。
 * passMode:
 * - sum_raw: 同場技能 raw 加總 ≥ minTotal
 * - both_cefr: 同場各技能 CEFR rank ≥ minCefrRank
 * - sum_and_section_mins: 加總達標且各科 raw ≥ sectionMins（ETS 嚴版，非 115 預設）
 */

const B2_RANK = 4;

const DEFAULT_INSTRUMENT_THRESHOLDS = Object.freeze({
  TOEIC: {
    label: 'TOEIC L&R',
    pairs: {
      LR: {
        skills: ['listening', 'reading'],
        passMode: 'sum_raw',
        minTotal: 785,
        note: 'ETS 對照常見 B2 總分 785；校內 KPI 採 sum_only（允許單科未達分項 B2）',
      },
    },
  },
  TOEIC_SW: {
    label: 'TOEIC S&W',
    pairs: {
      SW: {
        skills: ['speaking', 'writing'],
        passMode: 'both_cefr',
        minCefrRank: B2_RANK,
        // 若政策改為 sum_raw，可用 310（160+150）
        minTotal: 310,
        note: 'ETS 不公布 S+W 總分；預設採同場兩科 CEFR ≥ B2',
      },
    },
  },
  BESTEP: {
    label: '培力英檢',
    pairs: {
      LR: {
        skills: ['listening', 'reading'],
        passMode: 'sum_raw',
        minTotal: 200,
        note: '由系統單項 B2（聽／讀各 100）加總',
      },
      SW: {
        skills: ['speaking', 'writing'],
        passMode: 'sum_raw',
        minTotal: 560,
        note: '由系統單項 B2（說／寫各 280）加總',
      },
    },
  },
  IELTS: {
    label: 'IELTS',
    pairs: {
      LR: {
        skills: ['listening', 'reading'],
        passMode: 'sum_raw',
        minTotal: 11.0,
        note: '單項 B2=5.5 → 成對加總 11.0',
      },
      SW: {
        skills: ['speaking', 'writing'],
        passMode: 'sum_raw',
        minTotal: 11.0,
        note: '單項 B2=5.5 → 成對加總 11.0',
      },
    },
  },
  TOEFL_IBT_LEGACY: {
    label: 'TOEFL iBT 舊制',
    pairs: {
      LR: {
        skills: ['listening', 'reading'],
        passMode: 'sum_raw',
        minTotal: 35,
        note: '系統單項 B2：聽 17 + 讀 18',
      },
      SW: {
        skills: ['speaking', 'writing'],
        passMode: 'sum_raw',
        minTotal: 37,
        note: '系統單項 B2：說 20 + 寫 17',
      },
    },
  },
  TOEFL_IBT_2026: {
    label: 'TOEFL iBT 2026',
    pairs: {
      LR: {
        skills: ['listening', 'reading'],
        passMode: 'sum_raw',
        minTotal: 8,
        note: '系統單項 B2=4 → 成對加總 8',
      },
      SW: {
        skills: ['speaking', 'writing'],
        passMode: 'sum_raw',
        minTotal: 8,
        note: '系統單項 B2=4 → 成對加總 8',
      },
    },
  },
  TOEFL_ITP: {
    label: 'TOEFL ITP',
    pairs: {
      LR: {
        skills: ['listening', 'reading'],
        passMode: 'sum_raw',
        minTotal: 110,
        note: '系統單項 B2：聽／讀各 55；無說寫',
      },
    },
  },
  GEPT: {
    label: 'GEPT',
    pairs: {
      LR: {
        skills: ['listening', 'reading'],
        passMode: 'both_cefr',
        minCefrRank: B2_RANK,
        note: '等級型：同場兩技能 CEFR ≥ B2',
      },
      SW: {
        skills: ['speaking', 'writing'],
        passMode: 'both_cefr',
        minCefrRank: B2_RANK,
        note: '等級型：同場兩技能 CEFR ≥ B2',
      },
    },
  },
  CAMBRIDGE: {
    label: 'Cambridge',
    pairs: {
      LR: {
        skills: ['listening', 'reading'],
        passMode: 'both_cefr',
        minCefrRank: B2_RANK,
        note: '等級型：同場兩技能 CEFR ≥ B2',
      },
      SW: {
        skills: ['speaking', 'writing'],
        passMode: 'both_cefr',
        minCefrRank: B2_RANK,
        note: '等級型：同場兩技能 CEFR ≥ B2',
      },
    },
  },
});

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultInstrumentThresholds() {
  return deepClone(DEFAULT_INSTRUMENT_THRESHOLDS);
}

function mergeInstrumentThresholds(overrides) {
  const base = getDefaultInstrumentThresholds();
  if (!overrides || typeof overrides !== 'object') return base;
  for (const [code, patch] of Object.entries(overrides)) {
    if (!patch || typeof patch !== 'object') continue;
    if (!base[code]) {
      base[code] = deepClone(patch);
      continue;
    }
    base[code] = {
      ...base[code],
      ...patch,
      pairs: {
        ...(base[code].pairs || {}),
        ...(patch.pairs || {}),
      },
    };
  }
  return base;
}

function resolvePairKey(skills) {
  const set = new Set((skills || []).map((s) => String(s).toLowerCase()));
  const hasL = set.has('listening');
  const hasR = set.has('reading');
  const hasS = set.has('speaking');
  const hasW = set.has('writing');
  if (hasL && hasR && set.size === 2) return 'LR';
  if (hasS && hasW && set.size === 2) return 'SW';
  return null;
}

module.exports = {
  B2_RANK,
  DEFAULT_INSTRUMENT_THRESHOLDS,
  getDefaultInstrumentThresholds,
  mergeInstrumentThresholds,
  resolvePairKey,
};
