'use strict';

/**
 * importExamService 單元測試：mock models + transaction（無實際 DB）
 */

const XLSX = require('xlsx');

const mockTransaction = {};

jest.mock('../models', () => ({
  sequelize: {
    transaction: jest.fn(async (fn) => fn(mockTransaction)),
    query: jest.fn()
  },
  Student: {
    findAll: jest.fn()
  },
  EtExamAttempt: {
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn()
  },
  EtExamAttemptSkillScore: {
    create: jest.fn(),
    destroy: jest.fn()
  }
}));

const { sequelize, Student, EtExamAttempt, EtExamAttemptSkillScore } = require('../models');
const { importExam } = require('../services/learningJourney/importExamService');

function bufferFromMatrix(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/** 產生至少 16 欄（A–P）的資料列 */
function dataRow({
  department = '資工系',
  college = '電資學院',
  classSection = 'A班',
  grade = '3',
  studentId = 'B10901001',
  studentName = '王小明',
  examType = 'GEPT',
  examDate = '2024-06-01',
  listening = [85, 'B2'],
  reading = [80, 'B2'],
  speaking = [75, 'B2'],
  writing = [70, 'B2']
}) {
  const r = new Array(16).fill('');
  r[0] = department;
  r[1] = college;
  r[2] = classSection;
  r[3] = grade;
  r[4] = studentId;
  r[5] = studentName;
  r[6] = examType;
  r[7] = examDate;
  r[8] = listening[0];
  r[9] = listening[1];
  r[10] = reading[0];
  r[11] = reading[1];
  r[12] = speaking[0];
  r[13] = speaking[1];
  r[14] = writing[0];
  r[15] = writing[1];
  return r;
}

function skillScoreStub(skill, cefr, cefrRank) {
  return {
    skill,
    cefr,
    cefrRank,
    toJSON() {
      return { skill, cefr: String(cefr), cefrRank };
    }
  };
}

describe('importExamService', () => {
  let attemptSeq;

  beforeEach(() => {
    sequelize.query.mockResolvedValue([[{ Type: "enum('GEPT','GEPT_A2','GEPT_B1','GEPT_B2','GEPT_C1','GEPT_C2','TOEIC','TOEFL_ITP','TOEFL_IBT','TOEFL_IBT_LEGACY','TOEFL_IBT_2026','IELTS','BESTEP','CAMBRIDGE','TOEIC_SW')" }], []]);
    jest.clearAllMocks();
    attemptSeq = 1;
    Student.findAll.mockResolvedValue([]);
    EtExamAttempt.findOne.mockResolvedValue(null);
    EtExamAttempt.destroy.mockResolvedValue(1);
    EtExamAttempt.create.mockImplementation(async (attrs) => {
      const id = attemptSeq;
      attemptSeq += 1;
      return { id, ...attrs };
    });
    EtExamAttemptSkillScore.create.mockResolvedValue({});
    EtExamAttemptSkillScore.destroy.mockResolvedValue(4);
  });

  test('1. 正常匯入（完整 A–P）→ 建立 attempt 與四科 skill rows', async () => {
    const buf = bufferFromMatrix([dataRow({})]);
    const res = await importExam(buf);

    expect(res.ok).toBe(true);
    expect(res.inserted).toBe(1);
    expect(res.skipped).toBe(0);
    expect(EtExamAttempt.create).toHaveBeenCalledTimes(1);
    const attemptPayload = EtExamAttempt.create.mock.calls[0][0];
    expect(attemptPayload.studentId).toBe('B10901001');
    expect(attemptPayload.testType).toBe('GEPT');
    expect(attemptPayload.testDate).toBe('2024-06-01');
    expect(attemptPayload.sourceType).toBe('excel_import');
    expect(attemptPayload.rawPayload?.meta_json?.importVersion).toBe('learning_journey_v3');
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(4);
    const skills = EtExamAttemptSkillScore.create.mock.calls.map((c) => c[0].skill).sort();
    expect(skills).toEqual(['listening', 'reading', 'speaking', 'writing']);
    expect(sequelize.transaction).toHaveBeenCalled();
  });

  test('1-1. 第一列 header 不會被當資料匯入，資料從第 2 列開始', async () => {
    const header = [
      '系所', '學院', '班別', '年級', '學號', '姓名', '英文檢定類別', '檢定時間',
      '聽力成績', '聽力成績(CEFR)', '閱讀成績', '閱讀成績(CEFR)',
      '口說成績', '口說成績(CEFR)', '寫作成績', '寫作成績(CEFR)'
    ];
    const buf = bufferFromMatrix([
      header,
      dataRow({ studentId: 'H001', studentName: '測試甲', examType: 'TOEIC', examDate: '2024-01-02' })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create).toHaveBeenCalledTimes(1);
    const attemptPayload = EtExamAttempt.create.mock.calls[0][0];
    expect(attemptPayload.studentId).toBe('H001');
    expect(attemptPayload.testType).toBe('TOEIC');
    expect(attemptPayload.testDate).toBe('2024-01-02');
  });

  test('2. CEFR 空白 → 不建立該技能列', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        listening: [85, ''],
        reading: [80, 'B2'],
        speaking: [75, ''],
        writing: [70, 'B2']
      })
    ]);
    const res = await importExam(buf);

    expect(res.inserted).toBe(1);
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(2);
    const created = EtExamAttemptSkillScore.create.mock.calls.map((c) => c[0].skill).sort();
    expect(created).toEqual(['reading', 'writing']);
  });

  test('3. CEFR 非法（B3、無效字串）→ warning 且不建立該技能', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        listening: [85, 'B3'],
        reading: [80, 'XX'],
        speaking: [75, 'B2'],
        writing: [70, 'B2']
      })
    ]);
    const res = await importExam(buf);

    expect(res.inserted).toBe(1);
    expect(res.warnings.some((w) => w.includes('listening') && w.includes('B3'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('reading') && w.includes('XX'))).toBe(true);
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(2);
    const created = EtExamAttemptSkillScore.create.mock.calls.map((c) => c[0].skill).sort();
    expect(created).toEqual(['speaking', 'writing']);
  });

  test('4. duplicate attempt（技能內容完全相同）→ skipped', async () => {
    EtExamAttempt.findOne.mockResolvedValue({
      skillScores: [
        skillScoreStub('listening', 'B2', 4),
        skillScoreStub('reading', 'B2', 4),
        skillScoreStub('speaking', 'B2', 4),
        skillScoreStub('writing', 'B2', 4)
      ]
    });
    const buf = bufferFromMatrix([dataRow({})]);
    const res = await importExam(buf);

    expect(res.inserted).toBe(0);
    expect(res.skipped).toBe(1);
    expect(EtExamAttempt.create).not.toHaveBeenCalled();
    expect(EtExamAttemptSkillScore.create).not.toHaveBeenCalled();
  });

  test('5. duplicate attempt（鍵相同、技能內容不同）→ conflict', async () => {
    EtExamAttempt.findOne.mockResolvedValue({
      skillScores: [
        skillScoreStub('listening', 'B2', 4),
        skillScoreStub('reading', 'B2', 4),
        skillScoreStub('speaking', 'B2', 4),
        skillScoreStub('writing', 'B2', 4)
      ]
    });
    const buf = bufferFromMatrix([
      dataRow({
        listening: [85, 'B1']
      })
    ]);
    const res = await importExam(buf);

    expect(res.inserted).toBe(0);
    expect(res.skipped).toBe(0);
    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].message).toMatch(/未覆寫/);
    expect(EtExamAttempt.create).not.toHaveBeenCalled();
  });

  test('5-1. replaceMode=true：鍵相同技能不同時先刪再寫', async () => {
    EtExamAttempt.findOne.mockResolvedValue({
      id: 99,
      skillScores: [
        skillScoreStub('listening', 'B2', 4),
        skillScoreStub('reading', 'B2', 4),
        skillScoreStub('speaking', 'B2', 4),
        skillScoreStub('writing', 'B2', 4)
      ]
    });
    const buf = bufferFromMatrix([
      dataRow({
        listening: [85, 'B1']
      })
    ]);
    const res = await importExam(buf, { replaceMode: true, batchId: 'ljv3:exam:test' });
    expect(res.conflicts).toHaveLength(0);
    expect(res.replaced).toBe(1);
    expect(res.inserted).toBe(1);
    expect(EtExamAttemptSkillScore.destroy).toHaveBeenCalled();
    expect(EtExamAttempt.destroy).toHaveBeenCalled();
    expect(EtExamAttempt.create).toHaveBeenCalled();
  });

  test('6. 同 studentId 不同姓名 → quarantine', async () => {
    const buf = bufferFromMatrix([
      dataRow({ studentId: 'C001', studentName: '甲' }),
      dataRow({ studentId: 'C001', studentName: '乙', examDate: '2024-06-02' })
    ]);
    const res = await importExam(buf);

    expect(res.quarantine.length).toBeGreaterThanOrEqual(1);
    expect(res.quarantine.every((q) => q.studentId === 'C001')).toBe(true);
    expect(res.inserted).toBe(0);
    expect(EtExamAttempt.create).not.toHaveBeenCalled();
  });

  test('7. 同姓名不同 studentId → 皆正常匯入', async () => {
    const buf = bufferFromMatrix([
      dataRow({ studentId: 'D001', studentName: '同名' }),
      dataRow({ studentId: 'D002', studentName: '同名', examDate: '2024-06-02' })
    ]);
    const res = await importExam(buf);

    expect(res.quarantine).toHaveLength(0);
    expect(res.inserted).toBe(2);
    expect(EtExamAttempt.create).toHaveBeenCalledTimes(2);
  });

  test('8. examType 或 examDate 空白 → 略過整列', async () => {
    const buf = bufferFromMatrix([
      dataRow({ studentId: 'E001', examType: '', examDate: '2024-01-01' }),
      dataRow({ studentId: 'E002', examType: 'GEPT', examDate: '' })
    ]);
    const res = await importExam(buf);

    expect(res.inserted).toBe(0);
    expect(res.warnings.length).toBe(2);
    expect(res.warnings.every((w) => w.includes('缺少 G') || w.includes('H'))).toBe(true);
    expect(EtExamAttempt.create).not.toHaveBeenCalled();
  });

  test('9. examType 非允許值（含標題誤讀）→ 略過避免寫入 DB', async () => {
    const buf = bufferFromMatrix([
      dataRow({ studentId: 'E003', examType: '英文檢定類別', examDate: '2024-01-02' }),
      dataRow({ studentId: 'E004', examType: '未知考試', examDate: '2024-01-03' })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(0);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(EtExamAttempt.create).not.toHaveBeenCalled();
  });

  test('10. 中文/非標準 examType 匯入行為受目前規格限制，至少不可寫入 header 文案資料', async () => {
    const buf = bufferFromMatrix([
      dataRow({ studentId: 'Z001', examType: '培力英檢', examDate: '2024-02-01' }),
      dataRow({ studentId: 'Z002', examType: '多益', examDate: '2024-02-02' }),
      dataRow({ studentId: 'Z003', examType: '英文檢定類別', examDate: '2024-02-03' })
    ]);
    const res = await importExam(buf);

    expect(res.ok).toBe(true);
    const createdTypes = EtExamAttempt.create.mock.calls.map((c) => c[0].testType);
    expect(createdTypes.includes('英文檢定類別')).toBe(false);
  });

  test('11. examType normalize 規則：全民英檢(GEPT) -> GEPT', async () => {
    const buf = bufferFromMatrix([dataRow({ studentId: 'N001', examType: '全民英檢(GEPT)' })]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('GEPT');
  });

  test('12. examType normalize 規則：多益聽力與閱讀測驗(TOEIC) -> TOEIC', async () => {
    const buf = bufferFromMatrix([dataRow({ studentId: 'N002', examType: '多益聽力與閱讀測驗(TOEIC)' })]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('TOEIC');
  });

  test('13. examType normalize 規則：托福紙筆測驗(TOEFL ITP) -> TOEFL_ITP', async () => {
    const buf = bufferFromMatrix([dataRow({ studentId: 'N003', examType: '托福紙筆測驗(TOEFL ITP)' })]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('TOEFL_ITP');
  });

  test('14. examType normalize 規則：托福網路化測驗(TOEFL-iBT) + 2024 日期 -> TOEFL_IBT_LEGACY', async () => {
    const buf = bufferFromMatrix([dataRow({ studentId: 'N004', examType: '托福網路化測驗(TOEFL-iBT)' })]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('TOEFL_IBT_LEGACY');
  });

  test('14-1. 托福 iBT 新制日期 -> TOEFL_IBT_2026', async () => {
    const buf = bufferFromMatrix([
      dataRow({ studentId: 'N004B', examType: 'TOEFL iBT', examDate: '2026-06-01' })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('TOEFL_IBT_2026');
  });

  test('18. 全民英檢中高級：四技能同 CEFR（exam_level_mapping），CEFR 欄可空白', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        studentId: 'G901',
        examType: '全民英檢中高級',
        examDate: '2025-03-01',
        listening: ['', ''],
        reading: [null, ''],
        speaking: ['', ''],
        writing: ['', '']
      })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('GEPT');
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(4);
    const allB2 = EtExamAttemptSkillScore.create.mock.calls.every((c) => c[0].cefr === 'B2');
    expect(allB2).toBe(true);
    const allLevelMap = EtExamAttemptSkillScore.create.mock.calls.every((c) => c[0].isInferred === true);
    expect(allLevelMap).toBe(true);
  });

  test('19. CAMBRIDGE：G 含等級、CEFR 空白可 level_mapping', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        studentId: 'C902',
        examType: '劍橋英檢 FCE',
        examDate: '2025-04-01',
        listening: [180, ''],
        reading: [180, ''],
        speaking: [160, ''],
        writing: [200, '']
      })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(4);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('CAMBRIDGE');
  });

  test('20. CEFR 空白但 TOEFL_IBT_LEGACY 分數可換算 -> 建立技能列', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        studentId: 'N007',
        examType: 'TOEFL iBT 舊制',
        examDate: '2025-01-01',
        listening: [17, ''],
        reading: [18, ''],
        speaking: [20, ''],
        writing: [17, '']
      })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(4);
    expect(res.autoMappedCefrCount).toBe(4);
    const inferred = EtExamAttemptSkillScore.create.mock.calls.filter((c) => c[0].isInferred === true);
    expect(inferred.length).toBe(4);
  });

  test('15. examType normalize 規則：劍橋英檢(Cambridge) -> CAMBRIDGE', async () => {
    const buf = bufferFromMatrix([dataRow({ studentId: 'N005', examType: '劍橋英檢(Cambridge)' })]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('CAMBRIDGE');
  });

  test('16. 單獨「托福」無法判斷 ITP/iBT -> skip + warning', async () => {
    const buf = bufferFromMatrix([dataRow({ studentId: 'N006', examType: '托福' })]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(0);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(EtExamAttempt.create).not.toHaveBeenCalled();
  });

  test('21. CAMBRIDGE 僅分數、G 無可辨識等級：level_based warning、不匯入', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        studentId: 'BEP01',
        examType: '劍橋英檢(Cambridge)',
        examDate: '2025-06-01',
        listening: [300, ''],
        reading: [310, ''],
        speaking: ['', ''],
        writing: ['', '']
      })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(0);
    expect(res.warnings.some((w) => w.includes('level_based'))).toBe(true);
    expect(res.warnings.some((w) => String(w).includes('INVALID_LEVEL'))).toBe(true);
    expect(EtExamAttempt.create).not.toHaveBeenCalled();
  });

  test('22. 多益口說測驗 -> TOEIC_SW；口說分數可換算', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        studentId: 'SW01',
        examType: '多益口說測驗',
        examDate: '2025-07-01',
        listening: ['', ''],
        reading: ['', ''],
        speaking: [160, ''],
        writing: ['', '']
      })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('TOEIC_SW');
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(1);
    expect(EtExamAttemptSkillScore.create.mock.calls[0][0].skill).toBe('speaking');
    expect(EtExamAttemptSkillScore.create.mock.calls[0][0].cefr).toBe('B2');
  });

  test('23. TOEIC 聽讀有分數、無 CEFR 可換算', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        studentId: 'TC01',
        examType: '多益',
        examDate: '2025-08-01',
        listening: [400, ''],
        reading: [410, ''],
        speaking: ['', ''],
        writing: ['', '']
      })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(EtExamAttempt.create.mock.calls[0][0].testType).toBe('TOEIC');
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(2);
    expect(res.autoMappedCefrCount).toBe(2);
  });

  test('24. Excel CEFR 有值時優先於分數換算', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        studentId: 'XL01',
        examType: '多益',
        examDate: '2025-11-01',
        listening: [490, 'B1'],
        reading: [400, 'B2'],
        speaking: ['', ''],
        writing: ['', '']
      })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    const listen = EtExamAttemptSkillScore.create.mock.calls.find((c) => c[0].skill === 'listening');
    expect(listen[0].cefr).toBe('B1');
  });

  test('25. CEFR 欄位為 - 時視為空白，BESTEP 可由分數自動推算', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        studentId: 'BP25',
        examType: 'BESTEP',
        examDate: '2025-12-01',
        listening: [100, '-'],
        reading: [130, '-'],
        speaking: [280, '-'],
        writing: [330, '-']
      })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(res.autoMappedCefrCount).toBe(4);
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(4);
    const created = EtExamAttemptSkillScore.create.mock.calls.map((c) => [c[0].skill, c[0].cefr]).sort();
    expect(created).toEqual([
      ['listening', 'B2'],
      ['reading', 'C1'],
      ['speaking', 'B2'],
      ['writing', 'C1']
    ]);
  });

  test('26. CEFR 空白且分數超出範圍時不硬推算', async () => {
    const buf = bufferFromMatrix([
      dataRow({
        studentId: 'TC26',
        examType: 'TOEIC',
        examDate: '2025-12-02',
        listening: [999, ''],
        reading: [410, ''],
        speaking: ['', ''],
        writing: ['', '']
      })
    ]);
    const res = await importExam(buf);
    expect(res.inserted).toBe(1);
    expect(res.autoMappedCefrCount).toBe(1);
    expect(res.warnings.some((w) => String(w).includes('SCORE_OUT_OF_RANGE'))).toBe(true);
    expect(EtExamAttemptSkillScore.create).toHaveBeenCalledTimes(1);
    expect(EtExamAttemptSkillScore.create.mock.calls[0][0].skill).toBe('reading');
  });
});
