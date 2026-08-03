const { Op } = require('sequelize');
const { Event, Reservation, Semester, SurveyModuleResponse, SurveyVersion } = require('../models');
const { isValidSemester } = require('../utils/semester');

const SEMESTER_CODE_IN_TEXT_RE = /\b(1\d{2}-\d)\b/;

function parseEventDate(event) {
  if (event.date) {
    const d = new Date(event.date);
    if (Number.isFinite(d.getTime())) return d;
  }
  if (event.startTime) {
    const d = new Date(event.startTime);
    if (Number.isFinite(d.getTime())) return d;
  }
  return null;
}

async function resolveSemesterByCode(code) {
  if (!code || !isValidSemester(code)) return null;
  const row = await Semester.findOne({ where: { code: String(code).trim() } });
  return row?.id || null;
}

function inferSemesterCodeFromEvent(event) {
  const m = String(event?.name || '').match(SEMESTER_CODE_IN_TEXT_RE);
  return m ? m[1] : null;
}

async function resolveSemesterByDate(date) {
  if (!date) return { semesterId: null, reason: 'no_date', ambiguous: false };
  const rows = await Semester.findAll({
    where: {
      startDate: { [Op.lte]: date },
      endDate: { [Op.gte]: date },
    },
    order: [['startDate', 'ASC']],
  });
  if (!rows.length) return { semesterId: null, reason: 'out_of_range', ambiguous: false };
  if (rows.length > 1) return { semesterId: null, reason: 'ambiguous', ambiguous: true };
  return { semesterId: rows[0].id, reason: 'by_date', ambiguous: false };
}

async function backfillEventSemesters({ dryRun = true } = {}) {
  const events = await Event.findAll();
  let alreadyLinked = 0;
  let backfilledByDate = 0;
  let backfilledByCode = 0;
  let unresolved = 0;
  let ambiguous = 0;
  const unresolvedIds = [];

  for (const ev of events) {
    if (ev.semesterId) {
      alreadyLinked += 1;
      continue;
    }
    const codeFromName = inferSemesterCodeFromEvent(ev);
    const byCode = codeFromName ? await resolveSemesterByCode(codeFromName) : null;
    if (byCode) {
      backfilledByCode += 1;
      if (!dryRun) await ev.update({ semesterId: byCode });
      continue;
    }
    const d = parseEventDate(ev);
    const resolved = await resolveSemesterByDate(d);
    if (resolved.semesterId) {
      backfilledByDate += 1;
      if (!dryRun) {
        await ev.update({ semesterId: resolved.semesterId });
      }
    } else if (resolved.ambiguous) {
      ambiguous += 1;
      unresolvedIds.push(ev.id);
    } else {
      unresolved += 1;
      unresolvedIds.push(ev.id);
    }
  }

  return {
    dryRun,
    totalEvents: events.length,
    alreadyLinked,
    backfilledByDate,
    backfilledByCode,
    unresolved,
    ambiguous,
    unresolvedEventIds: unresolvedIds.slice(0, 200),
  };
}

async function inferVersionFromSubmittedAt(response) {
  if (!response.surveyId || !response.submittedAt) return { versionId: null, source: 'none' };
  const candidates = await SurveyVersion.findAll({
    where: { surveyId: response.surveyId },
    order: [['versionNumber', 'ASC']],
  });
  const t = new Date(response.submittedAt).getTime();
  const publishedBefore = candidates.filter((v) => v.publishedAt && new Date(v.publishedAt).getTime() <= t);
  if (publishedBefore.length) {
    return { versionId: publishedBefore[publishedBefore.length - 1].id, source: 'by_submitted_at_published' };
  }
  const firstPublished = candidates.find((v) => v.isPublished || v.status === 'published');
  if (firstPublished) return { versionId: firstPublished.id, source: 'fallback_first_published' };
  return { versionId: null, source: 'none' };
}

async function backfillResponseLinks({ dryRun = true } = {}) {
  const responses = await SurveyModuleResponse.findAll();
  const stats = {
    dryRun,
    totalResponses: responses.length,
    semesterByEvent: 0,
    semesterByReservation: 0,
    semesterBySemesterCode: 0,
    semesterBySubmittedAt: 0,
    unresolvedSemester: 0,
    validatedVersion: 0,
    versionBySubmittedAt: 0,
    unresolvedVersion: 0,
    unresolvedResponseIds: [],
  };

  for (const r of responses) {
    let nextSemesterId = r.semesterId || null;
    let semesterSource = 'existing';

    if (!nextSemesterId && r.eventId) {
      const ev = await Event.findByPk(r.eventId);
      if (ev?.semesterId) {
        nextSemesterId = ev.semesterId;
        semesterSource = 'by_event';
        stats.semesterByEvent += 1;
      }
    }

    if (!nextSemesterId && r.reservationId) {
      const rs = await Reservation.findByPk(r.reservationId);
      if (rs?.eventId) {
        const ev = await Event.findByPk(rs.eventId);
        if (ev?.semesterId) {
          nextSemesterId = ev.semesterId;
          semesterSource = 'by_reservation_event';
          stats.semesterByReservation += 1;
        }
      }
    }

    if (!nextSemesterId && r.semester && isValidSemester(r.semester)) {
      const byCode = await resolveSemesterByCode(r.semester);
      if (byCode) {
        nextSemesterId = byCode;
        semesterSource = 'by_semester_code';
        stats.semesterBySemesterCode += 1;
      }
    }

    if (!nextSemesterId && r.semesterKey && isValidSemester(r.semesterKey)) {
      const byCode = await resolveSemesterByCode(r.semesterKey);
      if (byCode) {
        nextSemesterId = byCode;
        semesterSource = 'by_semester_key';
        stats.semesterBySemesterCode += 1;
      }
    }

    if (!nextSemesterId && r.submittedAt) {
      const resolved = await resolveSemesterByDate(new Date(r.submittedAt));
      if (resolved.semesterId) {
        nextSemesterId = resolved.semesterId;
        semesterSource = 'by_submitted_at';
        stats.semesterBySubmittedAt += 1;
      }
    }

    if (!nextSemesterId) {
      stats.unresolvedSemester += 1;
      stats.unresolvedResponseIds.push(r.id);
    }

    let nextVersionId = r.surveyVersionId || null;
    let versionSource = 'existing';
    if (nextVersionId) {
      const v = await SurveyVersion.findByPk(nextVersionId);
      if (v) stats.validatedVersion += 1;
      else nextVersionId = null;
    }
    if (!nextVersionId) {
      const inferred = await inferVersionFromSubmittedAt(r);
      if (inferred.versionId) {
        nextVersionId = inferred.versionId;
        versionSource = inferred.source;
        stats.versionBySubmittedAt += 1;
      } else {
        stats.unresolvedVersion += 1;
      }
    }

    if (!dryRun) {
      await r.update({
        semesterId: nextSemesterId,
        surveyVersionId: nextVersionId,
        metadataJson: {
          ...(r.metadataJson || {}),
          sourceOfSemesterInference: semesterSource,
          sourceOfVersionInference: versionSource,
        },
      });
    }
  }
  return stats;
}

module.exports = {
  backfillEventSemesters,
  backfillResponseLinks,
};
