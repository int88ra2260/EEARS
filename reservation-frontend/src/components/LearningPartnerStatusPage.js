// components/LearningPartnerStatusPage.js
// 學習有伴團體狀態查詢頁面
import React, { useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import {
  fetchLearningPartnerTeamStatus,
  resendLearningPartnerInvite,
} from '../services/learningPartnerPublicApi';

export default function LearningPartnerStatusPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallMobile = useMediaQuery('(max-width: 576px)');
  
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resending, setResending] = useState({});

  const loadTeamStatus = useCallback(async () => {
    try {
      const data = await fetchLearningPartnerTeamStatus(teamId);
      setTeam(data.team);
      setError(null);
    } catch (error) {
      console.error('載入團體狀態錯誤:', error);
      setError('載入團體狀態時發生錯誤');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadTeamStatus();
    // 每 30 秒自動重新載入
    const interval = setInterval(loadTeamStatus, 30000);
    return () => clearInterval(interval);
  }, [loadTeamStatus]);

  const handleResend = async (memberId) => {
    setResending((prev) => ({ ...prev, [memberId]: true }));
    
    try {
      await resendLearningPartnerInvite(teamId, memberId);
      alert('已重新發送邀請連結');
      loadTeamStatus();
    } catch (error) {
      console.error('重新發送錯誤:', error);
      alert('重新發送時發生錯誤');
    } finally {
      setResending((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">載入中...</span>
        </div>
        <p className="mt-3">載入團體狀態中...</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="container mt-5">
        <div className="card">
          <div className="card-body text-center py-5">
            <h3 className="text-danger mb-3">載入失敗</h3>
            <p className="text-muted">{error || '找不到指定的團體'}</p>
            <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>
              返回首頁
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusMap = {
    'pending_approval': { text: '待同意', color: 'warning', icon: '⏳' },
    'approved': { text: '已完成', color: 'success', icon: '✅' },
    'expired': { text: '已失效', color: 'danger', icon: '❌' },
    'cancelled': { text: '已取消', color: 'secondary', icon: '🚫' }
  };

  const statusInfo = statusMap[team.status] || statusMap['pending_approval'];
  const isExpired = team.status === 'expired' || team.status === 'cancelled';
  const isPending = team.status === 'pending_approval';

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundImage: 'url("/images/bg-pattern2.png")',
        backgroundRepeat: 'repeat',
        backgroundSize: 'auto',
        backgroundAttachment: 'fixed',
        padding: isSmallMobile ? '1rem 0.5rem' : isMobile ? '1.5rem 1rem' : '2rem 1rem',
      }}
    >
      <div className="container">
        <nav className="d-flex align-items-center justify-content-end mb-4">
          <button
            onClick={() => navigate('/')}
            className="btn btn-outline-secondary"
          >
            {isSmallMobile ? '← 返回' : '返回首頁'}
          </button>
        </nav>

        <div className="card shadow-lg" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card-body p-4">
            <h2 className="mb-4" style={{ color: '#FF6B6B', fontWeight: 'bold' }}>
              🎓 團體報名狀態
            </h2>

            {/* 團體資訊 */}
            <div className="mb-4">
              <p className="mb-2">
                <strong>團體編號：</strong>{team.id}
              </p>
              {team.teamName && (
                <p className="mb-2">
                  <strong>團體名稱：</strong>{team.teamName}
                </p>
              )}
              <p className="mb-2">
                <strong>狀態：</strong>
                <span className={`badge bg-${statusInfo.color} ms-2`}>
                  {statusInfo.icon} {statusInfo.text}
                </span>
              </p>
              <p className="mb-2">
                <strong>建立時間：</strong>
                {new Date(team.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
              </p>
              {team.approvedAt && (
                <p className="mb-2">
                  <strong>完成時間：</strong>
                  {new Date(team.approvedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                </p>
              )}
            </div>

            {/* 倒數計時（僅在待同意狀態顯示） */}
            {isPending && (
              <div className={`alert alert-${team.remainingHours < 1 ? 'danger' : 'warning'} mb-4`}>
                <strong>⏰ 剩餘時間：</strong>
                {team.remainingHours > 0 ? (
                  `${team.remainingHours} 小時 ${team.remainingMinutes} 分鐘`
                ) : (
                  '已過期'
                )}
                <br />
                <small>過期時間：{new Date(team.expiresAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</small>
              </div>
            )}

            {/* 成員列表 */}
            <div className="mb-4">
              <h5 className="mb-3">成員列表</h5>
              <div className="table-responsive">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>姓名</th>
                      <th>學號</th>
                      <th>身份</th>
                      <th>同意狀態</th>
                      {isPending && <th>操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {team.members.map((member, index) => {
                      const approvalStatusMap = {
                        'pending': { text: '待同意', color: 'warning' },
                        'approved': { text: '已同意', color: 'success' },
                        'expired': { text: '已過期', color: 'danger' }
                      };
                      const approvalInfo = approvalStatusMap[member.approvalStatus] || approvalStatusMap['pending'];
                      
                      return (
                        <tr key={index}>
                          <td>{member.name}</td>
                          <td>{member.studentId}</td>
                          <td>{member.isRepresentative ? '代表者' : '成員'}</td>
                          <td>
                            <span className={`badge bg-${approvalInfo.color}`}>
                              {approvalInfo.text}
                            </span>
                            {member.approvedAt && (
                              <div className="small text-muted mt-1">
                                {new Date(member.approvedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                              </div>
                            )}
                          </td>
                          {isPending && member.approvalStatus === 'pending' && (
                            <td>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleResend(member.id)}
                                disabled={resending[member.id]}
                              >
                                {resending[member.id] ? '發送中...' : '重新發送'}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 提示訊息 */}
            {isPending && (
              <div className="alert alert-info">
                <strong>提醒：</strong>
                <ul className="mb-0 mt-2">
                  <li>所有成員需在 24 小時內完成同意，團體報名才會生效</li>
                  <li>若未收到郵件，可點擊「重新發送」按鈕</li>
                  <li>此頁面會每 30 秒自動更新狀態</li>
                </ul>
              </div>
            )}

            {team.status === 'approved' && (
              <div className="alert alert-success">
                <strong>✅ 團體報名已完成！</strong>
                <p className="mb-0 mt-2">所有成員已完成同意，請等待後續考試通知。</p>
              </div>
            )}

            {isExpired && (
              <div className="alert alert-danger">
                <strong>❌ 團體報名已失效</strong>
                <p className="mb-0 mt-2">
                  {team.status === 'expired' 
                    ? '因超過 24 小時未完成全員同意而自動失效。' 
                    : '此團體報名已被取消。'}
                </p>
                <p className="mb-0 mt-2">如需重新報名，請重新建立團體。</p>
              </div>
            )}

            <div className="mt-4">
              <button className="btn btn-secondary" onClick={() => navigate('/')}>
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
