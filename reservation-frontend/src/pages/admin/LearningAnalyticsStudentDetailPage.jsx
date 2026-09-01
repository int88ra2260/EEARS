import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import StatusBadge from '../../components/ui/StatusBadge';
import GrowthEpisodeTable from '../../components/learningAnalytics/GrowthEpisodeTable';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import {
  getLearningAnalyticsSkills,
  getLearningAnalyticsStudentJourney,
  getLearningAnalyticsStudentRecommendations,
} from '../../services/learningAnalyticsService';
import StudentRecommendationsPanel from '../../components/learningAnalytics/StudentRecommendationsPanel';
import EtStudentParticipationPanel from '../../components/etGrouping/EtStudentParticipationPanel';
import { P } from '../../constants/permissions';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';

const LANE_LABELS = {
  baseline: '基準',
  exam: '英檢',
  course: '修課',
  activity: '活動',
  other: '其他',
};

export default function LearningAnalyticsStudentDetailPage({ focus = 'journey' }) {
  const { studentId: rawStudentId } = useParams();
  const studentId = String(rawStudentId || '').trim().toUpperCase();
  const {
    meta,
    metaError,
    ready,
    apiParams,
    token,
  } = useLearningAnalyticsBootstrap();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [journey, setJourney] = useState(null);
  const [skills, setSkills] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const accessProfile = buildAccessProfile(token);
  const canViewEtGrouping = hasPermission(accessProfile, P.CAN_VIEW_ET_GROUPING)
    || hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);

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

  const backTo = focus === 'skills' ? '/admin/learning-analytics/skills' : '/admin/learning-analytics/students';

  if (!studentId) {
    return <Alert variant="warning">請提供有效學號。</Alert>;
  }

  return (
    <div>
      <LearningAnalyticsDataHealth meta={meta} error={metaError} />
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <Button as={Link} to={backTo} variant="outline-secondary" size="sm">
          ← 返回{focus === 'skills' ? '技能成長' : '學習軌跡'}
        </Button>
        <Button
          as={Link}
          to={`/admin/learning-journey/students/${encodeURIComponent(studentId)}?semesterId=${encodeURIComponent(apiParams()?.semester || '')}`}
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
          <div className="la-panel mb-3">
            <div className="la-panel-title">
              {journey.student?.name || studentId}
              <span className="text-muted fw-normal ms-2 font-monospace small">{studentId}</span>
            </div>
            <Row className="g-2 small">
              <Col md={3}>
                <span className="text-muted">系所</span>
                <div>{journey.student?.department || '—'}</div>
              </Col>
              <Col md={3}>
                <span className="text-muted">入學屆</span>
                <div>{journey.student?.cohort || '—'}</div>
              </Col>
              <Col md={3}>
                <span className="text-muted">基準 CEFR</span>
                <div>{journey.student?.baseline?.cefr || '—'}</div>
              </Col>
              <Col md={3}>
                <span className="text-muted">最佳 CEFR</span>
                <div>
                  {journey.student?.currentStatus?.bestCefr || '—'}
                  {journey.student?.currentStatus?.isB2plus ? (
                    <StatusBadge variant="success" size="sm" className="ms-1">B2+</StatusBadge>
                  ) : null}
                </div>
              </Col>
            </Row>
            {(journey.meta?.warnings || []).map((warning) => (
              <Alert key={warning.code} variant="warning" className="mt-3 mb-0 small py-2">
                {warning.message}
              </Alert>
            ))}
          </div>

          {recommendations ? (
            <StudentRecommendationsPanel data={recommendations} />
          ) : null}

          {canViewEtGrouping ? (
            <div className="la-panel mb-3">
              <div className="la-panel-title">English Table 參與</div>
              <EtStudentParticipationPanel
                token={token}
                studentId={studentId}
                showRecommendations
                compact
              />
            </div>
          ) : null}

          {(focus === 'skills' || studentEpisodes.length > 0) ? (
            <div className="la-panel mb-3">
              <div className="la-panel-title">前後測進步明細</div>
              <p className="small text-muted">
                時數只算考試前的課程／活動。
              </p>
              <GrowthEpisodeTable episodes={studentEpisodes} />
            </div>
          ) : null}

          <div className="la-panel">
            <div className="la-panel-title">時間線</div>
            <p className="small text-muted mb-2">
              快照：{journey.meta?.snapshotVersion || '—'}
              {journey.meta?.derivedAt ? ` · 衍生於 ${String(journey.meta.derivedAt).slice(0, 10)}` : ''}
            </p>
            {!journey.timeline?.length ? (
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
                    {journey.timeline.map((event) => (
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
        </>
      ) : null}

      {!loading && !journey && !error ? (
        <Alert variant="warning">找不到學生 {studentId} 的分析資料。</Alert>
      ) : null}
    </div>
  );
}
