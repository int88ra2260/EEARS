import React from 'react';
import { Link } from 'react-router-dom';
import {
  buildSkillMap,
  EMPTY,
  formatDate,
  getAttemptSkillText,
  SKILL_KEYS,
  text,
} from '../../../utils/learningJourneyHubFormatters';
import { EmptyState, KpiCard } from './HubUi';

export default function ProfileSummary({ profile, studentInput, semesterInput }) {
  const student = profile?.student || {};
  const flags = student.aggregateFlags || {};
  const attempts = Array.isArray(profile?.examAttempts) ? profile.examAttempts : [];
  const ljsAttempts = Array.isArray(student?.ljsExamAttempts) ? student.ljsExamAttempts : [];
  const activities = Array.isArray(profile?.activities) ? profile.activities : [];
  const courses = Array.isArray(profile?.courses) ? profile.courses : [];
  const timeline = Array.isArray(profile?.timeline) ? profile.timeline : [];
  const dataQuality = Array.isArray(profile?.dataQuality) ? profile.dataQuality : [];
  const studentId = student.studentId || studentInput;
  const hasNoData = dataQuality.some((q) => q?.code === 'NO_STUDENT_AGGREGATE');
  const bestSkillsBySemester = profile?.bestSkills || {};
  const selectedBestSkills = Array.isArray(bestSkillsBySemester?.[semesterInput])
    ? bestSkillsBySemester[semesterInput]
    : Object.values(bestSkillsBySemester).find((rows) => Array.isArray(rows) && rows.length > 0) || [];
  const allAttempts = [
    ...attempts.map((row) => ({ ...row, displaySource: row.source || '英檢紀錄' })),
    ...ljsAttempts.map((row) => ({ ...row, displaySource: row.sourceType || row.source || '學習歷程紀錄' })),
  ];

  if (hasNoData) {
    return <EmptyState>查無此學生於該學期的學習歷程資料。</EmptyState>;
  }

  return (
    <div className="row g-3">
      <div className="col-12">
        <div className="card">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between gap-2">
              <div>
                <div className="text-muted small">學生</div>
                <div className="h5 mb-0">
                  {studentId || EMPTY}
                  {student.etStudentMaster?.name ? `　${student.etStudentMaster.name}` : ''}
                </div>
              </div>
              {studentId ? (
                <Link className="btn btn-outline-primary btn-sm align-self-start" to={`/admin/learning-journey/students/${encodeURIComponent(studentId)}?semesterId=${encodeURIComponent(semesterInput || '')}`}>
                  開啟完整學生頁
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <KpiCard label="英檢與 BESTEP 紀錄" value={`${allAttempts.length + Number(flags.bestepScoresCount || 0)} 筆`} />
      <KpiCard label="活動參與" value={`${activities.length} 筆`} />
      <KpiCard label="修課紀錄" value={`${courses.length} 筆`} />
      <KpiCard label="風險提示" value={dataQuality.length ? `${dataQuality.length} 則` : '無'} />

      <div className="col-12">
        <div className="card">
          <div className="card-header py-2 fw-semibold">Best Skills</div>
          <div className="card-body small">
            {selectedBestSkills.length === 0 ? (
              <div className="text-muted">尚無此學生的四技最佳成績彙整。</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>學期</th>
                      <th>聽力</th>
                      <th>閱讀</th>
                      <th>口說</th>
                      <th>寫作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBestSkills.map((row, idx) => (
                      <tr key={row.id || `${row.semesterId}-${idx}`}>
                        <td>{text(row.semesterId || semesterInput)}</td>
                        <td>{text(row.bestListeningCefr)}</td>
                        <td>{text(row.bestReadingCefr)}</td>
                        <td>{text(row.bestSpeakingCefr)}</td>
                        <td>{text(row.bestWritingCefr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-header py-2 fw-semibold">Attempts 與 CEFR 明細</div>
          <div className="card-body small">
            {allAttempts.length === 0 ? (
              <div className="text-muted">尚無英檢或 BESTEP attempts 明細。</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>日期</th>
                      <th>類型</th>
                      <th>聽力 raw / CEFR</th>
                      <th>閱讀 raw / CEFR</th>
                      <th>口說 raw / CEFR</th>
                      <th>寫作 raw / CEFR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAttempts.slice(0, 20).map((attempt, idx) => {
                      const scoreMap = buildSkillMap(attempt.skillScores || attempt.scores || []);
                      return (
                        <tr key={attempt.id || `${attempt.examDate || attempt.testDate}-${idx}`}>
                          <td>{text(attempt.examDate || attempt.testDate || attempt.date)}</td>
                          <td>{text(attempt.examType || attempt.testType || attempt.sourceType || attempt.displaySource)}</td>
                          {SKILL_KEYS.map((skill) => (
                            <td key={skill}>{getAttemptSkillText(scoreMap[skill])}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="card h-100">
          <div className="card-header py-2 fw-semibold">活動參與與風險狀態</div>
          <div className="card-body small">
            {activities.length === 0 ? <div className="text-muted">尚無活動參與或 BESTEP 出席紀錄。</div> : (
              <ul className="mb-0 ps-3">
                {activities.slice(0, 8).map((row, idx) => (
                  <li key={idx}>
                    {row.kind === 'reservation'
                      ? `預約：${row.event?.eventType || row.event?.name || '活動'} - ${row.reservation?.checkinStatus || EMPTY}`
                      : `${row.participation?.activityType || '活動'} - ${row.participation?.attendanceStatus || EMPTY}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="card h-100">
          <div className="card-header py-2 fw-semibold">資料摘要</div>
          <div className="card-body small">
            <div className="row g-2">
              <div className="col-6"><span className="text-muted">BESTEP 成績</span><div>{Number(flags.bestepScoresCount || 0)} 筆</div></div>
              <div className="col-6"><span className="text-muted">BESTEP 出席</span><div>{Number(flags.bestepAttendanceCount || 0)} 筆</div></div>
              <div className="col-6"><span className="text-muted">培力報名</span><div>{flags.hasExamRegistrations ? '有資料' : '尚無資料'}</div></div>
              <div className="col-6"><span className="text-muted">達標彙整</span><div>{flags.hasBestSkills ? '有資料' : '尚無資料'}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-header py-2 fw-semibold">近期歷程</div>
          <div className="card-body p-0">
            {timeline.length === 0 ? <div className="p-3 text-muted small">尚無歷程事件。</div> : (
              <div className="table-responsive">
                <table className="table table-sm table-striped mb-0 align-middle">
                  <thead className="table-light">
                    <tr><th>日期</th><th>類型</th><th>標題</th><th>狀態</th><th>來源</th></tr>
                  </thead>
                  <tbody>
                    {timeline.slice(0, 40).map((event) => (
                      <tr key={event.id || `${event.type}-${event.date}-${event.title}`}>
                        <td>{formatDate(event.date)}</td>
                        <td>{text(event.type)}</td>
                        <td>{text(event.title)}</td>
                        <td>{text(event.status)}</td>
                        <td>{text(event.source)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
