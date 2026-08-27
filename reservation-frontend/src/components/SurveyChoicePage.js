// 活動問卷選擇頁：學生可自選 English Table 或 English Club 問卷填寫
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, Spinner, Alert } from 'react-bootstrap';
import { useLanguage } from '../context/LanguageContext';
import { fetchEnabledSurveys } from '../services/surveyPublicApi';
import EmptyState from './ui/EmptyState';

function getEventTypeLabel(types, t) {
  const hasEt = types?.includes('English Table');
  const hasEc = types?.includes('English Club');
  if (hasEt && hasEc) return `${t('activities.englishTable')} / ${t('activities.englishClub')}`;
  if (hasEt) return t('activities.englishTable');
  if (hasEc) return t('activities.englishClub');
  return '';
}

export default function SurveyChoicePage() {
  const { t } = useLanguage();
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

  const renderEmpty = useCallback(() => (
    <div className="container mt-5">
      <EmptyState
        icon="📋"
        title={t('page.surveyEmptyTitle')}
        description={t('page.surveyEmptyDesc')}
        actions={
          <>
            <Link to="/events" className="btn btn-primary btn-sm">
              {t('page.surveyEmptyCtaEvents')}
            </Link>
            <Link to="/activities" className="btn btn-outline-primary btn-sm">
              {t('page.surveyEmptyCtaActivities')}
            </Link>
            <Link to="/" className="btn btn-outline-secondary btn-sm">
              {t('nav.home')}
            </Link>
          </>
        }
      />
    </div>
  ), [t]);

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
        <Link to="/events" className="btn btn-primary me-2">
          {t('page.surveyEmptyCtaEvents')}
        </Link>
        <Link to="/" className="btn btn-outline-secondary">
          {t('nav.home')}
        </Link>
      </div>
    );
  }

  if (list.length === 0) {
    return renderEmpty();
  }

  return (
    <div className="container mt-5">
      <Card>
        <Card.Header className="bg-primary text-white">
          <h4 className="mb-0">
            <i className="fas fa-clipboard-list me-2" />
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
                      <i className="fas fa-edit me-2" />
                      {item.surveyName}
                    </h5>
                    {getEventTypeLabel(item.relatedEventTypes, t) ? (
                      <small className="text-muted">{getEventTypeLabel(item.relatedEventTypes, t)}</small>
                    ) : null}
                  </Card.Body>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-4 d-flex flex-wrap gap-2">
            <Link to="/events" className="btn btn-outline-primary">
              {t('page.surveyEmptyCtaEvents')}
            </Link>
            <Link to="/" className="btn btn-outline-secondary">
              {t('nav.home')}
            </Link>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
