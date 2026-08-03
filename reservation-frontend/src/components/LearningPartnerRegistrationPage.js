// components/LearningPartnerRegistrationPage.js
// 學習有伴團體報名頁面
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEnglishTestRegistrationGroupEnabledPublic } from '../services/settingsAdminApi';
import { createLearningPartnerTeam, fetchLearningPartnerQuota } from '../services/learningPartnerPublicApi';
import '../styles/registration-public.css';

export default function LearningPartnerRegistrationPage() {
  const navigate = useNavigate();

  const [teamSize, setTeamSize] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTeam, setSubmittedTeam] = useState(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [quotaInfo, setQuotaInfo] = useState({ quota: 50, current: 0, remaining: 50, isFull: false });
  const [hasAgreed, setHasAgreed] = useState(false);
  const [hasConfirmedAgreement, setHasConfirmedAgreement] = useState(false);

  // 載入報名狀態與名額資訊
  useEffect(() => {
    const loadRegistrationStatus = async () => {
      try {
        // 檢查團體報名功能是否啟用（與後台「團體報名」開關一致）
        setRegistrationEnabled(await fetchEnglishTestRegistrationGroupEnabledPublic());
        try {
          const quotaData = await fetchLearningPartnerQuota();
          setQuotaInfo(quotaData);
        } catch (_) {
          // 名額查詢失敗時保留預設值
        }
      } catch (error) {
        console.error('載入報名狀態錯誤:', error);
        setRegistrationEnabled(true);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    loadRegistrationStatus();
  }, []);

  // 當選擇團隊人數時，初始化成員陣列
  useEffect(() => {
    if (teamSize && teamSize >= 3 && teamSize <= 4) {
      const newMembers = Array(teamSize).fill(null).map((_, index) => ({
        studentId: '',
        name: '',
        index
      }));
      setMembers(newMembers);
      setErrors({});
    }
  }, [teamSize]);

  const handleMemberChange = (index, field, value) => {
    const newMembers = [...members];
    newMembers[index] = { ...newMembers[index], [field]: value };
    setMembers(newMembers);
    
    // 清除該欄位的錯誤
    if (errors[`member_${index}_${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`member_${index}_${field}`];
      setErrors(newErrors);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!teamSize) {
      newErrors.teamSize = '請選擇團隊人數';
    }
    
    if (teamSize && members.length === teamSize) {
      members.forEach((member, index) => {
        if (!member.studentId || !member.studentId.trim()) {
          newErrors[`member_${index}_studentId`] = '請輸入學號';
        }
        if (!member.name || !member.name.trim()) {
          newErrors[`member_${index}_name`] = '請輸入姓名';
        }
      });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert('請修正表單錯誤後再提交');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const data = await createLearningPartnerTeam({
        teamName: teamName.trim() || null,
        teamSize,
        members: members.map((m) => ({
          studentId: m.studentId.trim(),
          name: m.name.trim(),
        })),
      });
      setSubmittedTeam(data.team);
    } catch (error) {
      console.error('提交錯誤:', error);
      const data = error.data || {};
      if (data.code === 'LP_QUOTA_FULL') {
        alert(`團體報名名額已滿（目前 ${data.current}/${data.quota}）`);
      } else if (data.code === 'LP_MEMBER_NOT_ELIGIBLE' && data.ineligibleMembers) {
        const memberList = data.ineligibleMembers.map((m) =>
          `${m.name} (${m.studentId}): ${m.reason}`,
        ).join('\n');
        alert(`以下成員不符合報名資格：\n\n${memberList}`);
      } else if (data.code === 'LP_MEMBER_ALREADY_IN_TEAM') {
        alert('部分成員已在其他團體中，無法重複報名');
      } else {
        alert(error.message || data.error || '提交時發生錯誤，請稍後再試');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">載入中...</span>
        </div>
        <p className="mt-3">正在檢查報名狀態...</p>
      </div>
    );
  }

  // 同意頁面 - 需要先審閱並同意才能進入報名表單
  if (!hasConfirmedAgreement) {
    return (
      <div className="public-registration">
        <nav className="public-registration__nav">
          <button type="button" onClick={() => navigate('/register/english-test')} className="btn btn-outline-secondary btn-sm">
            返回個人報名
          </button>
          <button type="button" onClick={() => navigate('/')} className="btn btn-outline-secondary btn-sm">
            返回首頁
          </button>
        </nav>

        <div className="public-registration__container">
          <div className="public-registration__card">
            <header className="mb-3 text-center">
              <h1 className="public-registration__title">學習有伴團體報名</h1>
              <p className="public-registration__subtitle">請先審閱並同意下列文件，再進入報名表單。</p>
            </header>

            <div className="alert alert-warning py-2 small mb-4">
              請仔細閱讀文件內容，確認了解相關規定後再勾選同意。
            </div>

            <div className="public-registration__section mb-3">
              <div className="public-registration__section-title">個資使用同意書</div>
              <div className="doc-image text-center">
                <img src="/個資使用同意書.jpg" alt="個資使用同意書" className="img-fluid" />
              </div>
            </div>

            <div className="public-registration__section mb-3">
              <div className="public-registration__section-title">團體報名簡章</div>
              <div className="doc-image text-center">
                <img src="/團體報名簡章.jpg" alt="團體報名簡章" className="img-fluid" />
              </div>
            </div>

            <div className="privacy-panel mb-4">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="agreeCheckbox"
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="agreeCheckbox">
                  我已確實審閱並同意上述文件內容
                </label>
              </div>
            </div>

            <div className="public-registration__submit-bar justify-content-center">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (hasAgreed) {
                    setHasConfirmedAgreement(true);
                    setTimeout(() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 100);
                  } else {
                    alert('請先勾選「我已確實審閱並同意上述文件內容」');
                  }
                }}
                disabled={!hasAgreed}
              >
                {hasAgreed ? '確認進入報名表單' : '請先勾選同意'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!registrationEnabled) {
    return (
      <div className="container mt-5">
        <div className="card">
          <div className="card-body text-center py-5">
            <h3 className="text-danger mb-3">學習有伴團體報名功能目前未開放</h3>
            <p className="text-muted">如有疑問，請聯繫相關單位。</p>
            <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>
              返回首頁
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 名額已滿時的顯示
  if (quotaInfo.isFull) {
    return (
      <div className="container mt-5">
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="mb-4">
              <i className="fas fa-exclamation-triangle" style={{ fontSize: '4rem', color: '#dc3545' }}></i>
            </div>
            <h3 className="text-danger mb-3">團體報名名額已滿</h3>
            <p className="mb-2">
              <strong>目前報名組數：</strong>{quotaInfo.current} / {quotaInfo.quota} 組
            </p>
            <p className="text-muted mb-4">
              團體報名名額已達上限，目前無法接受新的團體報名。
              <br />
              如有疑問，請聯繫相關單位。
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              返回首頁
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submittedTeam) {
    return (
      <div className="container mt-5">
        <div className="card">
          <div className="card-body">
            <h3 className="text-success mb-4">✅ 團體報名已建立</h3>
            <p className="mb-3">
              <strong>團體編號：</strong>{submittedTeam.id}
            </p>
            {submittedTeam.teamName && (
              <p className="mb-3">
                <strong>團體名稱：</strong>{submittedTeam.teamName}
              </p>
            )}
            <p className="mb-3">
              <strong>過期時間：</strong>
              {new Date(submittedTeam.expiresAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
            </p>
            
            <div className="alert alert-info mt-4">
              <strong>重要提醒：</strong>
              <ul className="mb-0 mt-2">
                <li>系統已發送邀請郵件給所有成員</li>
                <li>所有成員需在 24 小時內完成同意，團體報名才會生效</li>
                <li>您可以隨時查看團體狀態</li>
              </ul>
            </div>

            <div className="mt-4">
              <button 
                className="btn btn-primary me-2" 
                onClick={() => navigate(`/register/english-test/group/status/${submittedTeam.id}`)}
              >
                查看團體狀態
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/')}>
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-registration">
      <nav className="public-registration__nav">
        <button type="button" onClick={() => navigate('/register/english-test')} className="btn btn-outline-secondary btn-sm">
          返回個人報名
        </button>
        <button type="button" onClick={() => navigate('/')} className="btn btn-outline-secondary btn-sm">
          返回首頁
        </button>
      </nav>

      <div className="public-registration__container public-registration__container--narrow">
        <div className="public-registration__card">
          <header className="mb-3">
            <h1 className="public-registration__title">學習有伴團體報名</h1>
            <p className="public-registration__subtitle">請填寫團體成員資料，送出後成員需於時限內完成同意。</p>
          </header>

          <div className="public-registration__quota">
            <div className="public-registration__quota-item">
              <span className="public-registration__quota-label">目前報名組數</span>
              <span className="public-registration__quota-value">{quotaInfo.current} / {quotaInfo.quota} 組</span>
            </div>
            <div className="public-registration__quota-item">
              <span className="public-registration__quota-label">剩餘名額</span>
              <span className="public-registration__quota-value">{quotaInfo.remaining} 組</span>
            </div>
          </div>

          {quotaInfo.remaining > 0 && quotaInfo.remaining <= 5 && (
            <div className="alert alert-warning py-2 small">僅剩 {quotaInfo.remaining} 組名額，請盡快完成報名。</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="public-registration__section">
              <div className="public-registration__section-title">團體設定</div>
              <div className="mb-3">
                <label className="form-label fw-bold">
                  選擇團隊人數 <span className="text-danger">*</span>
                </label>
                <div className="btn-group w-100" role="group">
                  {[3, 4].map(size => (
                    <button
                      key={size}
                      type="button"
                      className={`btn ${teamSize === size ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTeamSize(size)}
                    >
                      {size} 人
                    </button>
                  ))}
                </div>
                {errors.teamSize && (
                  <div className="text-danger small mt-1">{errors.teamSize}</div>
                )}
              </div>

              {/* 團體名稱（選填） */}
              {teamSize && (
                <div className="mb-4">
                  <label className="form-label fw-bold">
                    團體名稱（選填）
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="例如：英語學習小組"
                    maxLength={100}
                  />
                </div>
              )}

            </div>

              {teamSize && members.length === teamSize && (
                <div className="public-registration__section">
                  <div className="public-registration__section-title">團體成員資料</div>
                  <div className="alert alert-info small mb-3">
                    所有成員（含代表者）須已完成個人培力英檢四項報名且狀態為「報名成功」。
                  </div>

                  <div className="public-registration__members">
                  {members.map((member, index) => (
                    <div key={index} className="public-registration__member-card">
                        <h6 className="public-registration__member-title">
                          {index === 0 ? '代表者（填寫表單者）' : `成員 ${index + 1}`}
                        </h6>
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="form-label small">學號 <span className="text-danger">*</span></label>
                            <input
                              type="text"
                              className={`form-control ${errors[`member_${index}_studentId`] ? 'is-invalid' : ''}`}
                              value={member.studentId}
                              onChange={(e) => handleMemberChange(index, 'studentId', e.target.value)}
                              placeholder="例如：B123456789"
                              required
                            />
                            {errors[`member_${index}_studentId`] && (
                              <div className="invalid-feedback">{errors[`member_${index}_studentId`]}</div>
                            )}
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label small">姓名 <span className="text-danger">*</span></label>
                            <input
                              type="text"
                              className={`form-control ${errors[`member_${index}_name`] ? 'is-invalid' : ''}`}
                              value={member.name}
                              onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                              placeholder="例如：王小明"
                              required
                            />
                            {errors[`member_${index}_name`] && (
                              <div className="invalid-feedback">{errors[`member_${index}_name`]}</div>
                            )}
                          </div>
                        </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}

              {teamSize && (
                <div className="public-registration__submit-bar">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/')}>
                    取消
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? '提交中…' : '送出團體報名'}
                  </button>
                </div>
              )}
            </form>
        </div>
      </div>
    </div>
  );
}
