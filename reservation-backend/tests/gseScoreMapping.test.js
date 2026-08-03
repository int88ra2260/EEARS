'use strict';

const {
  inferGseFromScore,
  inferGseFromLevel,
  inferGse,
  gseToCefr,
  cefrToGseMidpoint,
  mapScoreToGseFromAnchors,
  listGseMappingForSettings,
  VERSION,
} = require('../services/learningAnalytics/gseScoreMappingService');

describe('gseScoreMapping', () => {
  test('GSE ↔ CEFR：B1 區間 43–58', () => {
    expect(gseToCefr(43)).toBe('B1');
    expect(gseToCefr(58)).toBe('B1');
    expect(gseToCefr(50)).toBe('B1');
  });

  test('GSE ↔ CEFR：B2 區間寬於 A1', () => {
    const b2 = listGseMappingForSettings().cefrSummary.B2;
    const a1 = listGseMappingForSettings().cefrSummary.A1;
    expect(b2.gseMax - b2.gseMin).toBeGreaterThan(a1.gseMax - a1.gseMin);
  });

  test('CEFR B2 中位數為 67', () => {
    expect(cefrToGseMidpoint('B2')).toBe(67);
  });

  test('IELTS 6.5 → GSE 60', () => {
    const r = inferGseFromScore({ examType: 'IELTS', skill: 'listening', rawScore: 6.5 });
    expect(r.isMapped).toBe(true);
    expect(r.gse).toBe(60);
    expect(r.confidence).toBe('official');
    expect(r.cefr).toBe('B2');
  });

  test('IELTS 5.5 與 6.5 應得不同 GSE', () => {
    const low = inferGseFromScore({ examType: 'IELTS', skill: 'reading', rawScore: 5.5 });
    const high = inferGseFromScore({ examType: 'IELTS', skill: 'reading', rawScore: 6.5 });
    expect(low.gse).toBe(46);
    expect(high.gse).toBe(60);
    expect(low.gse).not.toBe(high.gse);
  });

  test('TOEIC listening 400 與 489 應得不同 GSE', () => {
    const low = inferGseFromScore({ examType: 'TOEIC', skill: 'listening', rawScore: 400 });
    const high = inferGseFromScore({ examType: 'TOEIC', skill: 'listening', rawScore: 489 });
    expect(low.isMapped).toBe(true);
    expect(high.isMapped).toBe(true);
    expect(low.gse).toBe(59);
    expect(high.gse).toBeGreaterThan(low.gse);
    expect(high.gse).toBeLessThan(76);
  });

  test('TOEIC listening 400 → GSE 59（B2 下界）', () => {
    const r = inferGseFromScore({ examType: 'TOEIC', skill: 'listening', rawScore: 400 });
    expect(r.gse).toBe(59);
    expect(r.confidence).toBe('estimated');
  });

  test('GEPT 中級 → GSE 50.5', () => {
    const r = inferGseFromLevel({ examType: 'GEPT', level: '全民英檢中級' });
    expect(r.isMapped).toBe(true);
    expect(r.gse).toBe(50.5);
    expect(r.cefr).toBe('B1');
  });

  test('Cambridge B2 First → GSE 67', () => {
    const r = inferGseFromLevel({ examType: 'CAMBRIDGE', level: 'B2 First (FCE)' });
    expect(r.isMapped).toBe(true);
    expect(r.gse).toBe(67);
    expect(r.cefr).toBe('B2');
  });

  test('inferGse 優先使用原始分而非 CEFR', () => {
    const r = inferGse({
      examType: 'IELTS',
      skill: 'writing',
      rawScore: 6.5,
      cefrLevel: 'B2',
    });
    expect(r.gse).toBe(60);
    expect(r.reason).toBe('MAPPED');
  });

  test('inferGse 僅 CEFR 時使用中位數', () => {
    const r = inferGse({ cefrLevel: 'B1' });
    expect(r.isMapped).toBe(true);
    expect(r.gse).toBe(50.5);
    expect(r.reason).toBe('CEFR_MIDPOINT_FALLBACK');
    expect(r.confidence).toBe('estimated');
  });

  test('mapScoreToGseFromAnchors 區間內插值', () => {
    const anchors = [
      { rawMin: 400, gse: 59 },
      { rawMin: 275, gse: 43 },
    ];
    const mid = mapScoreToGseFromAnchors(337.5, anchors);
    expect(mid).toBe(51);
  });

  test('listGseMappingForSettings 涵蓋系統內所有英檢', () => {
    const data = listGseMappingForSettings();
    const types = data.examMappings.map((m) => m.examType);
    expect(types).toEqual(expect.arrayContaining([
      'IELTS', 'TOEIC', 'TOEIC_SW', 'TOEFL_ITP',
      'TOEFL_IBT_LEGACY', 'TOEFL_IBT_2026', 'BESTEP', 'GEPT', 'CAMBRIDGE',
    ]));
    expect(data.version).toBe(VERSION);
    expect(data.cefrBands.length).toBeGreaterThanOrEqual(10);
  });
});
