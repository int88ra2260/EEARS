import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from 'react-bootstrap';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import WeeklyBlockRenderer from '../components/weekly/WeeklyBlockRenderer';
import { fetchWeeklyPreview } from '../services/weeklyReportApi';
import { scrollToPageTop } from '../utils/scrollToPageTop';
import './WeeklyPage.css';

export default function WeeklyPreviewPage() {
  const { token } = useParams();
  const { t } = useLanguage();
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchWeeklyPreview(token);
        if (!cancelled) setWeekly(data);
      } catch {
        if (!cancelled) {
          setWeekly(null);
          setError(t('weekly.previewError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, t]);

  useEffect(() => {
    if (loading || !weekly) return undefined;
    scrollToPageTop();
    const frame = requestAnimationFrame(() => scrollToPageTop());
    return () => cancelAnimationFrame(frame);
  }, [loading, weekly?.issueKey, token]);

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('weekly.title'), path: '/weekly' },
    { label: t('weekly.previewTitle') },
  ];

  return (
    <div className="weekly-page public-site">
      <PageHeader breadcrumbs={breadcrumbs} title={t('weekly.previewTitle')} />
      <Alert variant="warning" className="weekly-page__preview-banner">
        {t('weekly.previewBanner')}
      </Alert>
      {loading ? (
        <p className="text-muted">{t('home.loading')}</p>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : weekly ? (
        <>
          <p className="weekly-page__meta">
            <code>{weekly.issueKey}</code>
            {weekly.status === 'draft' ? ` · ${t('weekly.previewDraft')}` : null}
          </p>
          <WeeklyBlockRenderer
            blocks={weekly.blocks}
            mode="page"
            weeklySlug={weekly.slug || weekly.issueKey}
            issueKey={weekly.issueKey}
          />
          <div className="weekly-page__cta mt-3">
            <Link to="/" className="btn btn-outline-secondary">{t('nav.home')}</Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
