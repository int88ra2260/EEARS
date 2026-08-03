// components/LearningPartnerApprovePage.js
// 學習有伴同意落地頁（二次確認）
import React, { useCallback, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import {
  confirmLearningPartnerApproval,
  prepareLearningPartnerApproval,
} from '../services/learningPartnerPublicApi';

export default function LearningPartnerApprovePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallMobile = useMediaQuery('(max-width: 576px)');
  
  const token = searchParams.get('token');
  const [teamInfo, setTeamInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const loadTeamInfo = useCallback(async () => {
    try {
      const { ok, data } = await prepareLearningPartnerApproval(token);
      if (ok) {
        setTeamInfo(data);
        setError(null);
      } else {
        setError(data.error || '載入團體資訊失敗');
        if (data.code === 'LP_TOKEN_USED' || data.code === 'LP_TOKEN_EXPIRED' || data.code === 'LP_TEAM_EXPIRED') {
          if (data.team) {
            setTeamInfo({ team: data.team });
          }
        }
      }
    } catch (error) {
      console.error('載入團體資訊錯誤:', error);
      setError('載入團體資訊時發生錯誤');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setError('缺少授權 token');
      setLoading(false);
      return;
    }
    loadTeamInfo();
  }, [token, loadTeamInfo]);

  const handleConfirm = async () => {
    if (!token) return;

    setConfirming(true);

    try {
      const data = await confirmLearningPartnerApproval(token);
      setConfirmed(true);
      setTeamInfo({ team: data.team });
    } catch (error) {
      console.error('確認同意錯誤:', error);
      alert(error.message || error.data?.error || '確認同意時發生錯誤');
      loadTeamInfo();
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">載入中...</span>
        </div>
        <p className="mt-3">載入團體資訊中...</p>
      </div>
    );
  }

  if (error && !teamInfo) {
    return (
      <div className="container mt-5">
        <div className="card">
          <div className="card-body text-center py-5">
            <h3 className="text-danger mb-3">載入失敗</h3>
            <p className="text-muted">{error}</p>
            <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>
              返回首頁
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 如果已確認或 token 已使用/過期
  if (confirmed || (error && teamInfo?.team)) {
    const isSuccess = confirmed;
    return (
      <div className="container mt-5">
        <div className="card shadow-lg" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="card-body p-4 text-center">
            {isSuccess ? (
              <>
                <div className="mb-4" style={{ fontSize: '4rem' }}>✅</div>
                <h3 className="text-success mb-3">同意成功！</h3>
                <p className="mb-4">
                  {teamInfo?.team?.status === 'approved' 
                    ? '全員同意完成！團體報名已確認。' 
                    : '您已完成同意，請等待其他成員完成同意。'}
                </p>
              </>
            ) : (
              <>
                <div className="mb-4" style={{ fontSize: '4rem' }}>⚠️</div>
                <h3 className="text-warning mb-3">無法完成同意</h3>
                <p className="mb-4 text-danger">{error}</p>
              </>
            )}

            {teamInfo?.team && (
              <div className="alert alert-info text-start">
                <strong>團體資訊：</strong>
                <ul className="mb-0 mt-2">
                  <li>團體編號：{teamInfo.team.id}</li>
                  {teamInfo.team.teamName && <li>團體名稱：{teamInfo.team.teamName}</li>}
                  <li>狀態：{teamInfo.team.status}</li>
                </ul>
              </div>
            )}

            <div className="mt-4">
              {teamInfo?.team?.id && (
                <button
                  className="btn btn-primary me-2"
                  onClick={() => navigate(`/register/english-test/group/status/${teamInfo.team.id}`)}
                >
                  查看團體狀態
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => navigate('/')}>
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 二次確認頁面
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
        <div className="card shadow-lg" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="card-body p-4">
            <h2 className="mb-4" style={{ color: '#FF6B6B', fontWeight: 'bold' }}>
              🎓 確認加入學習有伴團體
            </h2>

            {teamInfo && (
              <>
                <div className="alert alert-warning">
                  <strong>⚠️ 請確認以下資訊：</strong>
                </div>

                <div className="mb-4">
                  <p className="mb-2">
                    <strong>您的身份：</strong>
                    {teamInfo.member.isRepresentative ? '代表者' : '成員'}
                  </p>
                  <p className="mb-2">
                    <strong>您的姓名：</strong>{teamInfo.member.name}
                  </p>
                  <p className="mb-2">
                    <strong>您的學號：</strong>{teamInfo.member.studentId}
                  </p>
                  <p className="mb-2">
                    <strong>團體編號：</strong>{teamInfo.team.id}
                  </p>
                  {teamInfo.team.teamName && (
                    <p className="mb-2">
                      <strong>團體名稱：</strong>{teamInfo.team.teamName}
                    </p>
                  )}
                  <p className="mb-2">
                    <strong>團體人數：</strong>{teamInfo.team.teamSize} 人
                  </p>
                </div>

                <div className="mb-4">
                  <strong>團體成員：</strong>
                  <ul className="mt-2">
                    {teamInfo.team.members.map((member, index) => (
                      <li key={index}>
                        {member.name} ({member.studentId})
                        {member.isRepresentative && ' [代表]'}
                        {member.approvalStatus === 'approved' && ' ✅'}
                      </li>
                    ))}
                  </ul>
                </div>

                {teamInfo.team.remainingHours !== undefined && (
                  <div className={`alert alert-${teamInfo.team.remainingHours < 1 ? 'danger' : 'warning'} mb-4`}>
                    <strong>⏰ 剩餘時間：</strong>
                    {teamInfo.team.remainingHours > 0 
                      ? `${teamInfo.team.remainingHours} 小時 ${teamInfo.team.remainingMinutes} 分鐘`
                      : '已過期'}
                  </div>
                )}

                <div className="alert alert-info mb-4">
                  <strong>注意事項：</strong>
                  <ul className="mb-0 mt-2">
                    <li>點擊「確定同意」後即完成同意，無法撤回</li>
                    <li>所有成員都需在期限內完成同意，團體報名才會生效</li>
                  </ul>
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate('/')}
                  >
                    取消
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleConfirm}
                    disabled={confirming || teamInfo.team.remainingHours === 0}
                  >
                    {confirming ? '確認中...' : '確定同意'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
