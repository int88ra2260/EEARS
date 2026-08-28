import React, { useMemo } from 'react';
import Badge from 'react-bootstrap/Badge';
import { Link } from 'react-router-dom';

function BadgeGrid({ badges = [] }) {
  if (!badges.length) {
    return <p className="text-muted small mb-0">完成 Word Bridge 或活動簽到後，徽章會在此顯示。</p>;
  }
  return (
    <div className="student-journey-badges">
      {badges.map((badge) => (
        <article
          key={badge.id}
          className={`student-journey-badge${badge.earned ? ' is-earned' : ''}`}
        >
          <div className="student-journey-badge__title">{badge.title}</div>
          <div className="student-journey-badge__desc">{badge.description}</div>
          <Badge bg={badge.earned ? 'success' : 'light'} text={badge.earned ? 'white' : 'dark'} className="border mt-2">
            {badge.earned ? '已解鎖' : '待解鎖'}
          </Badge>
        </article>
      ))}
    </div>
  );
}

function FeedbackCard({ feedback }) {
  if (!feedback) return null;
  return (
    <div className="student-journey-feedback">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h3 className="h6 mb-0">{feedback.headline}</h3>
        <Badge bg="info">{feedback.regulatoryFocus === 'prevention' ? '預防焦點' : '促進焦點'}</Badge>
      </div>
      <p className="mb-2">{feedback.message}</p>
      <ul className="mb-2 small">
        {(feedback.actionItems || []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {feedback.disclaimer ? (
        <p className="text-muted small mb-0">{feedback.disclaimer}</p>
      ) : null}
    </div>
  );
}

export default function StudentLearningJourneyPanel({ data }) {
  const recommendations = useMemo(
    () => data?.recommendations?.activities || [],
    [data],
  );

  if (!data) return null;

  return (
    <div className="student-journey-panel">
      <section className="student-progress-card public-card student-progress-card--wide">
        <h2 className="h5">調節焦點學習回饋</h2>
        <FeedbackCard feedback={data.feedback} />
      </section>

      <section className="student-progress-card public-card">
        <h2 className="h5">學習徽章（SRL）</h2>
        <p className="text-muted small">
          已解鎖 {data.gamification?.earnedCount ?? 0} / {data.gamification?.totalBadges ?? 0}
        </p>
        <BadgeGrid badges={data.gamification?.badges || []} />
      </section>

      <section className="student-progress-card public-card">
        <h2 className="h5">微學習紀錄</h2>
        {(data.microLearning?.recentSessions || []).length ? (
          <ul className="list-unstyled small mb-0">
            {data.microLearning.recentSessions.map((row) => (
              <li key={row.traceId} className="border-bottom py-2">
                <strong>{row.gameId}</strong>
                {' · '}
                {row.cefrLevel || '—'}
                {' · '}
                {new Date(row.occurredAt).toLocaleString('zh-TW')}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted small mb-2">尚未有綁定學號的微學習紀錄。</p>
        )}
        <Link to="/practice/word-bridge" className="btn btn-outline-primary btn-sm mt-2">
          前往 Word Bridge 練習
        </Link>
      </section>

      {recommendations.length ? (
        <section className="student-progress-card public-card student-progress-card--wide">
          <h2 className="h5">個人化活動建議</h2>
          <ul className="list-unstyled mb-0 small">
            {recommendations.map((rec) => (
              <li key={rec.eventId} className="border rounded p-2 mb-2">
                <div className="fw-semibold">{rec.name}</div>
                <div className="text-muted">{rec.date} · {rec.eventType}</div>
                <div>{rec.rationale}</div>
              </li>
            ))}
          </ul>
          <p className="text-muted small mt-2 mb-0">{data.recommendations?.disclaimer}</p>
        </section>
      ) : null}
    </div>
  );
}
