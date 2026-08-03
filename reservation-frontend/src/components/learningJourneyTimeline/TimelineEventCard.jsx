import React from 'react';
import LearningJourneyQualityBadges from './LearningJourneyQualityBadges';

function formatEventDate(value) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export default function TimelineEventCard({ event, compact = false }) {
  if (!event) return null;

  const exposureClass = event.exposureRelation === 'before_exam'
    ? 'before-exam'
    : event.exposureRelation === 'after_exam'
      ? 'after-exam'
      : '';

  const scoreText = event.status === 'registered_no_score'
    ? '未出分'
    : event.rawScore != null
      ? String(event.rawScore)
      : '—';

  return (
    <article className={`lj-timeline-card ${compact ? 'is-compact' : ''} ${exposureClass} ${event.excludeFlag ? 'is-excluded' : ''}`}>
      <h4 className="lj-timeline-card-title">{event.title || '事件'}</h4>
      <p className="lj-timeline-card-meta lj-tabular">
        <time dateTime={event.eventDate || undefined}>{formatEventDate(event.eventDate)}</time>
        {event.termLabel ? <span className="lj-timeline-card-term"> · {event.termLabel}</span> : null}
      </p>
      {event.lane === 'exam' ? (
        <p className="lj-timeline-card-detail">
          <span className="lj-timeline-card-instrument">{event.instrument || '英檢'}</span>
          {event.skill ? <span className="lj-timeline-card-skill"> · {event.skill}</span> : null}
          <span className="lj-timeline-card-score lj-tabular"> · {scoreText}</span>
          {event.cefrLevel ? <span className="lj-timeline-card-cefr"> ({event.cefrLevel})</span> : null}
        </p>
      ) : null}
      {event.hours != null && Number(event.hours) > 0 ? (
        <p className="lj-timeline-card-meta lj-tabular">{Number(event.hours).toFixed(2)} hr</p>
      ) : null}
      <LearningJourneyQualityBadges badges={event.badges} warnings={event.qualityWarnings} />
    </article>
  );
}
