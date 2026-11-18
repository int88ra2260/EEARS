const {
  Student,
  StudentSemesterProfile,
  ExamAttempt
} = require('../../models');
const profileService = require('./learningJourneyProfileService');
const { normalizeStudentId } = require('./utils/studentNormalization');

const B2_RANK = 4;

function computeAttained(snapshot = {}) {
  return Object.values(snapshot || {}).some((row) => row && Number(row.cefrRank || 0) >= B2_RANK);
}

async function rebuildStudentSemesterProfile(studentPk, semesterId) {
  const student = await Student.findByPk(studentPk);
  if (!student || !semesterId) {
    return null;
  }

  const profileData = await profileService.getStudentProfile(student.studentId, { semesterId });
  if (!profileData) {
    return null;
  }

  const [profile] = await StudentSemesterProfile.findOrCreate({
    where: { studentPk: student.id, semesterId },
    defaults: {
      studentPk: student.id,
      studentId: student.studentId,
      semesterId
    }
  });

  profile.studentId = student.studentId;
  profile.attemptCount = profileData.attemptCount || 0;
  profile.bestSnapshotJson = profileData.bestScores || null;
  profile.latestSnapshotJson = profileData.latestScores || null;
  profile.bestAttained = computeAttained(profileData.bestScores);
  profile.latestAttained = computeAttained(profileData.latestScores);
  profile.dataQualityFlag = profileData.warnings && profileData.warnings.length ? 'missing_scores' : 'ok';
  await profile.save();

  return profile;
}

let rebuildChain = Promise.resolve();

function enqueueProfileRebuild(task) {
  const run = rebuildChain.then(() => task());
  rebuildChain = run.then(() => undefined, () => undefined);
  return run;
}

async function rebuildAffectedProfilesNow(attemptId) {
  const attempt = await ExamAttempt.findByPk(attemptId);
  if (!attempt) return [];

  const rebuildTargets = [];
  if (attempt.studentPk && attempt.semesterId) {
    rebuildTargets.push({ studentPk: attempt.studentPk, semesterId: attempt.semesterId });
  }

  const results = [];
  for (const target of rebuildTargets) {
    const rebuilt = await rebuildStudentSemesterProfile(target.studentPk, target.semesterId);
    if (rebuilt) results.push(rebuilt);
  }
  return results;
}

function rebuildAllAffectedProfilesFromAttempt(attemptId) {
  const job = enqueueProfileRebuild(() => rebuildAffectedProfilesNow(attemptId));
  job.catch(() => {
    console.error('[lj-profile-rebuild] 背景重建未完成');
  });
  return { queued: true, attemptId: Number(attemptId) || null };
}

async function rebuildSemesterProfilesNow(semesterId) {
  const attempts = await ExamAttempt.findAll({
    where: { semesterId },
    attributes: ['studentPk', 'studentId', 'semesterId'],
    group: ['studentPk', 'studentId', 'semesterId'],
    raw: true
  });

  const rebuilt = [];
  for (const attempt of attempts) {
    const normalizedId = normalizeStudentId(attempt.studentId);
    if (!attempt.studentPk || !normalizedId) continue;
    const profile = await rebuildStudentSemesterProfile(attempt.studentPk, semesterId);
    if (profile) {
      rebuilt.push(profile);
    }
  }
  return {
    semesterId,
    processed: attempts.length,
    rebuilt: rebuilt.length
  };
}

function rebuildSemesterProfilesBySemester(semesterId) {
  return enqueueProfileRebuild(() => rebuildSemesterProfilesNow(semesterId));
}

module.exports = {
  rebuildStudentSemesterProfile,
  rebuildSemesterProfilesBySemester,
  rebuildAllAffectedProfilesFromAttempt,
  enqueueProfileRebuild
};
