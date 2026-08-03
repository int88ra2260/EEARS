import React from 'react';
import { TEAM_CARD_COLORS } from '../../utils/learningPartnerDisplayHelpers';

export default function LearningPartnerTeamCard({ team, index, onViewDetail }) {
  const cardColor = TEAM_CARD_COLORS[index % TEAM_CARD_COLORS.length];
  const members = team.members || [];

  return (
    <div className="col-xl-3 col-lg-4 col-md-6 col-sm-6">
      <div
        className="card h-100 shadow-sm"
        style={{
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          border: 'none',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '';
        }}
        onClick={() => onViewDetail(team.id)}
      >
        <div
          className="card-header text-white fw-bold text-center py-2"
          style={{
            backgroundColor: cardColor.header,
            border: 'none',
            fontSize: '1rem',
          }}
        >
          隊伍{team.semesterSequence !== null && team.semesterSequence !== undefined ? team.semesterSequence : team.id}
        </div>

        <div className="card-body p-3" style={{ backgroundColor: cardColor.bg, minHeight: '180px' }}>
          <div className="member-list">
            {members.map((member, memberIndex) => (
              <div
                key={memberIndex}
                className="d-flex align-items-center mb-2"
                style={{ padding: '4px 0' }}
              >
                <div className="me-2" style={{ fontSize: '1.1rem', flexShrink: 0, width: '24px', textAlign: 'center' }}>
                  {member.isRepresentative ? (
                    <span title="代表者" style={{ fontSize: '1.15rem' }}>👑</span>
                  ) : (
                    <span title="成員" style={{ fontSize: '1rem' }}>🖥️</span>
                  )}
                </div>

                <div className="flex-grow-1" style={{ minWidth: 0, flex: 1 }}>
                  <div className="text-truncate fw-semibold" style={{ fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '2px' }}>
                    {member.name}
                  </div>
                  <div className="text-truncate text-muted" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>
                    {member.studentId}
                  </div>
                </div>

                <div className="ms-2" style={{ flexShrink: 0, width: '16px', textAlign: 'center' }}>
                  {member.approvalStatus === 'approved' ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#4caf50',
                        cursor: 'help',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      }}
                      title="已同意"
                    ></span>
                  ) : member.approvalStatus === 'pending' ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#ff9800',
                        color: 'white',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        cursor: 'help',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      }}
                      title="待同意"
                    >
                      C
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#f44336',
                        cursor: 'help',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      }}
                      title="已過期"
                    ></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
