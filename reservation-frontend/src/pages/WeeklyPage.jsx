import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from 'react-bootstrap';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import WeeklyBlockRenderer from '../components/weekly/WeeklyBlockRenderer';
import WordBridgeWeeklyChallenge from '../components/weekly/WordBridgeWeeklyChallenge';
import { extractModalTeaser } from '../constants/weeklyBlocks';
import { fetchCurrentWeeklyReport, fetchWeeklyReportByKey, fetchWeeklyReportList } from '../services/weeklyReportApi';
import useWeeklyReadProgress from '../hooks/useWeeklyReadProgress';
import { hasWeeklyRead } from '../utils/weeklyVoter';
import { scrollToPageTop } from '../utils/scrollToPageTop';
import './WeeklyPage.css';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) return vars.default || key;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

function paragraphsFromText(text) {
  if (!text) return [];
  return String(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function LegacyWeeklyLayout({ weekly, t }) {
  const editorialParagraphs = paragraphsFromText(weekly?.editorial);
  return (
    <>
      {editorialParagraphs.length > 0 ? (
        <section className="weekly-page__section public-card" aria-labelledby="weekly-editorial">
          <h2 id="weekly-editorial" className="weekly-page__section-title">
            {t('weekly.editorialTitle')}
          </h2>
          {editorialParagraphs.map((para) => (
            <p key={para.slice(0, 24)} className="weekly-page__paragraph">
              {para}
            </p>
          ))}
        </section>
      ) : null}

      {weekly.learningTip ? (
        <section className="weekly-page__section public-card" aria-labelledby="weekly-tip">
          <h2 id="weekly-tip" className="weekly-page__section-title">
            {t('weekly.tipLabel')}
          </h2>
          <p className="weekly-page__paragraph mb-0">{weekly.learningTip}</p>
        </section>
      ) : null}

      <section className="weekly-page__section public-card" aria-labelledby="weekly-challenge">
        <h2 id="weekly-challenge" className="weekly-page__section-title">
          {t('weekly.challengeTitle')}
        </h2>
        <WordBridgeWeeklyChallenge
          level={weekly.wordBridgeLevel}
          themeIds={weekly.wordBridgeThemeIds}
        />
      </section>

      <section className="weekly-page__cta">
        <Link to="/events" className="btn btn-primary">
          {t('weekly.bookCta')}
        </Link>
        <Link to="/activities" className="btn btn-outline-secondary">
          {t('weekly.activitiesCta')}
        </Link>
      </section>
    </>
  );
}

export default function WeeklyPage() {
  const { issueKey: routeKey } = useParams();
  const { t } = useLanguage();
  const [weekly, setWeekly] = useState(null);
  const [archive, setArchive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = routeKey
          ? await fetchWeeklyReportByKey(routeKey)
          : await fetchCurrentWeeklyReport();
        if (!cancelled) setWeekly(data);
      } catch {
        if (!cancelled) {
          setWeekly(null);
          setError(t('weekly.loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeKey, t]);

  useEffect(() => {
    if (routeKey) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchWeeklyReportList({ limit: 24 });
        if (!cancelled) setArchive(data.items || []);
      } catch {
        if (!cancelled) setArchive([]);
      }
    })();
    return () => { cancelled = true; };
  }, [routeKey]);

  useEffect(() => {
    if (loading || !weekly) return undefined;
    scrollToPageTop();
    const frame = requestAnimationFrame(() => scrollToPageTop());
    return () => cancelAnimationFrame(frame);
  }, [loading, weekly?.issueKey, routeKey]);

  const hasBlocks = Array.isArray(weekly?.blocks) && weekly.blocks.length > 0;
  const pageTitle = useMemo(() => {
    if (!weekly) return t('weekly.title');
    const hero = weekly.blocks?.find((b) => b.type === 'hero');
    return hero?.props?.title || weekly.title || t('weekly.title');
  }, [weekly, t]);

  const pageLead = useMemo(() => {
    if (!weekly) return t('weekly.pageLead');
    if (hasBlocks) {
      const teaser = extractModalTeaser(weekly.blocks);
      return teaser.headline || t('weekly.pageLead');
    }
    return weekly.headline || t('weekly.pageLead');
  }, [weekly, hasBlocks, t]);

  const weeklySlug = weekly?.slug || weekly?.issueKey || '';
  useWeeklyReadProgress({ slug: weeklySlug, enabled: Boolean(weekly && !loading && !error) });
  const readDone = weeklySlug ? hasWeeklyRead(weeklySlug) : false;

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('weekly.title') },
  ];

  return (
    <div className="weekly-page public-site">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={pageTitle}
        lead={pageLead}
      />

      {loading ? (
        <p className="text-muted">{t('home.loading')}</p>
      ) : error ? (
        <Alert variant="warning">{error}</Alert>
      ) : weekly ? (
        <>
          <p className="weekly-page__meta">
            {formatMessage(t, 'weekly.issueLabel', { issue: weekly.issueKey })}
            {weekly.weekStart && weekly.weekEnd ? (
              <>
                {' · '}
                {weekly.weekStart} – {weekly.weekEnd}
              </>
            ) : null}
            {readDone ? (
              <span className="weekly-page__read-badge">{t('weekly.readComplete')}</span>
            ) : null}
          </p>

          {hasBlocks ? (
            <WeeklyBlockRenderer
              blocks={weekly.blocks}
              mode="page"
              weeklySlug={weeklySlug}
              issueKey={weekly.issueKey}
            />
          ) : (
            <LegacyWeeklyLayout weekly={weekly} t={t} />
          )}

          {!routeKey && archive.length > 0 ? (
            <section className="weekly-page__archive public-card mt-4">
              <h2 className="weekly-page__section-title">{t('weekly.archiveTitle')}</h2>
              <ul className="weekly-page__archive-list list-unstyled mb-0">
                {archive.map((item) => (
                  <li key={item.id}>
                    <Link to={`/weekly/${item.slug || item.issueKey}`} className="weekly-page__archive-link">
                      <span className="weekly-page__archive-issue">{item.issueKey}</span>
                      <span className="weekly-page__archive-title">{item.title}</span>
                      {item.weekStart && item.weekEnd ? (
                        <span className="weekly-page__archive-dates text-muted small">
                          {item.weekStart} – {item.weekEnd}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <Alert variant="info">{t('weekly.empty')}</Alert>
      )}
    </div>
  );
}
