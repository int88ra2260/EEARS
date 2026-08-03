import React from 'react';
import LearningPartnerTeamCard from './LearningPartnerTeamCard';

export default function LearningPartnerTeamsGrid({ teams, onViewDetail }) {
  if (teams.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center py-5 text-muted">
          <p className="mb-0">目前沒有團體報名記錄</p>
        </div>
      </div>
    );
  }

  return (
    <div className="row g-3">
      {teams.map((team, index) => (
        <LearningPartnerTeamCard
          key={team.id}
          team={team}
          index={index}
          onViewDetail={onViewDetail}
        />
      ))}
    </div>
  );
}
