// 活動問卷選擇頁：學生可自選 English Table 或 English Club 問卷填寫
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, Spinner, Alert } from 'react-bootstrap';
import { useLanguage } from '../context/LanguageContext';
import { fetchEnabledSurveys, fetchMySemesterSurveys } from '../services/surveyPublicApi';
import { loadStudentSession } from '../utils/studentSession';
import EmptyState from './ui/EmptyState';
import SurveyExitActions from './survey/SurveyExitActions';

function getEventTypeLabel(types, t) {
  const set = new Set((types || []).map((x) => String(x || '').trim().toLowerCase()));
  const hasEt = ['english_table', 'english table', 'et'].some((k) => set.has(k));
  const hasEc = ['english_club', 'english club', 'ec'].some((k) => set.has(k));
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
        const session = loadStudentSession();
        if (session?.student) {
          const mine = await fetchMySemesterSurveys();
          setList(mine.surveys || []);
        } else {
          const data = await fetchEnabledSurveys();
          setList(data);
        }
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
        icon="list"
        title={t('page.surveyEmptyTitle')}
        description={t('page.surveyEmptyDesc')}
        actions={
          <>
            <SurveyExitActions
              showEvents
              eventsLabel={t('page.surveyEmptyCtaEvents')}
              showHome
              homeLabel={t('nav.home')}
            />
            <Link to="/activities" className="btn btn-outline-primary btn-sm">
              {t('page.surveyEmptyCtaActivities')}
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
        <SurveyExitActions
          showEvents
          eventsLabel={t('page.surveyEmptyCtaEvents')}
          showHome
          homeLabel={t('nav.home')}
        />
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
            本學期問卷 / Surveys
          </h4>
        </Card.Header>
        <Card.Body>
          <p className="text-muted mb-3">
            請選擇要填寫的問卷。這個學期已經簽到參加過 English Table 或 English Club 的同學，下半學期再次預約同一類活動前要先填問卷；還沒簽到參加過的不用填。
          </p>
          <div className="mb-4">
            <SurveyExitActions
              showEvents
              eventsLabel={t('page.surveyEmptyCtaEvents')}
              showHome
              homeLabel={t('nav.home')}
            />
          </div>
          <div className="d-flex flex-column flex-md-row gap-3 flex-wrap">
            {list.map((item) => (
              <Link
                key={item.surveyId}
                to={`/survey/${item.surveyId}`}
                state={{ surveyReturnTo: '/survey/choice' }}
                className="text-decoration-none"
                style={{ flex: '1 1 200px' }}
              >
                <Card className="h-100 border-primary hover-shadow" style={{ transition: 'box-shadow 0.2s' }}>
                  <Card.Body>
                    <h5 className="text-primary">
                      <i className="fas fa-edit me-2" />
                      {item.surveyName}
                    </h5>
                    {item.statusLabel ? (
                      <div className="mb-1">
                        <span className={`badge ${item.filled ? 'text-bg-success' : 'text-bg-warning'}`}>
                          {item.statusLabel}
                        </span>
                      </div>
                    ) : null}
                    {getEventTypeLabel(item.relatedEventTypes, t) ? (
                      <small className="text-muted">{getEventTypeLabel(item.relatedEventTypes, t)}</small>
                    ) : (
                      <small className="text-muted">
                        {item.channel === 'standalone' ? '獨立／首頁問卷' : ''}
                      </small>
                    )}
                  </Card.Body>
                </Card>
              </Link>
            ))}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
