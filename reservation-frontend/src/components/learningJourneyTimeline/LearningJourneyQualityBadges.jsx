import React from 'react';

const BADGE_TONES = {
  'B2+': 'tone-blue',
  未出分: 'tone-yellow',
  考前暴露: 'tone-green',
  考後: 'tone-neutral',
  已排除: 'tone-red',
};

function toneForBadge(label) {
  return BADGE_TONES[label] || 'tone-neutral';
}

export default function LearningJourneyQualityBadges({ badges = [], warnings = [] }) {
  const badgeList = Array.isArray(badges) ? badges : [];
  const warningList = Array.isArray(warnings) ? warnings : [];
  if (!badgeList.length && !warningList.length) return null;

  return (
    <div className="lj-timeline-badges">
      {badgeList.map((b) => (
        <span key={b} className={`lj-timeline-tag ${toneForBadge(b)}`}>{b}</span>
      ))}
      {warningList.map((w) => (
        <span key={w} className="lj-timeline-tag tone-yellow" title={w}>注意</span>
      ))}
    </div>
  );
}
