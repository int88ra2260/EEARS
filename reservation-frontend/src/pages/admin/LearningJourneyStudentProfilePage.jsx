import React, { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import {
  getLearningJourneyV3StudentProfile,
  getLearningJourneyV3StudentTrends
} from '../../services/learningJourneyV3Api';
import StudentProfileHeader from '../../components/learningJourneyV3/student/StudentProfileHeader';
import BestSkillCards from '../../components/learningJourneyV3/student/BestSkillCards';
import ExamTimeline from '../../components/learningJourneyV3/student/ExamTimeline';
import ActivityParticipationSummary from '../../components/learningJourneyV3/student/ActivityParticipationSummary';
import CourseRecordsTable from '../../components/learningJourneyV3/student/CourseRecordsTable';
import BestepRecordsTable from '../../components/learningJourneyV3/student/BestepRecordsTable';
import DataQualityBanner from '../../components/learningJourneyV3/student/DataQualityBanner';
import CefrTrendChart from '../../components/learningJourneyV3/student/CefrTrendChart';
import ActivityVsSkillPanel from '../../components/learningJourneyV3/student/ActivityVsSkillPanel';
import LearningJourneyTimeline from '../../components/learningJourneyTimeline/LearningJourneyTimeline';
import LearningJourneyExportPanel from '../../components/learningJourneyTimeline/LearningJourneyExportPanel';
import EtStudentParticipationPanel from '../../components/etGrouping/EtStudentParticipationPanel';
import useLearningJourneyTimeline from '../../hooks/useLearningJourneyTimeline';
import { P } from '../../constants/permissions';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { getSourceBadge } from '../../components/learningJourneyV3/student/emptyStateUtils';

function SectionWarning({ message }) {
  if (!message) return null;
  return (
    <div className="bg-warning-subtle border border-warning-subtle text-warning-emphasis rounded px-3 py-2 small mb-3">
      {message}
    </div>
  );
}

function SourceBadge({ sourceMeta }) {
  const badge = getSourceBadge(sourceMeta);
  const title = sourceMeta?.fallbackUsed && sourceMeta?.fallbackSource
    ? `source: ${sourceMeta.source}; fallback: ${sourceMeta.fallbackSource}`
    : `source: ${sourceMeta?.source || 'unknown'}`;
  return (
    <span className={`badge ${badge.className}`} title={title}>
      {badge.label}
    </span>
  );
}

function ProfileSection({ title, sourceMeta, children }) {
  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold d-flex justify-content-between align-items-center gap-2">
        <span>{title}</span>
        <SourceBadge sourceMeta={sourceMeta} />
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function normalizeActivityData(data) {
  const activityStats = data?.activityStats || {};
  const activitySummary = data?.activitySummary || {};
  const activityRecords = [
    data?.activityAbilityMapping,
    data?.activityRecords,
    activitySummary.records
  ].find((rows) => Array.isArray(rows) && rows.length > 0) || [];
  return {
    activityStats,
    activitySummary: {
      ...activitySummary,
      byType: Array.isArray(activitySummary.byType) ? activitySummary.byType : [],
      records: activityRecords
    },
    activityRecords
  };
}

function getFriendlyLoadError(err) {
  const message = err?.message || '';
  if (Number(err?.status) === 400 && /teacher|semesterId|學期/.test(message)) {
    return '請先選擇學期後再查詢學生學習歷程。';
  }
  return message || '資料載入失敗';
}

export default function LearningJourneyStudentProfilePage() {
  const { setAdminPageMeta } = useOutletContext() || {};
  const token = localStorage.getItem('token') || '';
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const semesterId = (searchParams.get('semesterId') || searchParams.get('semester') || '').trim();
  const returnToRaw = searchParams.get('returnTo') || '';
  const returnSearch = new URLSearchParams(searchParams);
  returnSearch.delete('returnTo');
  if (!returnSearch.get('semester') && semesterId) returnSearch.set('semester', semesterId);
  returnSearch.delete('semesterId');
  const returnSearchText = returnSearch.toString();
  const fallbackReturnTo = `/admin/learning-journey${returnSearchText ? `?${returnSearchText}` : ''}`;
  const returnTo = returnToRaw.startsWith('/admin/learning-journey') ? returnToRaw : fallbackReturnTo;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [trendsError, setTrendsError] = useState('');
  const accessProfile = buildAccessProfile(token);
  const canManageLj = hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TEST_TRACKING);
  const canViewEtGrouping = hasPermission(accessProfile, P.CAN_VIEW_ET_GROUPING)
    || hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);
  const {
    data: timelineData,
    loading: timelineLoading,
    error: timelineError,
  } = useLearningJourneyTimeline(token, studentId, { semesterId, includeExcludedCourses: true });

  useEffect(() => {
    const sid = String(studentId || '').trim();
    if (!sid) return;
    setLoading(true);
    setError('');
    setForbidden(false);
    setTrends(null);
    setTrendsError('');
    Promise.all([
      getLearningJourneyV3StudentProfile(token, sid, semesterId),
      getLearningJourneyV3StudentTrends(token, sid, semesterId)
    ])
      .then(([profileRes, trendsRes]) => {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[LearningJourneyStudentProfile] student detail response', profileRes);
        }
        setData(profileRes || null);
        setTrends(trendsRes || null);
      })
      .catch((err) => {
        setData(null);
        setTrends(null);
        if (Number(err?.status) === 403) {
          setForbidden(true);
          setError('');
          setTrendsError('');
        } else {
          const friendlyMessage = getFriendlyLoadError(err);
          setError(`${friendlyMessage}${err.requestId ? ` (requestId: ${err.requestId})` : ''}`);
          setTrendsError(friendlyMessage || '趨勢資料載入失敗');
        }
      })
      .finally(() => setLoading(false));
  }, [token, studentId, semesterId]);

  useEffect(() => {
    if (!setAdminPageMeta) return undefined;
    const name = data?.student?.studentName || data?.studentName;
    setAdminPageMeta({
      pageTitle: name ? `${name} 的學習歷程` : '學生學習歷程',
      breadcrumbLeaf: name || studentId || '學生學習歷程',
    });
    return () => setAdminPageMeta(null);
  }, [setAdminPageMeta, data, studentId]);

  const warningBySection = (section) =>
    (Array.isArray(data?.warnings) ? data.warnings : []).find((w) => w?.section === section)?.message || '';
  const allWarnings = [
    ...(Array.isArray(data?.warnings) ? data.warnings : []),
    ...(Array.isArray(trends?.warnings) ? trends.warnings : [])
  ];
  const {
    activityStats,
    activitySummary,
    activityRecords
  } = normalizeActivityData(data);
  const examRecords = [
    data?.trainingExamRecords,
    data?.examAttempts,
    data?.examRecords,
    data?.bestepRecords
  ].find((rows) => Array.isArray(rows) && rows.length > 0) || [];
  const dataSources = data?.meta?.dataSources || {};
  const emptyReasons = data?.meta?.emptyReasons || {};

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-end align-items-center mb-3">
        <Link className="btn btn-outline-primary btn-sm" to={returnTo}>
          返回學習歷程總覽
        </Link>
      </div>

      {loading ? (
        <div className="alert alert-light d-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          <span>正在載入學生資料...</span>
        </div>
      ) : null}
      {forbidden ? (
        <div className="card border-warning mb-3">
          <div className="card-body">
            <div className="text-warning-emphasis mb-2">您沒有執行此操作的權限。</div>
            <Link className="btn btn-outline-primary btn-sm" to={returnTo}>
              返回學習歷程總覽
            </Link>
          </div>
        </div>
      ) : null}
      {error ? <div className="alert alert-danger">載入失敗：{error}</div> : null}

      {!loading && !forbidden && !error && !data ? <div className="alert alert-secondary">尚無資料。</div> : null}

      {!loading && !forbidden && !error && data ? (
        <>
          <DataQualityBanner warnings={allWarnings} />
          <StudentProfileHeader student={data.student} />

          <div className="card mb-3">
            <div className="card-header fw-semibold">學生事件時間軸</div>
            <div className="card-body">
              {timelineLoading ? (
                <div className="text-muted small d-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  載入時間軸…
                </div>
              ) : null}
              {timelineError ? <div className="alert alert-danger py-2">{timelineError}</div> : null}
              {!timelineLoading && !timelineError ? <LearningJourneyTimeline data={timelineData} /> : null}
            </div>
          </div>

          <LearningJourneyExportPanel token={token} canManage={canManageLj} />

          <ProfileSection title="四技能歷史最佳" sourceMeta={dataSources.bestSkills}>
            <BestSkillCards bestSkills={data.bestSkills} emptyReason={emptyReasons.bestSkills} />
          </ProfileSection>

          <ProfileSection title="CEFR 成長曲線" sourceMeta={dataSources.cefrTrend}>
            {trendsError ? <div className="text-muted small">{trendsError}</div> : null}
            <CefrTrendChart trends={trends} emptyReason={emptyReasons.cefrTrend} />
          </ProfileSection>

          <ProfileSection title="Exam Timeline" sourceMeta={dataSources.examRecords}>
            <ExamTimeline examAttempts={data.examAttempts} emptyReason={emptyReasons.examRecords} />
          </ProfileSection>

          <ProfileSection title="活動參與統計" sourceMeta={dataSources.activitySummary}>
            <SectionWarning message={warningBySection('activitySummary')} />
            <ActivityParticipationSummary
              activitySummary={activitySummary}
              activityStats={activityStats}
              emptyReason={emptyReasons.activitySummary}
            />
          </ProfileSection>

          {canViewEtGrouping ? (
            <ProfileSection title="English Table 參與與建議" sourceMeta={{ source: 'et_grouping' }}>
              <EtStudentParticipationPanel
                token={token}
                studentId={studentId}
                showRecommendations
              />
            </ProfileSection>
          ) : null}

          <ProfileSection title="活動與能力對照" sourceMeta={dataSources.activityAbilityMapping}>
            <ActivityVsSkillPanel
              activityAbilityMapping={activityRecords}
              emptyReason={emptyReasons.activityAbilityMapping}
            />
          </ProfileSection>

          <ProfileSection title="修課紀錄" sourceMeta={dataSources.courseRecords}>
            <SectionWarning message={warningBySection('courseRecords')} />
            <CourseRecordsTable courseRecords={data.courseRecords} emptyReason={emptyReasons.courseRecords} />
          </ProfileSection>

          <ProfileSection title="培力英檢紀錄" sourceMeta={dataSources.bestepRecords}>
            <SectionWarning message={warningBySection('bestepRecords')} />
            <BestepRecordsTable bestepRecords={examRecords} emptyReason={emptyReasons.bestepRecords} />
          </ProfileSection>
        </>
      ) : null}
    </div>
  );
}
