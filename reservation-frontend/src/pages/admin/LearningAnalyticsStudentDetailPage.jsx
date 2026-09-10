import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import StatusBadge from '../../components/ui/StatusBadge';
import GrowthEpisodeTable from '../../components/learningAnalytics/GrowthEpisodeTable';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import LaFold from '../../components/learningAnalytics/LaFold';
import StudentCoachingSummaryCard from '../../components/learningAnalytics/StudentCoachingSummaryCard';
import StudentRecommendationsPanel from '../../components/learningAnalytics/StudentRecommendationsPanel';
import EtStudentParticipationPanel from '../../components/etGrouping/EtStudentParticipationPanel';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import {
  getLearningAnalyticsSkills,
  getLearningAnalyticsStudentJourney,
  getLearningAnalyticsStudentRecommendations,
} from '../../services/learningAnalyticsService';
import { pushRecentStudent } from '../../utils/learningAnalyticsRecentStudents';
import { P } from '../../constants/permissions';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';

const LANE_LABELS = {
  baseline: '基準',
  exam: '英檢',
  course: '修課',
  activity: '活動',
  other: '其他',
};

const DEFAULT_LANES = new Set(['exam', 'course', 'activity', 'baseline']);

export default function LearningAnalyticsStudentDetailPage({ focus = 'journey' }) {
  const { studentId: rawStudentId } = useParams();
  const [searchParams] = useSearchParams();
  const studentId = String(rawStudentId || '').trim().toUpperCase();
  const {
    meta,
    metaError,
    ready,
    apiParams,
    appliedFilters,
    token,
  } = useLearningAnalyticsBootstrap();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [journey, setJourney] = useState(null);
  const [skills, setSkills] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  const accessProfile = buildAccessProfile(token);
  const canViewEtGrouping = hasPermission(accessProfile, P.CAN_VIEW_ET_GROUPING)
    || hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);

  const semesterId = appliedFilters.semester
    || searchParams.get('semester')
    || apiParams()?.semester
    || '';

  const load = useCallback(async () => {
    if (!ready || !studentId) return;
    setLoading(true);
    setError('');
    try {
      const params = {
        ...apiParams(),
        student_id: studentId,
      };
      const journeyParams = {
        snapshot_version: params.snapshot_version || params.snapshotVersion,
      };
      const [journeyData, skillsData, recData] = await Promise.all([
        getLearningAnalyticsStudentJourney(token, studentId, journeyParams),
        getLearningAnalyticsSkills(token, params),
        getLearningAnalyticsStudentRecommendations(token, studentId, journeyParams).catch(() => null),
      ]);
      setJourney(journeyData);
      setSkills(skillsData);
      setRecommendations(recData);
      pushRecentStudent({
        studentId,
        name: journeyData?.student?.name || null,
      });
    } catch (e) {
      setJourney(null);
      setSkills(null);
      setRecommendations(null);
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, ready, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const studentEpisodes = useMemo(
    () => (skills?.growth?.episodes || []).filter((ep) => ep.studentId === studentId),
    [skills, studentId]
  );

  const timelineRows = useMemo(() => {
    const rows = journey?.timeline || [];
    if (showAllTimeline) return rows;
    return rows.filter((ev) => DEFAULT_LANES.has(ev.lane));
  }, [journey?.timeline, showAllTimeline]);

  const backTo = focus === 'skills' ? '/admin/learning-analytics/skills' : '/admin/learning-analytics/students';
  const fromGap = searchParams.get('from') === 'kpi' || searchParams.get('from') === 'gap';

  if (!studentId) {
    return <Alert variant="warning">請提供有效學號。</Alert>;
  }

  return (
    <div>
      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <Button as={Link} to={backTo} variant="outline-secondary" size="sm">
          ← 返回{focus === 'skills' ? '技能成長' : '學習軌跡'}
        </Button>
        {fromGap ? (
          <Button as={Link} to="/admin/learning-analytics/kpi-report" variant="outline-secondary" size="sm">
            ← 返回 KPI／缺口
          </Button>
        ) : null}
        <Button
          as={Link}
          to={`/admin/learning-journey/students/${encodeURIComponent(studentId)}?semesterId=${encodeURIComponent(semesterId || '')}`}
          variant="outline-primary"
          size="sm"
        >
          完整學習歷程檔案
        </Button>
        {canViewEtGrouping ? (
          <Button
            as={Link}
            to={`/admin/et-grouping/student-trends?studentId=${encodeURIComponent(studentId)}`}
            variant="outline-primary"
            size="sm"
          >
            ET 學期趨勢
          </Button>
        ) : null}
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}

      {!loading && journey ? (
        <>
          <StudentCoachingSummaryCard
            journey={journey}
            studentId={studentId}
            semesterId={semesterId}
          />

          {(journey.meta?.warnings || []).map((warning) => (
            <Alert key={warning.code} variant="warning" className="mb-3 small py-2">
              {warning.message}
            </Alert>
          ))}

          {(focus === 'skills' || studentEpisodes.length > 0) ? (
            <div className="la-panel mb-3">
              <LearningAnalyticsPanelHeader
                title="前後測進步明細"
                lead="時數只算考試前的課程／活動。同測請看原始分進步。"
              />
              <GrowthEpisodeTable episodes={studentEpisodes} />
            </div>
          ) : null}

          <div className="la-panel mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <LearningAnalyticsPanelHeader
                title="時間線"
                lead={`快照：${journey.meta?.snapshotVersion || '—'}${journey.meta?.derivedAt ? ` · 衍生於 ${String(journey.meta.derivedAt).slice(0, 10)}` : ''}`}
              />
              <Form.Check
                type="switch"
                id="la-student-timeline-all"
                label="顯示全部事件"
                checked={showAllTimeline}
                onChange={(e) => setShowAllTimeline(e.target.checked)}
              />
            </div>
            {!showAllTimeline ? (
              <p className="small text-muted mb-2">預設只顯示基準／英檢／修課／活動。</p>
            ) : null}
            {!timelineRows.length ? (
              <p className="small text-muted mb-0">尚無可顯示事件。</p>
            ) : (
              <div className="table-responsive">
                <Table size="sm" hover className="mb-0">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>類型</th>
                      <th>標題</th>
                      <th>分數/時數</th>
                      <th>標記</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineRows.map((event) => (
                      <tr key={event.eventId}>
                        <td>{event.eventDate || '—'}</td>
                        <td>{LANE_LABELS[event.lane] || event.lane}</td>
                        <td>
                          <div>{event.title || '—'}</div>
                          {event.subtitle ? (
                            <div className="text-muted small">{event.subtitle}</div>
                          ) : null}
                        </td>
                        <td>
                          {event.rawScore != null ? event.rawScore : (event.hours != null ? `${event.hours}h` : '—')}
                        </td>
                        <td>
                          {(event.badges || []).map((badge) => (
                            <StatusBadge key={badge} variant="neutral" size="sm" className="me-1">
                              {badge}
                            </StatusBadge>
                          ))}
                          {event.exposureRelation === 'after_exam' ? (
                            <StatusBadge variant="neutral" size="sm">考後</StatusBadge>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>

          <LaFold label="建議資源與通過機會（實驗，預設收合）" className="mb-3">
            {recommendations ? (
              <StudentRecommendationsPanel data={recommendations} />
            ) : (
              <p className="small text-muted mb-0">尚無建議資料。</p>
            )}
          </LaFold>

          {canViewEtGrouping ? (
            <LaFold label="English Table 參與（預設收合）" className="mb-3">
              <div className="la-panel mb-0">
                <div className="la-panel-title">English Table 參與</div>
                <EtStudentParticipationPanel
                  token={token}
                  studentId={studentId}
                  showRecommendations
                  compact
                />
              </div>
            </LaFold>
          ) : null}
        </>
      ) : null}

      {!loading && !journey && !error ? (
        <Alert variant="warning">找不到學生 {studentId} 的分析資料。</Alert>
      ) : null}
    </div>
  );
}
