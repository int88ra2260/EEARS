import React from 'react';
import { TEAM_STATUS_MAP } from '../../utils/learningPartnerDisplayHelpers';

export default function LearningPartnerTeamDetailModal({
  team,
  semesterFilter,
  onClose,
}) {
  if (!team) {
    return null;
  }

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-lg modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              團體詳情 - 隊伍{team.semesterSequence !== null && team.semesterSequence !== undefined ? team.semesterSequence : team.id}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="row mb-3">
              <div className="col-md-6">
                <strong>隊伍編號：</strong>
                {team.semesterSequence !== null && team.semesterSequence !== undefined
                  ? `${team.semesterSequence}（${semesterFilter || '全部學期'}）`
                  : team.id}
              </div>
              <div className="col-md-6">
                <strong>狀態：</strong>
                <span className={`badge bg-${TEAM_STATUS_MAP[team.status]?.color || 'secondary'} ms-2`}>
                  {TEAM_STATUS_MAP[team.status]?.text || team.status}
                </span>
              </div>
            </div>
            {team.teamName && (
              <div className="row mb-3">
                <div className="col-12">
                  <strong>團體名稱：</strong>{team.teamName}
                </div>
              </div>
            )}
            <div className="row mb-3">
              <div className="col-md-6">
                <strong>代表者學號：</strong>{team.representativeStudentId}
              </div>
              <div className="col-md-6">
                <strong>團體人數：</strong>{team.teamSize} 人
              </div>
            </div>
            <div className="row mb-3">
              <div className="col-md-6">
                <strong>建立時間：</strong>
                {new Date(team.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
              </div>
              {team.approvedAt && (
                <div className="col-md-6">
                  <strong>完成時間：</strong>
                  {new Date(team.approvedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                </div>
              )}
            </div>
            {team.expiresAt && (
              <div className="row mb-3">
                <div className="col-12">
                  <strong>過期時間：</strong>
                  {new Date(team.expiresAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                </div>
              </div>
            )}

            <hr />

            <h6 className="mb-3">成員列表</h6>
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>身份</th>
                    <th>姓名</th>
                    <th>學號</th>
                    <th>Email</th>
                    <th>同意狀態</th>
                    <th>同意時間</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {team.members?.map((member, index) => (
                    <tr key={index}>
                      <td>
                        {member.isRepresentative ? (
                          <span className="badge bg-warning">👑 代表者</span>
                        ) : (
                          <span className="text-muted">成員</span>
                        )}
                      </td>
                      <td>{member.name}</td>
                      <td>{member.studentId}</td>
                      <td>{member.email}</td>
                      <td>
                        <span
                          className={`badge bg-${
                            member.approvalStatus === 'approved'
                              ? 'success'
                              : member.approvalStatus === 'pending'
                                ? 'warning'
                                : 'danger'
                          }`}
                        >
                          {member.approvalStatus === 'approved'
                            ? '已同意'
                            : member.approvalStatus === 'pending'
                              ? '待同意'
                              : '已過期'}
                        </span>
                      </td>
                      <td>
                        {member.approvedAt
                          ? new Date(member.approvedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                          : '-'}
                      </td>
                      <td>
                        <small className="text-muted">{member.approvalIp || '-'}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
