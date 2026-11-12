'use strict';

/**
 * 只在拋棄式本機 MySQL 上執行。
 * 需要 EEARS_FEEDBACK_IT=1、127.0.0.1、port 3316、資料庫名稱 eears_fb_it_*。
 * 不讀取 .env 的 activity_reservation，也不碰 .mysql-data。
 */

const ENABLED = process.env.EEARS_FEEDBACK_IT === '1';

function assertIsolatedTarget() {
  const host = process.env.EEARS_IT_DB_HOST;
  const port = Number(process.env.EEARS_IT_DB_PORT);
  const name = process.env.EEARS_IT_DB_NAME || '';
  if (host !== '127.0.0.1') throw new Error('整合測試只允許 127.0.0.1');
  if (port !== 3316) throw new Error('整合測試只允許拋棄式 port 3316');
  if (!/^eears_fb_it_[a-z0-9_]+$/.test(name)) throw new Error('整合測試資料庫名稱不符合隔離規則');
}

if (ENABLED) assertIsolatedTarget();

jest.mock('../db', () => {
  const { Sequelize } = require('sequelize');
  if (process.env.EEARS_FEEDBACK_IT !== '1') {
    return { define() { return {}; }, authenticate() { return Promise.resolve(); }, close() { return Promise.resolve(); } };
  }
  return new Sequelize(
    process.env.EEARS_IT_DB_NAME,
    'root',
    '',
    {
      host: '127.0.0.1',
      port: 3316,
      dialect: 'mysql',
      logging: false,
    },
  );
});

const describeIt = ENABLED ? describe : describe.skip;

describeIt('student feedback mysql integration', () => {
  jest.setTimeout(20000);

  let sequelize;
  let Teacher;
  let StudentFeedback;
  let StudentFeedbackEvent;
  let updateStudentFeedbackCase;
  let listStudentFeedback;
  let listStudentFeedbackEvents;
  let teacherId;

  beforeAll(async () => {
    const { Sequelize } = require('sequelize');
    sequelize = require('../db');
    await sequelize.authenticate();
    ({ Teacher, StudentFeedback, StudentFeedbackEvent } = require('../models'));
    ({ updateStudentFeedbackCase, listStudentFeedback, listStudentFeedbackEvents } = require('../services/studentFeedbackService'));
    await Teacher.sync();
    const qi = sequelize.getQueryInterface();
    try {
      await require('../migrations/20261108150000-create-student-feedback').up(qi, Sequelize);
      await require('../migrations/20261110160000-student-feedback-cases').up(qi, Sequelize);
      await require('../migrations/20261112161000-student-feedback-events').up(qi, Sequelize);
      await require('../migrations/20261112173000-student-feedback-priority').up(qi, Sequelize);
    } catch (error) {
      const detail = error && (error.parent && error.parent.sqlMessage || error.sql || error.message);
      throw new Error(`migration failed: ${detail}`);
    }
    const teacher = await Teacher.create({
      name: '整合測試承辦',
      email: 'it-staff@example.test',
      username: 'it-staff',
      password: 'not-a-real-secret',
      role: 'office_staff',
      staffLevel: 'event_lead',
      isActive: true,
      isDemo: false,
    });
    teacherId = teacher.id;
  });

  afterAll(async () => {
    if (sequelize) await sequelize.close();
  });

  async function createCase(status = 'open') {
    return StudentFeedback.create({
      studentId: 'IT001',
      studentName: '整合測試',
      email: 'it-student@example.test',
      emailVerified: true,
      kind: 'problem',
      category: 'other',
      message: '這段內容不應出現在通知信。',
      emailStatus: 'sent',
      status,
      replyRequested: false,
    });
  }

  it('matches the expected event schema, foreign keys, and index', async () => {
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_feedback_events'
      ORDER BY ORDINAL_POSITION
    `);
    expect(columns.map((column) => [column.COLUMN_NAME, column.IS_NULLABLE])).toEqual([
      ['id', 'NO'],
      ['feedbackId', 'NO'],
      ['eventType', 'NO'],
      ['visibility', 'NO'],
      ['actorType', 'NO'],
      ['actorTeacherId', 'YES'],
      ['actorStudentId', 'YES'],
      ['beforeValue', 'NO'],
      ['afterValue', 'NO'],
      ['requestId', 'YES'],
      ['createdAt', 'NO'],
    ]);
    const [keys] = await sequelize.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'student_feedback_events'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY CONSTRAINT_NAME
    `);
    expect(keys).toEqual(expect.arrayContaining([
      expect.objectContaining({ CONSTRAINT_NAME: 'fk_student_feedback_events_case', COLUMN_NAME: 'feedbackId', REFERENCED_TABLE_NAME: 'student_feedback' }),
      expect.objectContaining({ CONSTRAINT_NAME: 'fk_student_feedback_events_teacher', COLUMN_NAME: 'actorTeacherId', REFERENCED_TABLE_NAME: 'teachers' }),
    ]));
    const [indexes] = await sequelize.query('SHOW INDEX FROM student_feedback_events');
    expect(indexes.some((index) => index.Key_name === 'idx_student_feedback_events_timeline')).toBe(true);
  });

  it('writes status and assignee events, skips an unchanged value, and rejects a bad foreign key', async () => {
    const row = await createCase();
    await updateStudentFeedbackCase({
      id: row.id,
      patch: { status: 'in_progress' },
      actor: { id: teacherId },
      requestId: 'it-status',
    });
    await updateStudentFeedbackCase({
      id: row.id,
      patch: { assignedTeacherId: teacherId },
      actor: { id: teacherId },
      requestId: 'it-assign',
    });
    const before = await StudentFeedbackEvent.count({ where: { feedbackId: row.id } });
    await updateStudentFeedbackCase({
      id: row.id,
      patch: { status: 'in_progress', assignedTeacherId: teacherId },
      actor: { id: teacherId },
    });
    const after = await StudentFeedbackEvent.count({ where: { feedbackId: row.id } });
    expect(after).toBe(before);

    const listed = await listStudentFeedbackEvents(row.id, { includeInternal: true });
    expect(listed.items.map((item) => item.eventType)).toEqual(['STATUS_CHANGED', 'ASSIGNEE_CHANGED']);
    expect(listed.items[0].beforeValue).toEqual({ status: 'open' });
    expect(listed.items[0].afterValue).toEqual({ status: 'in_progress' });
    expect(listed.items[1].beforeValue).toEqual({ assignedTeacherId: null });
    expect(listed.items[1].afterValue).toEqual({ assignedTeacherId: teacherId });
    expect(listed.items[0].actorTeacherId).toBe(teacherId);
    expect(listed.items[0].id).toBeLessThan(listed.items[1].id);

    await expect(StudentFeedbackEvent.create({
      feedbackId: 999999,
      eventType: 'STATUS_CHANGED',
      visibility: 'staff',
      actorType: 'staff',
      beforeValue: { status: 'open' },
      afterValue: { status: 'closed' },
      createdAt: new Date(),
    })).rejects.toThrow();
  });

  it('rolls back a failed update and a failed event insert', async () => {
    const row = await createCase();
    const transaction = await sequelize.transaction();
    try {
      await StudentFeedback.update({ status: 'closed' }, { where: { id: row.id }, transaction });
      throw new Error('forced update failure');
    } catch (error) {
      await transaction.rollback();
    }
    expect((await StudentFeedback.findByPk(row.id)).status).toBe('open');

    await expect(updateStudentFeedbackCase({
      id: row.id,
      patch: { status: 'in_progress' },
      actor: { id: 999999 },
    })).rejects.toThrow();
    expect((await StudentFeedback.findByPk(row.id)).status).toBe('open');
    expect(await StudentFeedbackEvent.count({ where: { feedbackId: row.id } })).toBe(0);
  });

  it('leaves priority null, writes only a real priority change, and serializes two updates', async () => {
    const [columns] = await sequelize.query(`
      SELECT IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_feedback' AND COLUMN_NAME = 'priority'
    `);
    expect(columns[0]).toEqual(expect.objectContaining({ IS_NULLABLE: 'YES', COLUMN_DEFAULT: null }));

    const created = await createCase();
    const row = await StudentFeedback.findByPk(created.id);
    expect(row.priority).toBeNull();
    const unset = await listStudentFeedback({ priority: 'unset', category: 'other' });
    expect(unset.items.some((item) => item.id === row.id && item.priority == null)).toBe(true);

    await updateStudentFeedbackCase({
      id: row.id,
      patch: { priority: 'P1' },
      actor: { id: teacherId },
    });
    const before = await StudentFeedbackEvent.count({ where: { feedbackId: row.id, eventType: 'PRIORITY_CHANGED' } });
    await updateStudentFeedbackCase({
      id: row.id,
      patch: { priority: 'P1' },
      actor: { id: teacherId },
    });
    expect(await StudentFeedbackEvent.count({
      where: { feedbackId: row.id, eventType: 'PRIORITY_CHANGED' },
    })).toBe(before);
    await expect(updateStudentFeedbackCase({
      id: row.id,
      patch: { priority: 'urgent' },
      actor: { id: teacherId },
    })).rejects.toThrow();
    expect((await StudentFeedback.findByPk(row.id)).priority).toBe('P1');

    const raced = await createCase();
    await Promise.all([
      updateStudentFeedbackCase({ id: raced.id, patch: { priority: 'P1' }, actor: { id: teacherId } }),
      updateStudentFeedbackCase({ id: raced.id, patch: { priority: 'P0' }, actor: { id: teacherId } }),
    ]);
    const saved = await StudentFeedback.findByPk(raced.id);
    const events = await StudentFeedbackEvent.findAll({
      where: { feedbackId: raced.id, eventType: 'PRIORITY_CHANGED' },
      order: [['id', 'ASC']],
    });
    expect(events.length).toBe(2);
    expect(saved.priority).toBe(events[1].afterValue.priority);
    expect(['P0', 'P1']).toContain(saved.priority);
  });

  it('lets a second FOR UPDATE see the committed status, not the stale one', async () => {
    const row = await createCase();
    const first = await sequelize.transaction();
    const second = await sequelize.transaction();
    try {
      await sequelize.query('SET innodb_lock_wait_timeout = 8', { transaction: second });
      await sequelize.query(
        'SELECT id, status FROM student_feedback WHERE id = ? FOR UPDATE',
        { replacements: [row.id], transaction: first },
      );
      let secondFinished = false;
      const waiting = sequelize.query(
        'SELECT id, status FROM student_feedback WHERE id = ? FOR UPDATE',
        { replacements: [row.id], transaction: second },
      ).then((result) => {
        secondFinished = true;
        return result;
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(secondFinished).toBe(false);
      await sequelize.query(
        'UPDATE student_feedback SET status = ? WHERE id = ?',
        { replacements: ['in_progress', row.id], transaction: first },
      );
      await first.commit();
      const [locked] = await waiting;
      expect(locked[0].status).toBe('in_progress');
      await second.rollback();
    } catch (error) {
      try { await first.rollback(); } catch { /* already finished */ }
      try { await second.rollback(); } catch { /* already finished */ }
      throw error;
    }
  });
});
