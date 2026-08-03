'use strict';

/**
 * 考試成績 Excel 固定格式（第一個 sheet）：
 * A 系所 | B 學院 | C 班別 | D 年級 | E 學號 | F 姓名 | G 英文檢定類別 | H 檢定時間 |
 * I 聽力 | J 聽力(CEFR) | K 閱讀 | L 閱讀(CEFR) | M 口說 | N 口說(CEFR) | O 寫作 | P 寫作(CEFR)
 *
 * 去重鍵：studentId + testType/examType + testDate/examDate
 *
 * - 檔案內同 E（學號）對應不同 F（姓名）→ quarantine，該學號列皆不匯入
 * - DB 既有 students.studentId 之 name_zh 與 F 不符 → quarantine（不靜默接受）
 * - A～D（系所／學院／班別／年級）僅入 rawPayload，不作 B2 母體
 * - Excel CEFR 優先；score_based 且 raw 分數可換算者呼叫 inferCefrFromScore；level_based 則自 G 欄解析等級呼叫 inferCefrFromLevel
 */

const { Op } = require('sequelize');
const XLSX = require('xlsx');
const { sequelize, Student, EtExamAttempt, EtExamAttemptSkillScore } = require('../../models');
const { normalizeCefr, getCefrRank } = require('./utils/cefr');
const {
  MAPPING_VERSION,
  normalizeExamType: normalizeExamTypeV3,
  inferCefrFromScore,
  inferCefrFromLevel,
  isScoreBasedExam,
  isLevelBasedExam,
  getMappingMeta
} = require('./utils/cefrScoreMapping');

const COL = {
  department: 0,
  college: 1,
  classSection: 2,
  grade: 3,
  studentId: 4,
  studentName: 5,
  examType: 6,
  examDate: 7,
  listeningScore: 8,
  listeningCefr: 9,
  readingScore: 10,
  readingCefr: 11,
  speakingScore: 12,
  speakingCefr: 13,
  writingScore: 14,
  writingCefr: 15
};

const SKILL_SPECS = [
  { skill: 'listening', scoreCol: COL.listeningScore, cefrCol: COL.listeningCefr },
  { skill: 'reading', scoreCol: COL.readingScore, cefrCol: COL.readingCefr },
  { skill: 'speaking', scoreCol: COL.speakingScore, cefrCol: COL.speakingCefr },
  { skill: 'writing', scoreCol: COL.writingScore, cefrCol: COL.writingCefr }
];
const STANDARD_EXAM_TYPES = new Set([
  'GEPT',
  'TOEIC',
  'TOEFL_ITP',
  'TOEFL_IBT_LEGACY',
  'TOEFL_IBT_2026',
  'IELTS',
  'BESTEP',
  'CAMBRIDGE',
  'TOEIC_SW'
]);
const DB_SAFE_FALLBACK_TYPES = new Set([
  'BESTEP',
  'TOEIC',
  'TOEIC_SW',
  'IELTS',
  'TOEFL_IBT',
  'TOEFL_IBT_LEGACY',
  'TOEFL_IBT_2026',
  'TOEFL_ITP',
  'GEPT',
  'GEPT_A2',
  'GEPT_B1',
  'GEPT_B2',
  'GEPT_C1',
  'GEPT_C2',
  'CAMBRIDGE'
]);
/** 非 iBT/S&W/ITP 等（由 normalizeExamTypeV3 處理者除外）之別名 */
const EXAM_TYPE_ALIASES = Object.freeze({
  '全民英檢': 'GEPT',
  'GEPT': 'GEPT',
  '全民英檢(GEPT)': 'GEPT',
  '多益': 'TOEIC',
  'TOEIC': 'TOEIC',
  '多益聽力與閱讀測驗': 'TOEIC',
  '多益聽力與閱讀測驗(TOEIC)': 'TOEIC',
  '多益聽力測驗': 'TOEIC',
  '多益閱讀測驗': 'TOEIC',
  '雅思': 'IELTS',
  'IELTS': 'IELTS',
  '雅思(IELTS)': 'IELTS',
  '培力英檢': 'BESTEP',
  '培力': 'BESTEP',
  'BESTEP': 'BESTEP',
  '培力英檢(BESTEP)': 'BESTEP',
  '劍橋英檢': 'CAMBRIDGE',
  'CAMBRIDGE': 'CAMBRIDGE',
  '劍橋英檢(CAMBRIDGE)': 'CAMBRIDGE',
  '劍橋英檢(Cambridge)': 'CAMBRIDGE'
});

function normSid(s) {
  return String(s || '').trim().toUpperCase();
}

function normName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function cellStr(row, idx) {
  const v = row && row[idx];
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function isBlankCefrCell(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  return ['-', '—', 'N/A', 'NA', 'NULL'].includes(v.toUpperCase());
}

function isHeaderLikeRow(row) {
  if (!row) return false;
  const sid = cellStr(row, COL.studentId).toLowerCase();
  const name = cellStr(row, COL.studentName).toLowerCase();
  const examType = cellStr(row, COL.examType).toLowerCase();
  const examDate = cellStr(row, COL.examDate).toLowerCase();
  return (
    sid.includes('學號') ||
    sid.includes('student') ||
    name.includes('姓名') ||
    name.includes('name') ||
    examType.includes('英文檢定類別') ||
    examType.includes('exam') ||
    examType.includes('test') ||
    examDate.includes('檢定時間') ||
    examDate.includes('date')
  );
}

function parseRawScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeExamTypeFromAliasesOnly(value) {
  const raw = String(value || '').trim();
  if (!raw) return { code: '', reason: 'empty' };
  const normalizedParens = raw.replace(/（/g, '(').replace(/）/g, ')');
  const compact = normalizedParens.replace(/\s+/g, '');
  const upper = compact.toUpperCase();
  if (compact === '托福' || upper === 'TOEFL') {
    return { code: '', reason: 'ambiguous_tofel_type' };
  }
  const mapped = EXAM_TYPE_ALIASES[normalizedParens]
    || EXAM_TYPE_ALIASES[compact]
    || EXAM_TYPE_ALIASES[upper]
    || '';
  return { code: mapped, reason: mapped ? null : 'unknown' };
}

/**
 * V3 考試類別：先 cefrScoreMapping（S&W / ITP / iBT 新舊制），再其餘別名表。
 * @param {string} raw
 * @param {string|null} examDateIso
 */
function resolveImportExamType(raw, examDateIso) {
  const v3 = normalizeExamTypeV3(raw, { examDate: examDateIso });
  if (v3.code) {
    return { code: v3.code, reason: null };
  }
  if (v3.reason === 'AMBIGUOUS_TOEFL_TYPE') {
    return { code: '', reason: 'ambiguous_tofel_type' };
  }
  if (v3.reason === 'TOEFL_IBT_NEEDS_EXAM_DATE') {
    return { code: '', reason: 'toefl_ibt_needs_exam_date' };
  }
  return normalizeExamTypeFromAliasesOnly(raw);
}

function parseEnumValues(typeText) {
  const m = String(typeText || '').match(/^enum\((.+)\)$/i);
  if (!m) return null;
  const body = m[1];
  const values = [];
  const re = /'([^']*)'/g;
  let hit = re.exec(body);
  while (hit) {
    values.push(String(hit[1] || '').toUpperCase());
    hit = re.exec(body);
  }
  return values.length ? new Set(values) : null;
}

async function getSupportedExamTypesFromDb() {
  try {
    const [rows] = await sequelize.query("SHOW COLUMNS FROM et_exam_attempts LIKE 'examType'");
    const row = Array.isArray(rows) ? rows[0] : null;
    const typeText = row && row.Type ? String(row.Type) : '';
    const enumSet = parseEnumValues(typeText);
    if (enumSet) return enumSet;
  } catch (_) {
    // ignore and fallback
  }
  return DB_SAFE_FALLBACK_TYPES;
}

function normalizeDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const mo = value.getMonth() + 1;
    const da = value.getDate();
    return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && typeof parsed.y === 'number') {
      const y = parsed.y;
      const m = parsed.m + 1;
      const d = parsed.d;
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  const text = String(value).trim().replace(/\//g, '-');
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isInteger(y) || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}

function canonicalSkillPayloadParts(rows, fromDb) {
  const arr = [];
  for (const row of rows || []) {
    const j = fromDb && typeof row.toJSON === 'function' ? row.toJSON() : row;
    if (!j.skill) continue;
    arr.push({
      skill: j.skill,
      cefr: j.cefr != null ? String(j.cefr) : '',
      cefrRank: j.cefrRank != null ? Number(j.cefrRank) : null
    });
  }
  arr.sort((a, b) => String(a.skill).localeCompare(String(b.skill)));
  return JSON.stringify(arr);
}

/**
 * @param {Buffer} file
 * @param {{ batchId?: string, replaceMode?: boolean }} options
 */
async function importExam(file, options = {}) {
  const warnings = [];
  const conflicts = [];
  const quarantine = [];
  let inserted = 0;
  let skipped = 0;
  let replaced = 0;
  let autoMappedCefrCount = 0;
  const autoMappedCefrDetails = [];
  const batchId = String(options.batchId || '').trim() || `v3-exam:${Date.now()}`;
  const replaceMode = options.replaceMode === true;

  const workbook = XLSX.read(file, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const dbSupportedExamTypes = await getSupportedExamTypesFromDb();

  let startRow = 0;
  for (let i = 0; i < Math.min(matrix.length, 3); i += 1) {
    if (isHeaderLikeRow(matrix[i])) {
      startRow = i + 1;
      break;
    }
  }

  const fileRows = [];
  for (let i = startRow; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!row) continue;
    if (isHeaderLikeRow(row)) continue;
    const studentId = normSid(cellStr(row, COL.studentId));
    if (!studentId) continue;
    fileRows.push({
      line: i + 1,
      row,
      studentId,
      studentName: normName(cellStr(row, COL.studentName))
    });
  }

  const idToNames = new Map();
  const idHasEmptyName = new Set();
  for (const fr of fileRows) {
    if (!fr.studentName) {
      idHasEmptyName.add(fr.studentId);
      continue;
    }
    if (!idToNames.has(fr.studentId)) idToNames.set(fr.studentId, new Set());
    idToNames.get(fr.studentId).add(fr.studentName);
  }
  const fileConflictIds = new Set();
  for (const [sid, set] of idToNames) {
    if (set.size > 1) fileConflictIds.add(sid);
    if (idHasEmptyName.has(sid) && set.size >= 1) fileConflictIds.add(sid);
  }

  const uniqueIds = [...new Set(fileRows.map((r) => r.studentId))];
  const dbStudents =
    uniqueIds.length > 0
      ? await Student.findAll({
          where: { studentId: { [Op.in]: uniqueIds } }
        })
      : [];
  const sidToStudent = new Map(dbStudents.map((s) => [normSid(s.studentId), s]));

  await sequelize.transaction(async (transaction) => {
    for (const { line, row, studentId, studentName: nameFromSheet } of fileRows) {
      const department = normName(cellStr(row, COL.department));
      const college = normName(cellStr(row, COL.college));
      const classSection = normName(cellStr(row, COL.classSection));
      const gradeText = normName(cellStr(row, COL.grade));

      const examTypeRaw = cellStr(row, COL.examType);
      const examDateRaw = row[COL.examDate];

      if (fileConflictIds.has(studentId)) {
        quarantine.push({
          reason: 'same_student_id_different_student_name_in_file',
          studentId,
          line
        });
        continue;
      }

      if (!nameFromSheet) {
        warnings.push(`第 ${line} 列：F 姓名空白，無法檢核學號身分，略過`);
        continue;
      }

      if (!examTypeRaw || examDateRaw === '' || examDateRaw == null) {
        warnings.push(`第 ${line} 列：缺少 G 英文檢定類別或 H 檢定時間，已略過`);
        continue;
      }

      const examDate = normalizeDateOnly(examDateRaw);
      if (!examDate) {
        warnings.push(`第 ${line} 列：無法解析 H 檢定時間，已略過`);
        continue;
      }

      const examTypeNorm = resolveImportExamType(examTypeRaw, examDate);
      const examType = examTypeNorm.code;

      if (examTypeNorm.reason === 'ambiguous_tofel_type') {
        warnings.push(
          `第 ${line} 列：G 英文檢定類別「${examTypeRaw}」無法判斷考試類型（請勿僅填「托福」），已略過`
        );
        continue;
      }
      if (examTypeNorm.reason === 'toefl_ibt_needs_exam_date') {
        warnings.push(`第 ${line} 列：G 為托福 iBT 但檢定日期不足以判斷新舊制，已略過`);
        continue;
      }
      if (!examType || examTypeNorm.reason === 'unknown' || examTypeNorm.reason === 'empty') {
        warnings.push(`第 ${line} 列：G 英文檢定類別「${examTypeRaw}」不在允許值，已略過`);
        continue;
      }
      if (!STANDARD_EXAM_TYPES.has(examType)) {
        warnings.push(`第 ${line} 列：G 英文檢定類別「${examTypeRaw}」不在允許值，已略過`);
        continue;
      }
      if (!dbSupportedExamTypes.has(examType)) {
        warnings.push(`第 ${line} 列：G 英文檢定類別「${examType}」目前資料庫未支援，請先執行 migration，已略過`);
        continue;
      }

      const existingStudent = sidToStudent.get(studentId);
      if (existingStudent && normName(existingStudent.nameZh) !== nameFromSheet) {
        quarantine.push({
          reason: 'student_id_name_mismatch_db',
          studentId,
          line,
          nameInDb: normName(existingStudent.nameZh),
          nameInExcel: nameFromSheet
        });
        continue;
      }

      const skillsRaw = {};
      const incomingSkills = [];

      const levelInfer = isLevelBasedExam(examType)
        ? inferCefrFromLevel({ examType, level: examTypeRaw, examDate })
        : null;

      let hadRawButNoScoreMappingRules = false;
      let levelBasedRowWarned = false;

      for (const spec of SKILL_SPECS) {
        const cRawStr = cellStr(row, spec.cefrCol);
        const hasExcelCefr = !isBlankCefrCell(cRawStr);
        const rawScore = parseRawScore(row[spec.scoreCol]);
        skillsRaw[spec.skill] = {
          rawScore,
          cefrText: cRawStr,
          cefrSource: null,
          mappingType: null,
          source: null,
          version: null,
          verifiedAt: null,
          mappingVersion: null
        };

        if (hasExcelCefr) {
          const cefrNorm = normalizeCefr(cRawStr);
          if (!cefrNorm) {
            warnings.push(`第 ${line} 列 ${spec.skill}：CEFR「${cRawStr}」非 A1–C2，已略過該技能`);
            continue;
          }
          const rank = getCefrRank(cefrNorm);
          const meta = getMappingMeta(examType);
          skillsRaw[spec.skill].cefrSource = 'excel';
          skillsRaw[spec.skill].mappingType = meta?.mappingType || null;
          skillsRaw[spec.skill].source = meta?.source || null;
          skillsRaw[spec.skill].version = meta?.version || MAPPING_VERSION;
          skillsRaw[spec.skill].verifiedAt = meta?.verifiedAt || null;
          skillsRaw[spec.skill].mappingVersion = MAPPING_VERSION;
          incomingSkills.push({
            skill: spec.skill,
            cefr: cefrNorm,
            cefrRank: rank,
            rawScore,
            cefrSource: 'excel',
            mappingType: meta?.mappingType,
            source: meta?.source,
            version: meta?.version || MAPPING_VERSION,
            verifiedAt: meta?.verifiedAt || null
          });
          continue;
        }

        if (isScoreBasedExam(examType) && rawScore != null) {
          const inf = inferCefrFromScore({
            examType,
            skill: spec.skill,
            rawScore,
            examDate
          });
          if (!inf.isMapped) {
            if (inf.reason === 'UNSUPPORTED_EXAM_TYPE') {
              hadRawButNoScoreMappingRules = true;
            } else {
              warnings.push(
                `第 ${line} 列 ${spec.skill}：無法由分數換算 CEFR（${inf.reason}），已略過該技能`
              );
            }
            continue;
          }
          skillsRaw[spec.skill].cefrSource = 'score_mapping';
          skillsRaw[spec.skill].mappingType = inf.mappingType;
          skillsRaw[spec.skill].source = inf.source;
          skillsRaw[spec.skill].version = inf.version;
          skillsRaw[spec.skill].verifiedAt = inf.verifiedAt;
          skillsRaw[spec.skill].mappingVersion = MAPPING_VERSION;
          skillsRaw[spec.skill].autoMappedReason = 'CEFR_AUTO_MAPPED_FROM_SCORE';
          autoMappedCefrCount += 1;
          autoMappedCefrDetails.push({
            rowNumber: line,
            skill: spec.skill,
            examType,
            score: inf.rawScore,
            mappedCefr: inf.cefr,
            reason: 'CEFR_AUTO_MAPPED_FROM_SCORE'
          });
          incomingSkills.push({
            skill: spec.skill,
            cefr: inf.cefr,
            cefrRank: inf.cefrRank,
            rawScore: inf.rawScore,
            cefrSource: 'score_mapping',
            mappingType: inf.mappingType,
            source: inf.source,
            version: inf.version,
            verifiedAt: inf.verifiedAt
          });
          continue;
        }

        if (isLevelBasedExam(examType)) {
          if (!levelInfer || !levelInfer.isMapped) {
            if (!levelBasedRowWarned) {
              const r = levelInfer?.reason || 'LEVEL_REQUIRED_FOR_MAPPING';
              warnings.push(
                `第 ${line} 列（G：${examTypeRaw}）：level_based 檢定無法自 G 欄解析等級（${r}），略過未填 CEFR 之技能`
              );
              levelBasedRowWarned = true;
            }
            continue;
          }
          skillsRaw[spec.skill].cefrSource = 'level_mapping';
          skillsRaw[spec.skill].mappingType = levelInfer.mappingType;
          skillsRaw[spec.skill].source = levelInfer.source;
          skillsRaw[spec.skill].version = levelInfer.version;
          skillsRaw[spec.skill].verifiedAt = levelInfer.verifiedAt;
          skillsRaw[spec.skill].mappingVersion = MAPPING_VERSION;
          incomingSkills.push({
            skill: spec.skill,
            cefr: levelInfer.cefr,
            cefrRank: levelInfer.cefrRank,
            rawScore,
            cefrSource: 'level_mapping',
            mappingType: levelInfer.mappingType,
            source: levelInfer.source,
            version: levelInfer.version,
            verifiedAt: levelInfer.verifiedAt
          });
          continue;
        }

        if (rawScore != null) {
          hadRawButNoScoreMappingRules = true;
        }
      }

      if (incomingSkills.length === 0 && hadRawButNoScoreMappingRules) {
        warnings.push(
          `第 ${line} 列（G：${examTypeRaw}）：CEFR_MISSING_AND_AUTO_MAPPING_UNSUPPORTED，此檢定類型未提供依 I/K/M/O 分數自動換算 CEFR 的規則（或該技能無對照表）；請填寫 J/L/N/P 或調整 G 欄類別，已略過`
        );
        continue;
      }

      if (incomingSkills.length === 0) {
        if (!levelBasedRowWarned) {
          warnings.push(`第 ${line} 列：四技能皆無有效 CEFR（Excel、分數換算或等級對照），已略過`);
        }
        continue;
      }

      const existing = await EtExamAttempt.findOne({
        where: {
          studentId,
          testType: examType,
          testDate: examDate
        },
        include: [{ model: EtExamAttemptSkillScore, as: 'skillScores', required: false }],
        transaction
      });

      if (existing) {
        const dbSig = canonicalSkillPayloadParts(existing.skillScores || [], true);
        const inSig = canonicalSkillPayloadParts(incomingSkills, false);
        if (dbSig === inSig) {
          skipped += 1;
          continue;
        }
        if (replaceMode) {
          await EtExamAttemptSkillScore.destroy({
            where: { attemptId: existing.id },
            transaction
          });
          await EtExamAttempt.destroy({
            where: { id: existing.id },
            transaction
          });
          replaced += 1;
        } else {
        conflicts.push({
          studentId,
          examType,
          examDate,
          line,
          message: '與既有測驗鍵相同但技能內容不同，未覆寫'
        });
        continue;
        }
      }

      const attempt = await EtExamAttempt.create(
        {
          studentId,
          examType,
          examDate,
          testType: examType,
          testDate: examDate,
          source: 'manual_import',
          sourceType: 'excel_import',
          sourceBatchId: batchId,
          importBatchId: batchId,
          status: 'valid',
          rawPayload: {
            meta_json: {
              importVersion: 'learning_journey_v3',
              batchId,
              mappingVersion: MAPPING_VERSION
            },
            rowLine: line,
            department,
            college,
            classSection,
            grade: gradeText,
            studentName: nameFromSheet,
            skillsRaw,
            importReferenceOnly: true
          }
        },
        { transaction }
      );

      for (const s of incomingSkills) {
        const inferredLike =
          s.cefrSource === 'score_mapping' || s.cefrSource === 'level_mapping';
        await EtExamAttemptSkillScore.create(
          {
            attemptId: attempt.id,
            skill: s.skill,
            cefr: s.cefr,
            cefrRank: s.cefrRank,
            rawScore: s.rawScore,
            rawLevel: null,
            isInferred: inferredLike,
            inferenceVersion: inferredLike ? (s.version || MAPPING_VERSION) : null
          },
          { transaction }
        );
      }

      inserted += 1;
    }
  });

  return {
    ok: true,
    batchId,
    sourceBatchId: batchId,
    totalRows: fileRows.length,
    inserted,
    importedRows: inserted,
    replaced,
    skipped,
    autoMappedCefrCount,
    autoMappedCefrDetails,
    warnings,
    conflicts,
    quarantine
  };
}

module.exports = {
  importExam
};
