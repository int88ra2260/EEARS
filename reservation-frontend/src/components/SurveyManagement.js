// src/components/SurveyManagement.js
// 問卷管理頁面
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import { useSurveyManagement } from '../hooks/useSurveyManagement';

function SurveyManagement() {
  const { token, userRole, accessProfile: ctxProfile } = useOutletContext();
  const {
    canViewSurvey,
    canExportSurveys,
    availableSurveys,
    selectedSurvey,
    setSelectedSurvey,
    surveyStats,
    surveyLoading,
    error,
    handleExportSurvey,
    loadSurveyStats,
  } = useSurveyManagement({ token, userRole, accessProfile: ctxProfile });

  if (!canViewSurvey) {
    return (
      <div className="alert alert-warning">
        <i className="fas fa-exclamation-triangle me-2"></i>
        您沒有權限訪問問卷管理功能，請聯繫管理員。
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-end align-items-center flex-wrap gap-3 mb-3">
        <div className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0">選擇問卷：</label>
            <select
              className="form-select"
              value={selectedSurvey}
              onChange={(e) => setSelectedSurvey(e.target.value)}
              style={{ minWidth: '300px' }}
            >
              {availableSurveys.map((survey) => (
                <option key={survey.id} value={survey.id}>{survey.name} (114-1)</option>
              ))}
            </select>
          </div>
          {canExportSurveys && (
            <button
              className="btn btn-outline-primary"
              onClick={() => handleExportSurvey(selectedSurvey)}
              disabled={surveyLoading[selectedSurvey]}
            >
              <i className="fas fa-download me-2"></i>匯出問卷資料
            </button>
          )}
          <button
            className="btn btn-outline-secondary"
            onClick={() => loadSurveyStats(selectedSurvey)}
            disabled={surveyLoading[selectedSurvey]}
          >
            <i className="fas fa-sync-alt me-2"></i>重新整理
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
        </div>
      )}

      {surveyLoading[selectedSurvey] ? (
        <p>載入中...</p>
      ) : surveyStats[selectedSurvey] ? (
        <div className="row">
          <div className="col-md-6">
            <Card>
              <Card.Header>
                <h5>基本統計</h5>
              </Card.Header>
              <Card.Body>
                <p><strong>總回應數：</strong>{surveyStats[selectedSurvey].totalResponses || 0}</p>
                <p><strong>最早回應：</strong>{surveyStats[selectedSurvey].earliestResponse ? new Date(surveyStats[selectedSurvey].earliestResponse).toLocaleString() : '尚無資料'}</p>
                <p><strong>最新回應：</strong>{surveyStats[selectedSurvey].latestResponse ? new Date(surveyStats[selectedSurvey].latestResponse).toLocaleString() : '尚無資料'}</p>
              </Card.Body>
            </Card>
          </div>

          <div className="col-md-6">
            <Card>
              <Card.Header>
                <h5>年級分布</h5>
              </Card.Header>
              <Card.Body>
                {surveyStats[selectedSurvey].gradeDistribution ? Object.entries(surveyStats[selectedSurvey].gradeDistribution).map(([grade, count]) => (
                  <p key={grade}><strong>{grade}：</strong>{count} 人</p>
                )) : <p>尚無資料</p>}
              </Card.Body>
            </Card>
          </div>

          <div className="col-12 mt-3">
            <Card>
              <Card.Header>
                <h5>參加次數統計</h5>
              </Card.Header>
              <Card.Body>
                {surveyStats.attendanceStats ? (
                  <>
                    <p><strong>最少次數：</strong>{surveyStats.attendanceStats.min}</p>
                    <p><strong>最多次數：</strong>{surveyStats.attendanceStats.max}</p>
                    <p><strong>平均次數：</strong>{surveyStats.attendanceStats.average}</p>
                  </>
                ) : <p>尚無資料</p>}
              </Card.Body>
            </Card>
          </div>

          <div className="col-12 mt-3">
            <Card>
              <Card.Header>
                <h5>各題平均分數</h5>
              </Card.Header>
              <Card.Body>
                <div className="row">
                  {surveyStats[selectedSurvey].questionAverages ? Object.entries(surveyStats[selectedSurvey].questionAverages).map(([question, average]) => {
                    const questionMap = {
                      q1: '流利談論個人經驗和意見',
                      q2: '給出詳細有趣的回答',
                      q3: '精準描述圖表訊息',
                      q4: '整理表達個人想法',
                      q5: '使用生活例子強化觀點',
                      q6: '連結課程與現實例子',
                      q7: '說英文更有自信',
                      q8: '不緊張害怕犯錯',
                      q9: '更願意用英文交談',
                      q10: '個人理由參加ET活動',
                      q11: '不同主題更有興趣',
                      q12: '計劃繼續參加ET',
                      q13: '總結主要想法',
                      q14: '主動尋求協助',
                      q15: '遵守輪流發言規範',
                      q16: '同儕主導模式幫助開口',
                      q17: 'ET氣氛佳互動性強',
                      q18: '整體提升口說技能',
                    };
                    return (
                      <div key={question} className="col-md-6 mb-3">
                        <div className="p-2 border rounded">
                          <strong className="text-primary">{questionMap[question] || question}：</strong>
                          <span className="ms-2 badge bg-success">{average}</span>
                        </div>
                      </div>
                    );
                  }) : <p>尚無資料</p>}
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      ) : (
        <p>尚無問卷資料</p>
      )}
    </>
  );
}

export default SurveyManagement;
