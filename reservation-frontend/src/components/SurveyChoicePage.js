// 活動問卷選擇頁：學生可自選 English Table 或 English Club 問卷填寫
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Spinner, Alert } from 'react-bootstrap';
import { useLanguage } from '../context/LanguageContext';
import { fetchEnabledSurveys } from '../services/surveyPublicApi';

export default function SurveyChoicePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEnabled = async () => {
      try {
        const data = await fetchEnabledSurveys();
        setList(data);
      } catch (e) {
        setError(e.message || '載入失敗');
      } finally {
        setLoading(false);
      }
    };
    fetchEnabled();
  }, []);

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <Spinner animation="border" />
        <p className="mt-2">{t('home.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <Alert variant="danger">{error}</Alert>
        <Link to="/" className="btn btn-primary">返回首頁</Link>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="container mt-5">
        <Alert variant="info">
          目前沒有開放中的活動問卷，請稍後再試或返回首頁進行預約。
        </Alert>
        <Link to="/" className="btn btn-primary">返回首頁</Link>
      </div>
    );
  }

  const getEventTypeLabel = (types) => {
    if (types && types.includes('English Table') && types.includes('English Club')) return 'English Table / English Club';
    if (types && types.includes('English Table')) return 'English Table';
    if (types && types.includes('English Club')) return 'English Club';
    return '';
  };

  return (
    <div className="container mt-5">
      <Card>
        <Card.Header className="bg-primary text-white">
          <h4 className="mb-0">
            <i className="fas fa-clipboard-list me-2"></i>
            活動問卷 / Activity Survey
          </h4>
        </Card.Header>
        <Card.Body>
          <p className="text-muted mb-4">
            請選擇要填寫的問卷（期中考後參加 English Table 或 English Club 活動需先填寫對應問卷才能預約）。
          </p>
          <div className="d-flex flex-column flex-md-row gap-3 flex-wrap">
            {list.map((item) => (
              <Link
                key={item.surveyId}
                to={`/survey/${item.surveyId}`}
                className="text-decoration-none"
                style={{ flex: '1 1 200px' }}
              >
                <Card className="h-100 border-primary hover-shadow" style={{ transition: 'box-shadow 0.2s' }}>
                  <Card.Body>
                    <h5 className="text-primary">
                      <i className="fas fa-edit me-2"></i>
                      {item.surveyName}
                    </h5>
                    {getEventTypeLabel(item.relatedEventTypes) && (
                      <small className="text-muted">{getEventTypeLabel(item.relatedEventTypes)}</small>
                    )}
                  </Card.Body>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/')}>
              <i className="fas fa-home me-2"></i>
              返回首頁
            </button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
