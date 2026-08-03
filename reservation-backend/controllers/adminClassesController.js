// controllers/adminClassesController.js
const { Class, ClassMembership, Reservation, Event, User, BlackListRecord, ClassTeacher, sequelize } = require('../models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { newImportBatchId } = require('../utils/importBatchId');
const importRollbackManifestService = require('../services/importRollbackManifestService');
const { getStudentParticipationStats: getStudentParticipationStatsUtil } = require('../utils/eventStats');
const { SEMESTER_RANGES } = require('../utils/semesterConstants');
const auditLogService = require('../services/auditLogService');
const { logExportAudit } = require('../utils/exportAudit');
const {
  assertCanAccessClass,
  buildClassScopeWhere,
  sendClassScopeDenied,
} = require('../services/accessControl/classScopeGuard');
const {
  parseClassRosterPdf,
  buildClassDisplayName,
} = require('../services/classRosterPdfParseService');
const { applyStructuredClassRosterImport } = require('../services/classRosterImportService');
const fs = require('fs');

// 活動類型映射
const ACTIVITY_TYPE_MAP = {
  'ET': 'English Table',
  'EC': 'English Club', 
  'JT': 'Job Talk',
  'IF': 'International Forum'
};

/**
 * 根據日期判斷學期
 */
function getSemesterByDate(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  
  // 113-2學期: 2025/02/01 到 2025/07/31
  if (year === 2025 && month >= 2 && month <= 7) {
    return '113-2';
  }
  // 114-1學期: 2025/08/01 到 2026/01/31
  if ((year === 2025 && month >= 8) || (year === 2026 && month <= 1)) {
    return '114-1';
  }
  // 114-2學期: 2026/02/01 到 2026/07/31
  if (year === 2026 && month >= 2 && month <= 7) {
    return '114-2';
  }
  // 115-1學期: 2026/09/01 到 2027/01/31
  if ((year === 2026 && month >= 9) || (year === 2027 && month <= 1)) {
    return '115-1';
  }
  // 115-2學期: 2027/02/01 到 2027/07/31
  if (year === 2027 && month >= 2 && month <= 7) {
    return '115-2';
  }
  
  return null;
}

/**
 * 匯入班級名單
 */
const importClassRoster = async (req, res, next) => {
  try {
    let { semester, className, teacherName, courseName, courseCode } = req.query;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: '請上傳檔案' });
    }

    // 如果沒有提供學期，根據匯入時間自動判斷
    if (!semester) {
      semester = getSemesterByDate(new Date());
      if (!semester) {
        return res.status(400).json({ error: '無法自動判斷學期，請手動指定學期' });
      }
    }

    const resolvedCourseName = String(courseName || '').trim();
    const resolvedCourseCode = String(courseCode || '').trim();
    if (!className && (resolvedCourseName || resolvedCourseCode)) {
      className = buildClassDisplayName(resolvedCourseName, resolvedCourseCode);
    }

    if (!className) {
      return res.status(400).json({ error: '請指定課程名稱（與課程代碼）或班級名稱' });
    }

    if (!teacherName) {
      return res.status(400).json({ error: '請指定老師姓名' });
    }

    if (resolvedCourseName && !resolvedCourseCode) {
      return res.status(400).json({ error: '請填寫課程代碼' });
    }
    if (resolvedCourseCode && !resolvedCourseName) {
      return res.status(400).json({ error: '請填寫課程名稱' });
    }

    // 解析 Excel 檔案
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(422).json({ error: '檔案中沒有資料' });
    }

    // 欄位映射（新格式不需要班級欄位，由使用者指定）
    const headers = Object.keys(data[0]);
    const fieldMapping = mapHeadersNewFormat(headers);
    
    if (!fieldMapping.studentId || !fieldMapping.studentName) {
      return res.status(422).json({ 
        error: '缺少必要欄位',
        required: ['學號', '姓名'],
        found: headers,
        suggestions: getHeaderSuggestionsNewFormat(headers)
      });
    }

    let classesCreated = 0;
    let classesUpdated = 0;
    let membersUpserted = 0;
    let skipped = 0;
    const warnings = [];
    const importBatchId = newImportBatchId('class-roster', semester);
    const createdMembershipIds = [];
    const updatedSnapshots = [];
    let resolvedClassId = null;

    // 處理每一行資料
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel 行號從 2 開始

      try {
        // 清洗資料（使用使用者指定的班級名稱）
        const studentId = cleanStudentId(row[fieldMapping.studentId]);
        const studentName = cleanString(row[fieldMapping.studentName]);
        const department = fieldMapping.department ? cleanString(row[fieldMapping.department]) : null;
        const email = fieldMapping.email ? cleanString(row[fieldMapping.email]) : null;

        // 驗證必填欄位
        if (!studentId || !studentName) {
          warnings.push(`第 ${rowNum} 行：缺少必要欄位（學號或姓名）`);
          skipped++;
          continue;
        }

        // 處理班級（使用使用者指定的班級名稱和老師名稱）
        const [classRecord, classCreated] = await Class.findOrCreate({
          where: { name: className, semester },
          defaults: { name: className, semester, department, teacherName }
        });

        if (classCreated) {
          classesCreated++;
        } else {
          classesUpdated++;
        }
        resolvedClassId = classRecord.id;

        const existingMembership = await ClassMembership.findOne({
          where: { semester, classId: classRecord.id, studentId },
        });
        if (existingMembership) {
          updatedSnapshots.push({
            id: existingMembership.id,
            studentId: existingMembership.studentId,
            studentName: existingMembership.studentName,
            department: existingMembership.department,
            email: existingMembership.email,
            grade: existingMembership.grade,
          });
        }

        // 處理班級成員
        await ClassMembership.upsert({
          semester,
          classId: classRecord.id,
          studentId,
          studentName,
          department,
          email,
          grade: fieldMapping.grade ? parseInt(row[fieldMapping.grade]) || null : null
        });

        if (!existingMembership) {
          const createdMembership = await ClassMembership.findOne({
            where: { semester, classId: classRecord.id, studentId },
            attributes: ['id'],
          });
          if (createdMembership?.id) createdMembershipIds.push(createdMembership.id);
        }

        membersUpserted++;

      } catch (error) {
        warnings.push(`第 ${rowNum} 行處理失敗：${error.message}`);
        skipped++;
      }
    }

    if (resolvedClassId && (createdMembershipIds.length || updatedSnapshots.length)) {
      await importRollbackManifestService.saveManifest({
        importBatchId,
        sourceModule: 'admin_classes',
        kind: 'class_roster',
        manifest: {
          kind: 'class_roster',
          classId: resolvedClassId,
          semester,
          className,
          createdMembershipIds,
          updatedSnapshots,
        },
      });
    }

    auditLogService.logAuditAsync({
      module: 'admin_classes',
      action: 'import_class_roster',
      entityType: 'ClassRosterImport',
      entityId: `${semester}:${className}:${teacherName}`,
      targetSummary: `semester=${semester}, className=${className}`,
      afterData: {
        importBatchId,
        classId: resolvedClassId,
        semester,
        className,
        classesCreated,
        classesUpdated,
        membersUpserted,
        skipped,
        warningsCount: warnings ? warnings.length : 0,
      },
      req,
    });

    res.json({
      ok: true,
      semester,
      importBatchId,
      classesCreated,
      classesUpdated,
      membersUpserted,
      skipped,
      warnings
    });

  } catch (error) {
    auditLogService.logAuditAsync({
      module: 'admin_classes',
      action: 'import_class_roster',
      entityType: 'ClassRosterImport',
      entityId: `${req.query?.semester || 'unknown'}:${req.query?.className || 'unknown'}:${req.query?.teacherName || 'unknown'}`,
      targetSummary: 'import_class_roster_failed',
      beforeData: null,
      afterData: null,
      status: 'failed',
      errorMessage: error && error.message ? error.message : String(error),
      req,
    });
    next(error);
  }
};

function unlinkUploadQuietly(file) {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch (_) {
    // ignore cleanup errors
  }
}

/**
 * PDF 預覽：解析選課系統修課名單，不寫入 DB
 * POST /api/admin/classes/roster/import-pdf/preview
 */
const previewClassRosterPdf = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: '請上傳 PDF 檔案' });
    }
    const buffer = fs.readFileSync(file.path);
    const parsed = await parseClassRosterPdf(buffer);
    unlinkUploadQuietly(file);
    return res.json({
      ok: true,
      preview: true,
      ...parsed,
      suggestedClassName: buildClassDisplayName(parsed.course?.courseName, parsed.course?.courseCode),
    });
  } catch (error) {
    unlinkUploadQuietly(req.file);
    if (error.code && String(error.code).startsWith('PDF_')) {
      return res.status(422).json({ error: error.message, code: error.code });
    }
    return next(error);
  }
};

/**
 * PDF 匯入：可帶覆寫的學期／課程名稱／課程代碼／老師姓名
 * POST /api/admin/classes/roster/import-pdf
 * multipart: file + optional fields semester, courseName, courseCode, teacherName
 */
const importClassRosterPdf = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: '請上傳 PDF 檔案' });
    }
    const buffer = fs.readFileSync(file.path);
    const parsed = await parseClassRosterPdf(buffer);
    unlinkUploadQuietly(file);

    const body = req.body || {};
    const semester = String(body.semester || req.query.semester || parsed.course?.semester || '').trim();
    const courseName = String(body.courseName || req.query.courseName || parsed.course?.courseName || '').trim();
    const courseCode = String(body.courseCode || req.query.courseCode || parsed.course?.courseCode || '').trim();
    const teacherName = String(body.teacherName || req.query.teacherName || parsed.course?.teacherName || '').trim();
    const className = buildClassDisplayName(courseName, courseCode);

    if (!semester || !courseName || !courseCode || !teacherName) {
      return res.status(400).json({
        error: '請確認學期、課程名稱、課程代碼、老師姓名皆已填寫',
        parsedCourse: parsed.course,
      });
    }

    const result = await applyStructuredClassRosterImport({
      semester,
      className,
      teacherName,
      students: parsed.students,
      source: 'selcrs_pdf',
      req,
    });

    return res.json({
      ...result,
      course: {
        semester,
        courseName,
        courseCode,
        teacherName,
      },
      parseStats: parsed.stats,
      parseWarnings: parsed.warnings,
    });
  } catch (error) {
    unlinkUploadQuietly(req.file);
    if (error.status) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    if (error.code && String(error.code).startsWith('PDF_')) {
      return res.status(422).json({ error: error.message, code: error.code });
    }
    auditLogService.logAuditAsync({
      module: 'admin_classes',
      action: 'import_class_roster',
      entityType: 'ClassRosterImport',
      entityId: 'pdf_import_failed',
      targetSummary: 'import_class_roster_pdf_failed',
      status: 'failed',
      errorMessage: error && error.message ? error.message : String(error),
      req,
    });
    return next(error);
  }
};

/**
 * 取得班級總覽
 */
const getClassOverview = async (req, res, next) => {
  try {
    const { 
      semester = '114-1',
      activityType = 'All',
      q = '',
      search = '',
      studentId = '',
      teacherName = '',
      sortBy = 'coverage',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20
    } = req.query;

    const offset = (page - 1) * pageSize;
    const semesterRange = SEMESTER_RANGES[semester];

    if (!semesterRange) {
      return res.status(400).json({ error: '不支援的學期' });
    }

    // 建立查詢條件
    const whereClause = { semester };

    const classScopeWhere = buildClassScopeWhere(req.user);
    if (classScopeWhere === null) {
      return res.status(403).json({
        success: false,
        errorCode: 'MISSING_CLASS_CONTEXT',
        message: '此操作需要指定活動或班級資料來源。',
      });
    }
    Object.assign(whereClause, classScopeWhere);
    
    const classSearch = q || search;
    if (classSearch) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${classSearch}%` } },
        { department: { [Op.like]: `%${classSearch}%` } }
      ];
    }

    const teacherSearch = String(teacherName || '').trim();
    if (teacherSearch) {
      const teacherFilter = { [Op.like]: `%${teacherSearch}%` };
      if (whereClause.teacherName) {
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          { teacherName: whereClause.teacherName },
          { teacherName: teacherFilter }
        ];
        delete whereClause.teacherName;
      } else {
        whereClause.teacherName = teacherFilter;
      }
    }

    const cleanedStudentId = cleanStudentId(studentId);
    if (cleanedStudentId) {
      const semesterReservation = await Reservation.findOne({
        attributes: ['id'],
        include: [{
          model: Event,
          attributes: [],
          where: {
            date: {
              [Op.between]: [semesterRange.start, semesterRange.end]
            }
          }
        }],
        where: { studentId: cleanedStudentId }
      });

      if (!semesterReservation) {
        return res.json({
          data: [],
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total: 0,
            totalPages: 0
          }
        });
      }

      const matchingMemberships = await ClassMembership.findAll({
        attributes: ['classId'],
        where: {
          semester,
          studentId: cleanedStudentId
        },
        group: ['classId']
      });

      const classIds = matchingMemberships.map(m => m.classId).filter(Boolean);
      if (classIds.length === 0) {
        return res.json({
          data: [],
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total: 0,
            totalPages: 0
          }
        });
      }

      whereClause.id = { [Op.in]: classIds };
    }

    // 取得班級列表
    const classes = await Class.findAll({
      where: whereClause,
      include: [{
        model: ClassMembership,
        attributes: ['studentId']
      }],
      order: [[sortBy === 'className' ? 'name' : 'id', sortOrder.toUpperCase()]]
    });

    // 計算每個班的統計資料
    const classStats = await Promise.all(classes.map(async (classRecord) => {
      const rawStudentIds = classRecord.ClassMemberships ? classRecord.ClassMemberships.map(m => m.studentId) : [];
      // 清洗學號（轉大寫、去除空白），確保格式一致
      const studentIds = rawStudentIds.map(id => cleanStudentId(id)).filter(id => id);
      const studentCount = studentIds.length;

      if (studentCount === 0) {
        return {
          classId: classRecord.id,
          className: classRecord.name,
          teacherName: classRecord.teacherName,
          department: classRecord.department,
          studentCount: rawStudentIds.length, // 顯示原始學生數（包含格式不正確的）
          participatedCount: 0,
          coverage: 0,
          attendedCountTotal: 0,
          avgAttendPerStudent: 0,
          noShowCountTotal: 0,
          byType: {
            EnglishTable: 0,
            EnglishClub: 0,
            JobTalk: 0,
            InternationalForum: 0
          }
        };
      }

      // 查詢參與統計（使用清洗後的學號）
      const participationStats = await getParticipationStats(
        studentIds, 
        semesterRange, 
        activityType
      );

      const coverage = studentCount > 0 ? 
        (participationStats.participatedCount / studentCount * 100).toFixed(2) : 0;

      return {
        classId: classRecord.id,
        className: classRecord.name,
        teacherName: classRecord.teacherName,
        department: classRecord.department,
        studentCount,
        participatedCount: participationStats.participatedCount,
        coverage: parseFloat(coverage),
        attendedCountTotal: participationStats.attendedCountTotal,
        avgAttendPerStudent: studentCount > 0 ? 
          (participationStats.attendedCountTotal / studentCount).toFixed(2) : 0,
        noShowCountTotal: participationStats.noShowCountTotal,
        byType: participationStats.byType
      };
    }));

    // 排序
    if (sortBy === 'coverage') {
      classStats.sort((a, b) => sortOrder === 'desc' ? b.coverage - a.coverage : a.coverage - b.coverage);
    } else if (sortBy === 'attends') {
      classStats.sort((a, b) => sortOrder === 'desc' ? b.attendedCountTotal - a.attendedCountTotal : a.attendedCountTotal - b.attendedCountTotal);
    }

    // 分頁
    const total = classStats.length;
    const paginatedStats = classStats.slice(offset, offset + parseInt(pageSize));

    res.json({
      data: paginatedStats,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 取得班級明細
 */
const getClassDetail = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { 
      semester = '114-1',
      activityType = 'All',
      q = '',
      sortBy = 'studentId',
      sortOrder = 'asc',
      page = 1,
      pageSize = 50
    } = req.query;

    const offset = (page - 1) * pageSize;
    const semesterRange = SEMESTER_RANGES[semester];

    if (!semesterRange) {
      return res.status(400).json({ error: '不支援的學期' });
    }

    // 建立查詢條件
    const whereClause = { semester, classId };
    if (q) {
      whereClause[Op.or] = [
        { studentId: { [Op.like]: `%${q}%` } },
        { studentName: { [Op.like]: `%${q}%` } },
        { department: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } }
      ];
    }

    // 取得班級基本資訊
    const classRecord = await Class.findByPk(classId);
    if (classRecord) {
      try {
        await assertCanAccessClass(req.user, classRecord);
      } catch (scopeErr) {
        return sendClassScopeDenied(res, scopeErr);
      }
    }
    if (!classRecord) {
      return res.status(404).json({ error: '找不到班級' });
    }

    // 取得班級成員
    const members = await ClassMembership.findAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]]
    });

    // 計算每個學生的統計資料
    const studentStats = await Promise.all(members.map(async (member) => {
      // 清洗學號（轉大寫、去除空白），確保格式一致
      const cleanedStudentId = cleanStudentId(member.studentId);
      const stats = await getStudentParticipationStats(
        cleanedStudentId,
        semesterRange,
        activityType
      );

      return {
        studentId: member.studentId,
        studentName: member.studentName,
        department: member.department,
        email: member.email,
        ...stats
      };
    }));

    // 排序
    if (sortBy === 'attends') {
      studentStats.sort((a, b) => sortOrder === 'desc' ? b.attendedCountTotal - a.attendedCountTotal : a.attendedCountTotal - b.attendedCountTotal);
    } else if (sortBy === 'noShows') {
      studentStats.sort((a, b) => sortOrder === 'desc' ? b.noShowCount - a.noShowCount : a.noShowCount - b.noShowCount);
    }

    // 分頁
    const total = studentStats.length;
    const paginatedStats = studentStats.slice(offset, offset + parseInt(pageSize));

    res.json({
      classInfo: {
        id: classRecord.id,
        name: classRecord.name,
        semester: classRecord.semester,
        department: classRecord.department,
        teacherName: classRecord.teacherName
      },
      data: paginatedStats,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 匯出班級總覽 Excel
 */
const exportClassOverview = async (req, res, next) => {
  try {
    const { semester = '114-1', activityType = 'All' } = req.query;
    const semesterRange = SEMESTER_RANGES[semester];

    if (!semesterRange) {
      return res.status(400).json({ error: '不支援的學期' });
    }

    // 建立查詢條件
    const whereClause = { semester };
    const exportOverviewScopeWhere = buildClassScopeWhere(req.user);
    if (exportOverviewScopeWhere === null) {
      return res.status(403).json({
        success: false,
        errorCode: 'MISSING_CLASS_CONTEXT',
        message: '此操作需要指定活動或班級資料來源。',
      });
    }
    Object.assign(whereClause, exportOverviewScopeWhere);
    
    // 取得所有班級資料
    const classes = await Class.findAll({
      where: whereClause,
      include: [{
        model: ClassMembership,
        attributes: ['studentId']
      }]
    });

    // 計算統計資料
    const classStats = await Promise.all(classes.map(async (classRecord) => {
      const rawStudentIds = classRecord.ClassMemberships ? classRecord.ClassMemberships.map(m => m.studentId) : [];
      // 清洗學號（轉大寫、去除空白），確保格式一致
      const studentIds = rawStudentIds.map(id => cleanStudentId(id)).filter(id => id);
      const studentCount = studentIds.length;

      if (studentCount === 0) {
        return {
          className: classRecord.name,
          department: classRecord.department || '',
          studentCount: rawStudentIds.length, // 顯示原始學生數（包含格式不正確的）
          participatedCount: 0,
          coverage: 0,
          attendedCountTotal: 0,
          avgAttendPerStudent: 0,
          noShowCountTotal: 0,
          englishTable: 0,
          englishClub: 0,
          jobTalk: 0,
          internationalForum: 0
        };
      }

      const participationStats = await getParticipationStats(
        studentIds, 
        semesterRange, 
        activityType
      );

      const coverage = studentCount > 0 ? 
        (participationStats.participatedCount / studentCount * 100).toFixed(2) : 0;

      return {
        className: classRecord.name,
        studentCount,
        participatedCount: participationStats.participatedCount,
        coverage: parseFloat(coverage),
        attendedCountTotal: participationStats.attendedCountTotal,
        avgAttendPerStudent: studentCount > 0 ? 
          (participationStats.attendedCountTotal / studentCount).toFixed(2) : 0,
        noShowCountTotal: participationStats.noShowCountTotal,
        englishTable: participationStats.byType.EnglishTable,
        englishClub: participationStats.byType.EnglishClub,
        jobTalk: participationStats.byType.JobTalk,
        internationalForum: participationStats.byType.InternationalForum
      };
    }));

    // 建立 Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('班級參與概況');

    // 設定欄位
    worksheet.columns = [
      { header: '班級名稱', key: 'className', width: 20 },
      { header: '名冊人數', key: 'studentCount', width: 12 },
      { header: '至少參與人數', key: 'participatedCount', width: 15 },
      { header: '參與率(%)', key: 'coverage', width: 12 },
      { header: '簽到總次數', key: 'attendedCountTotal', width: 15 },
      { header: '平均參與次數', key: 'avgAttendPerStudent', width: 15 },
      { header: 'No-shows總數', key: 'noShowCountTotal', width: 15 },
      { header: 'English Table', key: 'englishTable', width: 15 },
      { header: 'English Club', key: 'englishClub', width: 15 },
      { header: 'Job Talk', key: 'jobTalk', width: 15 },
      { header: 'International Forum', key: 'internationalForum', width: 20 }
    ];

    // 填入資料
    classStats.forEach(stat => {
      worksheet.addRow(stat);
    });

    // 設定回應標頭
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="班級參與概況_${semester}.xlsx"`);

    await workbook.xlsx.write(res);

    logExportAudit(req, {
      module: 'class',
      action: 'class_overview_export',
      entityType: 'ClassExport',
      entityId: `overview:${semester}`,
      exportType: 'xlsx',
      reportType: 'class_overview',
      rowCount: classStats.length,
      filters: { semester, activityType },
      fileName: `班級參與概況_${semester}.xlsx`,
    });

    res.end();

  } catch (error) {
    next(error);
  }
};

/**
 * 匯出班級明細 Excel
 */
const exportClassDetail = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { semester = '114-1', activityType = 'All' } = req.query;
    const semesterRange = SEMESTER_RANGES[semester];

    if (!semesterRange) {
      return res.status(400).json({ error: '不支援的學期' });
    }

    // 取得班級資訊
    const classRecord = await Class.findByPk(classId);
    if (classRecord) {
      try {
        await assertCanAccessClass(req.user, classRecord);
      } catch (scopeErr) {
        return sendClassScopeDenied(res, scopeErr);
      }
    }
    if (!classRecord) {
      return res.status(404).json({ error: '找不到班級' });
    }

    // 取得班級成員
    const members = await ClassMembership.findAll({
      where: { semester, classId }
    });

    // 計算統計資料
    const studentStats = await Promise.all(members.map(async (member) => {
      // 清洗學號（轉大寫、去除空白），確保格式一致
      const cleanedStudentId = cleanStudentId(member.studentId);
      const stats = await getStudentParticipationStats(
        cleanedStudentId,
        semesterRange,
        activityType
      );

      return {
        studentId: member.studentId,
        studentName: member.studentName,
        department: member.department || '',
        totalHours: stats.totalHours || 0,
        pointScore: stats.pointScore || 0,
        lastAttendAt: stats.lastAttendAt || '',
        isBlacklisted: stats.isBlacklisted ? '是' : '否'
      };
    }));

    // 建立 Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${classRecord.name}_明細`);

    // 設定欄位
    worksheet.columns = [
      { header: '學號', key: 'studentId', width: 15 },
      { header: '姓名', key: 'studentName', width: 15 },
      { header: '系所', key: 'department', width: 20 },
      { header: '總時數', key: 'totalHours', width: 12 },
      { header: '計點數', key: 'pointScore', width: 12 },
      { header: '最後簽到日', key: 'lastAttendAt', width: 15 },
      { header: '黑名單', key: 'isBlacklisted', width: 10 }
    ];

    // 填入資料
    studentStats.forEach(stat => {
      worksheet.addRow(stat);
    });

    // 設定回應標頭
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${classRecord.name}_明細_${semester}.xlsx"`);

    await workbook.xlsx.write(res);

    logExportAudit(req, {
      module: 'class',
      action: 'class_students_export',
      entityType: 'ClassExport',
      entityId: `detail:${classId}:${semester}`,
      exportType: 'xlsx',
      reportType: 'class_students',
      rowCount: studentStats.length,
      filters: { semester, activityType, classId: Number(classId) },
      fileName: `${classRecord.name}_明細_${semester}.xlsx`,
    });

    res.end();

  } catch (error) {
    next(error);
  }
};

// 輔助函數

/**
 * 映射 Excel 標頭
 */
function mapHeaders(headers) {
  const mapping = {};
  
  headers.forEach(header => {
    const cleanHeader = header.toLowerCase().trim();
    
    if (cleanHeader.includes('班級') || cleanHeader.includes('class')) {
      mapping.className = header;
    } else if (cleanHeader.includes('學號') || cleanHeader.includes('student') || cleanHeader.includes('id')) {
      mapping.studentId = header;
    } else if (cleanHeader.includes('姓名') || cleanHeader.includes('name')) {
      mapping.studentName = header;
    } else if (cleanHeader.includes('系所') || cleanHeader.includes('department')) {
      mapping.department = header;
    } else if (cleanHeader.includes('email') || cleanHeader.includes('信箱')) {
      mapping.email = header;
    }
  });
  
  return mapping;
}

/**
 * 取得標頭建議
 */
function getHeaderSuggestions(foundHeaders) {
  return {
    required: ['班級名稱', '學號', '姓名'],
    optional: ['系所', 'Email'],
    found: foundHeaders
  };
}

/**
 * 清洗字串
 */
function cleanString(str) {
  if (!str) return null;
  return str.toString().trim().replace(/\s+/g, ' ');
}

/**
 * 清洗學號
 */
function cleanStudentId(str) {
  if (!str) return null;
  return str.toString().trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * 取得參與統計
 * 現在使用共用的工具函數，確保與活動報表的數據一致
 */
async function getParticipationStats(studentIds, semesterRange, activityType) {
  // 使用共用的工具函數，確保數據一致性
  return await getStudentParticipationStatsUtil(studentIds, semesterRange, activityType);
}

/**
 * 取得學生參與統計
 */
async function getStudentParticipationStats(studentId, semesterRange, activityType) {
  // 建立活動類型過濾條件
  const eventTypeFilter = activityType === 'All' ? {} : {
    eventType: ACTIVITY_TYPE_MAP[activityType] || activityType
  };

  // 查詢預約數
  const reservedCount = await Reservation.count({
    include: [{
      model: Event,
      where: {
        date: {
          [Op.between]: [semesterRange.start, semesterRange.end]
        },
        ...eventTypeFilter
      }
    }],
    where: { studentId }
  });

  // 查詢簽到統計 - 使用原始 SQL 避免 GROUP BY 問題
  const attendedStats = await sequelize.query(`
    SELECT 
      e.eventType,
      COUNT(r.id) as count,
      MAX(r.checkinTime) as lastAttend
    FROM Reservations r
    INNER JOIN Events e ON r.eventId = e.id
    WHERE r.studentId = :studentId
      AND r.checkinStatus = '已簽到'
      AND e.date BETWEEN :startDate AND :endDate
      ${activityType !== 'All' ? 'AND e.eventType = :activityType' : ''}
    GROUP BY e.eventType
  `, {
    replacements: {
      studentId: studentId,
      startDate: semesterRange.start,
      endDate: semesterRange.end,
      ...(activityType !== 'All' && { activityType: ACTIVITY_TYPE_MAP[activityType] || activityType })
    },
    type: sequelize.QueryTypes.SELECT
  });

  // 查詢違規數
  const noShowCount = await Reservation.count({
    include: [{
      model: Event,
      where: {
        date: {
          [Op.between]: [semesterRange.start, semesterRange.end]
        },
        ...eventTypeFilter
      }
    }],
    where: {
      studentId,
      checkinStatus: '已登記違規'
    }
  });

  // 查詢黑名單狀態
  const user = await User.findOne({ where: { studentId } });
  const isBlacklisted = user ? user.isBlacklisted : false;

  // 計算統計
  const attendedByType = {
    EnglishTable: 0,
    EnglishClub: 0,
    JobTalk: 0,
    InternationalForum: 0
  };

  let attendedCountTotal = 0;
  let lastAttendAt = null;
  let totalHours = 0;

  // 活動類型時數對應表（根據資料庫中的實際活動類型名稱）
  const getEventTypeHours = (eventType) => {
    if (eventType === 'English Table') return 0.5;
    if (eventType === 'English Club') return 1;
    if (eventType === 'Job Talk') return 1;
    if (eventType === 'International Forum') return 1;
    // 處理可能的變體名稱
    if (eventType === 'EnglishTable') return 0.5;
    if (eventType === 'EnglishClub') return 1;
    if (eventType === 'JobTalk') return 1;
    if (eventType === 'InternationalForum') return 1;
    return 0;
  };

  attendedStats.forEach(stat => {
    const count = parseInt(stat.count);
    attendedCountTotal += count;
    
    const eventType = stat.eventType;
    if (attendedByType.hasOwnProperty(eventType)) {
      attendedByType[eventType] = count;
    } else {
      // 處理可能的活動類型名稱變體
      if (eventType === 'English Table') {
        attendedByType.EnglishTable = count;
      } else if (eventType === 'English Club') {
        attendedByType.EnglishClub = count;
      } else if (eventType === 'Job Talk') {
        attendedByType.JobTalk = count;
      } else if (eventType === 'International Forum') {
        attendedByType.InternationalForum = count;
      }
    }

    // 計算總時數
    const hoursPerEvent = getEventTypeHours(eventType);
    totalHours += count * hoursPerEvent;

    if (stat.lastAttend && (!lastAttendAt || stat.lastAttend > lastAttendAt)) {
      lastAttendAt = stat.lastAttend;
    }
  });

  // 計算計點數（每半小時算一點，即總時數 * 2）
  const pointScore = totalHours * 2;

  return {
    reservedCount,
    attendedCountTotal,
    noShowCount,
    attendedByType,
    lastAttendAt: lastAttendAt ? new Date(lastAttendAt).toLocaleDateString() : null,
    isBlacklisted,
    totalHours: parseFloat(totalHours.toFixed(1)),
    pointScore: Math.round(pointScore)
  };
}

/**
 * 下載範例檔案
 * GET /api/admin/classes/sample
 */
async function downloadSampleFile(req, res) {
  try {
    // 創建範例資料（新格式：學號、姓名、系所、年級）
    const sampleData = [
      {
        '學號': 'B097610009',
        '姓名': '張宸祐',
        '系所': '人文暨科技跨領域學士學位學程',
        '年級': 4
      },
      {
        '學號': 'B101030036',
        '姓名': '林柏豐',
        '系所': '音樂學系',
        '年級': 4
      },
      {
        '學號': 'B102010032',
        '姓名': '巫子昀',
        '系所': '生物科學系',
        '年級': 4
      },
      {
        '學號': 'B111010044',
        '姓名': '王雪怡',
        '系所': '中國文學系',
        '年級': 3
      },
      {
        '學號': 'B111030020',
        '姓名': '謝子欣',
        '系所': '海洋科學系',
        '年級': 3
      }
    ];

    // 創建 Excel 工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('班級名單範例');

    // 設置標題行（新格式）
    worksheet.columns = [
      { header: '學號', key: 'studentId', width: 15 },
      { header: '姓名', key: 'studentName', width: 15 },
      { header: '系所', key: 'department', width: 35 },
      { header: '年級', key: 'grade', width: 10 }
    ];

    // 設置標題行樣式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };

    // 添加範例資料
    sampleData.forEach(row => {
      worksheet.addRow(row);
    });

    // 添加說明行
    worksheet.addRow([]);
    worksheet.addRow(['說明：']);
    worksheet.addRow(['1. 學號：必填，學生學號']);
    worksheet.addRow(['2. 姓名：必填，學生姓名']);
    worksheet.addRow(['3. 系所：選填，學生所屬系所']);
    worksheet.addRow(['4. 年級：選填，學生年級']);
    worksheet.addRow(['']);
    worksheet.addRow(['注意：']);
    worksheet.addRow(['- 班級名稱將在匯入時手動指定']);
    worksheet.addRow(['- 支援中英文欄位名稱']);
    worksheet.addRow(['- 檔案格式：.xlsx 或 .xls']);

    // 設置檔案名稱
    const filename = `班級名單範例_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // 設置回應標頭
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    // 寫入回應
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('下載範例檔案失敗:', error);
    res.status(500).json({
      error: '下載範例檔案失敗',
      details: error.message
    });
  }
}

/**
 * 新格式的欄位映射函數
 */
function mapHeadersNewFormat(headers) {
  const mapping = {};
  
  headers.forEach(header => {
    const cleanHeader = header.trim();
    
    // 學號欄位映射
    if (cleanHeader.includes('學號') || cleanHeader.includes('Student ID') || cleanHeader.includes('ID')) {
      mapping.studentId = header;
    }
    // 姓名欄位映射
    else if (cleanHeader.includes('姓名') || cleanHeader.includes('Name')) {
      mapping.studentName = header;
    }
    // 系所欄位映射
    else if (cleanHeader.includes('系所') || cleanHeader.includes('Department')) {
      mapping.department = header;
    }
    // 年級欄位映射
    else if (cleanHeader.includes('年級') || cleanHeader.includes('Grade')) {
      mapping.grade = header;
    }
    // Email欄位映射（可選）
    else if (cleanHeader.includes('Email') || cleanHeader.includes('email')) {
      mapping.email = header;
    }
  });
  
  return mapping;
}

/**
 * 新格式的欄位建議函數
 */
function getHeaderSuggestionsNewFormat(headers) {
  return {
    studentId: headers.filter(h => h.includes('學號') || h.includes('Student') || h.includes('ID')),
    studentName: headers.filter(h => h.includes('姓名') || h.includes('Name')),
    department: headers.filter(h => h.includes('系所') || h.includes('Department')),
    grade: headers.filter(h => h.includes('年級') || h.includes('Grade')),
    email: headers.filter(h => h.includes('Email') || h.includes('email'))
  };
}

/**
 * 刪除班級與相關資料
 * DELETE /api/admin/classes/:classId
 */
async function deleteClassRecord(req, res) {
  const { classId } = req.params;

  if (!classId || isNaN(Number(classId))) {
    return res.status(400).json({ error: '無效的班級ID' });
  }

  try {
    const classRecord = await Class.findByPk(classId);

    if (!classRecord) {
      return res.status(404).json({ error: '找不到班級資料' });
    }

    await sequelize.transaction(async (transaction) => {
      await ClassMembership.destroy({
        where: { classId },
        transaction
      });

      await ClassTeacher.destroy({
        where: { classId },
        transaction
      });

      await Class.destroy({
        where: { id: classId },
        transaction
      });
    });

    res.json({
      success: true,
      message: `班級「${classRecord.name}」已刪除`
    });
  } catch (error) {
    console.error('刪除班級失敗:', error);
    res.status(500).json({
      error: '刪除班級失敗',
      details: error.message
    });
  }
}

module.exports = {
  importClassRoster,
  previewClassRosterPdf,
  importClassRosterPdf,
  getClassOverview,
  getClassDetail,
  exportClassOverview,
  exportClassDetail,
  downloadSampleFile,
  deleteClassRecord,
  /** 供 classEvaluationService / analytics 重用，與班級概況統計一致 */
  getParticipationStats,
  getStudentParticipationStats,
  SEMESTER_RANGES,
  cleanStudentId
};
