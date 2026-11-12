-- EEARS student feedback production schema check
-- READ ONLY. SELECT, SHOW CREATE TABLE, and INFORMATION_SCHEMA only.
-- Do not add INSERT, UPDATE, DELETE, DDL, GRANT, or SequelizeMeta writes.
--
-- This file does not prove the production database state.
-- Run it only on the production server, by a person authorized to read that database.
-- The development laptop is LAPTOP-IVA4HK36 and also has a D:\EEARS tree.
-- If @@hostname is LAPTOP-IVA4HK36, stop. That result is not production evidence.
--
-- Do not select rows from student_feedback, student_feedback_messages,
-- student_feedback_events, or teachers. Column names in this script are schema.
--
-- If section 2 does not show SequelizeMeta, stop before section 4.
-- If section 2 shows a feedback table is ABSENT, skip its SHOW CREATE TABLE.
-- Do not create the missing table. Do not run db:migrate from this result.

-- ---------------------------------------------------------------------------
-- 1. Where this session is connected. Do not print accounts or passwords.
-- ---------------------------------------------------------------------------

SELECT
  'READ_ONLY_CHECK' AS script,
  @@hostname AS server_hostname,
  @@port AS server_port,
  DATABASE() AS current_database,
  @@version AS mysql_version;

-- ---------------------------------------------------------------------------
-- 2. Tables required by the models. Missing SequelizeMeta is UNKNOWN, not a
--    reason to create it.
-- ---------------------------------------------------------------------------

SELECT
  expected.table_name,
  CASE WHEN actual.TABLE_NAME IS NULL THEN 'ABSENT' ELSE 'PRESENT' END AS result
FROM (
  SELECT 'SequelizeMeta' AS table_name
  UNION ALL SELECT 'teachers'
  UNION ALL SELECT 'student_feedback'
  UNION ALL SELECT 'student_feedback_messages'
  UNION ALL SELECT 'student_feedback_events'
) expected
LEFT JOIN information_schema.TABLES actual
  ON actual.TABLE_SCHEMA = DATABASE()
 AND actual.TABLE_NAME = expected.table_name
ORDER BY expected.table_name;

-- Approximate InnoDB counts only. Not exact, and not row contents.
SELECT TABLE_NAME, TABLE_ROWS AS approximate_rows, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'teachers',
    'student_feedback',
    'student_feedback_messages',
    'student_feedback_events'
  )
ORDER BY TABLE_NAME;

-- ---------------------------------------------------------------------------
-- 3. Stop here when SequelizeMeta is ABSENT.
--    Section 4 reads that table. It does not create or update it.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 4. Full migration ledger. Compare this list with both:
--    a. D:\EEARS\reservation-backend\migrations\*.js on THIS server
--    b. the PR Head file list in ISSUE_REPORTING_PRODUCTION_SCHEMA_HANDOFF.md
--    Any server filename missing here is pending for db:migrate.
--    Pending files are not limited to student feedback.
-- ---------------------------------------------------------------------------

SELECT name
FROM SequelizeMeta
ORDER BY name;

SELECT
  expected.name AS migration_file,
  CASE WHEN meta.name IS NULL THEN 'ABSENT_FROM_SEQUELIZE_META' ELSE 'RECORDED' END AS meta_status
FROM (
  SELECT '20261108150000-create-student-feedback.js' AS name
  UNION ALL SELECT '20261108150100-grant-student-feedback-permission.js'
  UNION ALL SELECT '20261110123000-create-leader-public-profiles.js'
  UNION ALL SELECT '20261110131500-repair-campus-private-use-qi.js'
  UNION ALL SELECT '20261110143000-repair-more-campus-private-use-names.js'
  UNION ALL SELECT '20261110160000-drop-cancellation-code-from-email-overrides.js'
  UNION ALL SELECT '20261110160000-student-feedback-cases.js'
  UNION ALL SELECT '20261110160100-grant-student-feedback-manage-permission.js'
  UNION ALL SELECT '20261112161000-student-feedback-events.js'
  UNION ALL SELECT '20261112173000-student-feedback-priority.js'
) expected
LEFT JOIN SequelizeMeta meta ON meta.name = expected.name
ORDER BY expected.name;

-- ---------------------------------------------------------------------------
-- 5. Column metadata. Names only; no student, teacher, or message values.
--    expected_note is the model contract. actual_* empty means the column
--    is absent. Do not treat PRESENT as production PASS.
-- ---------------------------------------------------------------------------

SELECT
  expected.table_name,
  expected.column_name,
  expected.expected_note,
  actual.COLUMN_TYPE AS actual_column_type,
  actual.IS_NULLABLE AS actual_is_nullable,
  actual.COLUMN_DEFAULT AS actual_column_default,
  actual.COLUMN_KEY AS actual_column_key,
  actual.EXTRA AS actual_extra,
  CASE WHEN actual.COLUMN_NAME IS NULL THEN 'ABSENT' ELSE 'PRESENT' END AS result
FROM (
  SELECT 'student_feedback' AS table_name, 'id' AS column_name, 'int NOT NULL PK auto_increment' AS expected_note
  UNION ALL SELECT 'student_feedback', 'studentId', 'varchar(20) NOT NULL'
  UNION ALL SELECT 'student_feedback', 'studentName', 'varchar(100) NOT NULL'
  UNION ALL SELECT 'student_feedback', 'email', 'varchar(100) NOT NULL'
  UNION ALL SELECT 'student_feedback', 'emailVerified', 'tinyint(1) NOT NULL default 0'
  UNION ALL SELECT 'student_feedback', 'kind', 'varchar(20) NOT NULL'
  UNION ALL SELECT 'student_feedback', 'category', 'varchar(32) NOT NULL'
  UNION ALL SELECT 'student_feedback', 'message', 'text NOT NULL'
  UNION ALL SELECT 'student_feedback', 'emailStatus', 'varchar(20) NOT NULL default pending'
  UNION ALL SELECT 'student_feedback', 'createdAt', 'datetime NOT NULL'
  UNION ALL SELECT 'student_feedback', 'updatedAt', 'datetime NOT NULL'
  UNION ALL SELECT 'student_feedback', 'status', 'varchar(20) NOT NULL default open'
  UNION ALL SELECT 'student_feedback', 'replyRequested', 'tinyint(1) NOT NULL default 1'
  UNION ALL SELECT 'student_feedback', 'assignedTeacherId', 'int NULL'
  UNION ALL SELECT 'student_feedback', 'closedAt', 'datetime NULL'
  UNION ALL SELECT 'student_feedback', 'priority', 'varchar(8) NULL no default'
  UNION ALL SELECT 'student_feedback_messages', 'id', 'int NOT NULL PK auto_increment'
  UNION ALL SELECT 'student_feedback_messages', 'feedbackId', 'int NOT NULL'
  UNION ALL SELECT 'student_feedback_messages', 'authorType', 'varchar(20) NOT NULL'
  UNION ALL SELECT 'student_feedback_messages', 'visibility', 'varchar(20) NOT NULL'
  UNION ALL SELECT 'student_feedback_messages', 'body', 'text NOT NULL'
  UNION ALL SELECT 'student_feedback_messages', 'teacherId', 'int NULL'
  UNION ALL SELECT 'student_feedback_messages', 'studentId', 'varchar(20) NULL'
  UNION ALL SELECT 'student_feedback_messages', 'emailStatus', 'varchar(20) NULL'
  UNION ALL SELECT 'student_feedback_messages', 'createdAt', 'datetime NOT NULL'
  UNION ALL SELECT 'student_feedback_messages', 'updatedAt', 'datetime NOT NULL'
  UNION ALL SELECT 'student_feedback_events', 'id', 'int NOT NULL PK auto_increment'
  UNION ALL SELECT 'student_feedback_events', 'feedbackId', 'int NOT NULL'
  UNION ALL SELECT 'student_feedback_events', 'eventType', 'varchar(32) NOT NULL'
  UNION ALL SELECT 'student_feedback_events', 'visibility', 'varchar(20) NOT NULL default staff'
  UNION ALL SELECT 'student_feedback_events', 'actorType', 'varchar(20) NOT NULL'
  UNION ALL SELECT 'student_feedback_events', 'actorTeacherId', 'int NULL'
  UNION ALL SELECT 'student_feedback_events', 'actorStudentId', 'varchar(20) NULL'
  UNION ALL SELECT 'student_feedback_events', 'beforeValue', 'json NOT NULL'
  UNION ALL SELECT 'student_feedback_events', 'afterValue', 'json NOT NULL'
  UNION ALL SELECT 'student_feedback_events', 'requestId', 'varchar(64) NULL'
  UNION ALL SELECT 'student_feedback_events', 'createdAt', 'datetime NOT NULL'
  UNION ALL SELECT 'teachers', 'id', 'signed int NOT NULL PK auto_increment'
) expected
LEFT JOIN information_schema.COLUMNS actual
  ON actual.TABLE_SCHEMA = DATABASE()
 AND actual.TABLE_NAME = expected.table_name
 AND actual.COLUMN_NAME = expected.column_name
ORDER BY expected.table_name, expected.column_name;

-- Unexpected columns on the feedback tables. teachers is limited to id above.
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'student_feedback',
    'student_feedback_messages',
    'student_feedback_events'
  )
  AND COLUMN_NAME NOT IN (
    'id', 'studentId', 'studentName', 'email', 'emailVerified', 'kind', 'category',
    'message', 'emailStatus', 'createdAt', 'updatedAt', 'status', 'replyRequested',
    'assignedTeacherId', 'closedAt', 'priority', 'feedbackId', 'authorType',
    'visibility', 'body', 'teacherId', 'eventType', 'actorType', 'actorTeacherId',
    'actorStudentId', 'beforeValue', 'afterValue', 'requestId'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- ---------------------------------------------------------------------------
-- 6. Primary keys, indexes, and foreign keys.
-- ---------------------------------------------------------------------------

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'student_feedback',
    'student_feedback_messages',
    'student_feedback_events'
  )
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

SELECT
  expected.table_name,
  expected.index_name,
  CASE WHEN actual.INDEX_NAME IS NULL THEN 'ABSENT' ELSE 'PRESENT' END AS result
FROM (
  SELECT 'student_feedback' AS table_name, 'PRIMARY' AS index_name
  UNION ALL SELECT 'student_feedback', 'idx_student_feedback_student_created'
  UNION ALL SELECT 'student_feedback', 'idx_student_feedback_created'
  UNION ALL SELECT 'student_feedback', 'idx_student_feedback_kind_created'
  UNION ALL SELECT 'student_feedback', 'idx_student_feedback_status_created'
  UNION ALL SELECT 'student_feedback', 'idx_student_feedback_assignee'
  UNION ALL SELECT 'student_feedback', 'idx_student_feedback_priority'
  UNION ALL SELECT 'student_feedback_messages', 'PRIMARY'
  UNION ALL SELECT 'student_feedback_messages', 'idx_student_feedback_messages_case'
  UNION ALL SELECT 'student_feedback_messages', 'idx_student_feedback_messages_student'
  UNION ALL SELECT 'student_feedback_events', 'PRIMARY'
  UNION ALL SELECT 'student_feedback_events', 'idx_student_feedback_events_timeline'
) expected
LEFT JOIN (
  SELECT DISTINCT TABLE_NAME, INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
) actual
  ON actual.TABLE_NAME = expected.table_name
 AND actual.INDEX_NAME = expected.index_name
ORDER BY expected.table_name, expected.index_name;

SELECT
  kcu.TABLE_NAME,
  kcu.CONSTRAINT_NAME,
  kcu.COLUMN_NAME,
  kcu.REFERENCED_TABLE_NAME,
  kcu.REFERENCED_COLUMN_NAME,
  rc.UPDATE_RULE,
  rc.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE kcu
JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
  ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
 AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
 AND rc.TABLE_NAME = kcu.TABLE_NAME
WHERE kcu.TABLE_SCHEMA = DATABASE()
  AND kcu.TABLE_NAME IN (
    'student_feedback',
    'student_feedback_messages',
    'student_feedback_events'
  )
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION;

SELECT
  expected.constraint_name,
  expected.expected_note,
  actual.UPDATE_RULE,
  actual.DELETE_RULE,
  CASE WHEN actual.CONSTRAINT_NAME IS NULL THEN 'ABSENT' ELSE 'PRESENT' END AS result
FROM (
  SELECT 'fk_student_feedback_assignee' AS constraint_name,
         'student_feedback.assignedTeacherId -> teachers.id ON UPDATE CASCADE ON DELETE SET NULL' AS expected_note
  UNION ALL SELECT 'fk_student_feedback_messages_case',
         'student_feedback_messages.feedbackId -> student_feedback.id ON UPDATE CASCADE ON DELETE CASCADE'
  UNION ALL SELECT 'fk_student_feedback_messages_teacher',
         'student_feedback_messages.teacherId -> teachers.id ON UPDATE CASCADE ON DELETE SET NULL'
  UNION ALL SELECT 'fk_student_feedback_events_case',
         'student_feedback_events.feedbackId -> student_feedback.id ON UPDATE CASCADE ON DELETE CASCADE'
  UNION ALL SELECT 'fk_student_feedback_events_teacher',
         'student_feedback_events.actorTeacherId -> teachers.id ON UPDATE CASCADE ON DELETE SET NULL'
) expected
LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS actual
  ON actual.CONSTRAINT_SCHEMA = DATABASE()
 AND actual.CONSTRAINT_NAME = expected.constraint_name
ORDER BY expected.constraint_name;

-- ---------------------------------------------------------------------------
-- 7. SHOW CREATE TABLE. Skip a statement when section 2 says that table is
--    ABSENT. These statements show column definitions, not stored rows.
-- ---------------------------------------------------------------------------

SHOW CREATE TABLE student_feedback;
SHOW CREATE TABLE student_feedback_messages;
SHOW CREATE TABLE student_feedback_events;
SHOW CREATE TABLE teachers;
