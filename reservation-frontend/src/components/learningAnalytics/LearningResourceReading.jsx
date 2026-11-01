import React from 'react';
import { Link } from 'react-router-dom';
import { describeResourceExposure, LEARNING_DETAIL_LINKS } from '../../pages/admin/learningParticipationReading';

export default function LearningResourceReading({ rows }) {
  const reading = describeResourceExposure(rows);
  return (
    <div data-testid="learning-reading-detail">
      <ul className="small mb-2 ps-3">
        <li>{reading.population}</li>
        <li>{reading.absence}</li>
        <li>{reading.missing}</li>
        <li>{reading.anonymity}</li>
        <li>{reading.causation}</li>
        {reading.apiInterpretation ? <li>{reading.apiInterpretation}</li> : null}
        <li>{reading.evidence}</li>
        <li>{reading.exposure}</li>
      </ul>
      <p className="small text-muted mb-0">這份資源回應沒有排除原因明細。排除條件請到技能成長或原始資料查看既有欄位。</p>
    </div>
  );
}

export function LearningDetailLinks() {
  return (
    <div className="d-flex flex-wrap gap-2 mt-3" data-testid="learning-detail-links">
      {LEARNING_DETAIL_LINKS.map((link) => (
        <Link key={link.id} className="btn btn-outline-secondary btn-sm" to={link.to} title={link.hint}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}
