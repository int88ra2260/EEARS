import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spinner } from 'react-bootstrap';
import ActivityFeedbackForm from '../components/feedback/ActivityFeedbackForm';
import { ACTIVITY_FEEDBACK_SURVEY_KEY, markActivityFeedbackSubmitted } from '../constants/activityFeedback';
import { fetchPublicSurvey, submitPublicSurvey } from '../services/surveyPublicApi';
import { useLanguage } from '../context/LanguageContext';

export default function ActivityFeedbackSurveyPage() {
  const { isZh } = useLanguage();
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPublicSurvey(ACTIVITY_FEEDBACK_SURVEY_KEY);
        if (!cancelled) setSchema(data.survey);
      } catch (err) {
        if (!cancelled) setError(err?.message || '問卷暫時無法載入');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (answers) => {
    const result = await submitPublicSurvey(ACTIVITY_FEEDBACK_SURVEY_KEY, answers);
    if (!result.ok) {
      throw new Error(result.data?.message || result.data?.error || '送出失敗，請稍後再試。');
    }
    markActivityFeedbackSubmitted();
    setDone(true);
  };

  if (loading) {
    return (
      <div className="py-5 text-center" role="status">
        <Spinner animation="border" size="sm" className="me-2" />
        載入問卷…
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (done) {
    return (
      <div className="activity-feedback">
        <Alert variant="success">
          <Alert.Heading>問卷已送出</Alert.Heading>
          <p className="mb-0">謝謝你的回饋。這份意見只做整體改進，不會影響預約。</p>
        </Alert>
        <Link to="/" className="btn btn-primary">回首頁</Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="h4 mb-3">{schema?.title || '增能活動與網站問卷'}</h1>
      {isZh ? null : (
        <p className="text-muted">This survey is written in Chinese. It does not affect reservations.</p>
      )}
      <ActivityFeedbackForm schema={schema} onSubmit={handleSubmit} />
    </>
  );
}
