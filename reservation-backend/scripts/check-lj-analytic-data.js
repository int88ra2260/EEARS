'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sequelize = require('../db');

async function main() {
  try {
    await sequelize.authenticate();

    const ljTables = [
      'lj_student_events',
      'lj_analytic_students',
      'lj_analytic_exams',
      'analytics_model_runs',
      'learning_growth_episodes',
      'resource_effect_estimates',
      'student_resource_exposures',
    ];

    const counts = {};
    const missing = [];

    for (const table of ljTables) {
      try {
        const [[row]] = await sequelize.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
        counts[table] = Number(row.c);
      } catch (err) {
        missing.push({ table, error: err.message });
      }
    }

    let snapshots = [];
    try {
      const [rows] = await sequelize.query(
        'SELECT snapshot_version, COUNT(*) AS student_count FROM lj_analytic_students GROUP BY snapshot_version ORDER BY student_count DESC LIMIT 5'
      );
      snapshots = rows;
    } catch (err) {
      snapshots = [{ error: err.message }];
    }

    let sourceCounts = {};
    try {
      const [rows] = await sequelize.query(
        "SELECT event_type, COUNT(*) AS c FROM lj_student_events GROUP BY event_type ORDER BY c DESC"
      );
      sourceCounts = Object.fromEntries(rows.map((r) => [r.event_type, Number(r.c)]));
    } catch (err) {
      sourceCounts = { error: err.message };
    }

    let canonicalCounts = {};
    try {
      const [[students]] = await sequelize.query('SELECT COUNT(*) AS c FROM students');
      const [[exams]] = await sequelize.query('SELECT COUNT(*) AS c FROM exam_attempts');
      const [[activities]] = await sequelize.query('SELECT COUNT(*) AS c FROM activity_participations');
      canonicalCounts = {
        students: Number(students.c),
        exam_attempts: Number(exams.c),
        activity_participations: Number(activities.c),
      };
    } catch (err) {
      canonicalCounts = { error: err.message };
    }

    console.log(JSON.stringify({
      ok: true,
      database: process.env.DB_NAME || 'activity_reservation',
      counts,
      missingTables: missing,
      snapshotVersions: snapshots,
      ljStudentEventsByType: sourceCounts,
      canonicalSource: canonicalCounts,
      hasAnalyticData: (counts.lj_analytic_students || 0) > 0,
    }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
