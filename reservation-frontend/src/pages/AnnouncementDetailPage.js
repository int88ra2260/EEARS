import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import { formatMessage } from '../utils/formatMessage';
import { fetchPublicAnnouncement, normalizeAnnouncementItem } from '../services/announcementApi';
import './AnnouncementDetailPage.css';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '../constants/announcementLabels';
import { formatDateTimeYMDHM, formatDateYMD } from '../utils/announcementFormatters';
import SkeletonCard from '../components/ui/SkeletonCard';
import {
  parseAnnouncementBodyBlocks,
  renderLinesWithBreaks,
} from '../utils/parseAnnouncementBodyBlocks';

function ProseParagraph({ text }) {
  const lines = renderLinesWithBreaks(text);
  return (
    <p>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </React.Fragment>
      ))}
    </p>
  );
}

function AnnouncementBody({ content, summary }) {
  const blocks = parseAnnouncementBodyBlocks(content || summary || '');
  if (!blocks.length) return null;

  return (
    <div className="announcement-detail-body">
      {blocks.map((block, idx) => {
        if (block.type === 'paragraphs') {
          return (
            <div key={`p-${idx}`} className="announcement-detail-prose">
              <ProseParagraph text={block.text} />
            </div>
          );
        }

        if (block.type === 'decision') {
          return (
            <section key={`d-${idx}`} className="announcement-detail-decision" aria-labelledby={`ann-decision-${idx}`}>
              <h2 id={`ann-decision-${idx}`} className="announcement-detail-decision__title">
                {block.title}
              </h2>
              <ul className="announcement-detail-decision__list">
                {(block.items || []).map((item, i) => (
                  <li key={i} className="announcement-detail-decision__item">
                    {item.caseLabel ? (
                      <span className="announcement-detail-decision__case">{item.caseLabel}</span>
                    ) : null}
                    <span className="announcement-detail-decision__action">{item.actionText}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        if (block.type === 'changelog') {
          return (
            <aside key={`c-${idx}`} className="announcement-detail-changelog" aria-labelledby={`ann-log-${idx}`}>
              <h2 id={`ann-log-${idx}`} className="announcement-detail-changelog__title">
                {block.title}
              </h2>
              <ol className="announcement-detail-changelog__list">
                {(block.items || []).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </aside>
          );
        }

        if (block.type === 'section') {
          return (
            <section key={`s-${idx}`} className="announcement-detail-prose">
              <h2 className="announcement-detail-section-title">{block.title}</h2>
              {block.text ? <ProseParagraph text={block.text} /> : null}
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}

export default function AnnouncementDetailPage() {
  const { idOrSlug } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setItem(null);

    fetchPublicAnnouncement(idOrSlug)
      .then((data) => {
        if (!cancelled) {
          setItem(normalizeAnnouncementItem(data));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.code === 'NOT_FOUND') {
          setNotFound(true);
        } else {
          setError(err.message || t('homePage.announcementsError'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idOrSlug, t]);

  useEffect(() => {
    if (!item) return;
    if (item.canonicalSlug && String(idOrSlug) !== String(item.canonicalSlug)) {
      navigate(`/announcements/${encodeURIComponent(item.canonicalSlug)}`, { replace: true });
    }
  }, [item, idOrSlug, navigate]);

  useEffect(() => {
    if (!item) return;
    const slugSeg = item.slug != null && item.slug !== '' ? item.slug : item.id;
    const path = `/announcements/${encodeURIComponent(String(slugSeg))}`;
    const pageTitle = `${item.title} | EEARS`;
    document.title = pageTitle;
    const desc = item.seoDescription || item.summary || '';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && desc) metaDesc.setAttribute('content', String(desc).slice(0, 300));
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', pageTitle);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && desc) ogDesc.setAttribute('content', String(desc).slice(0, 300));
    const ogImg = document.querySelector('meta[property="og:image"]');
    const img = item.ogImageUrl || item.coverImage;
    if (ogImg && img) ogImg.setAttribute('content', img);
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', `${window.location.origin}${path}`);
    return () => {
      document.title = 'EEARS｜中山大學全英語卓越教學中心';
    };
  }, [item]);

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setCopyDone(false);
    }
  };

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.announcements'), path: '/announcements' },
    { label: item ? item.title : t('homePage.readMore') },
  ];

  if (loading) {
    return (
      <div className="announcement-detail-page">
        <div className="announcement-detail-loading">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2">{t('home.loading')}</p>
          <div className="mt-3" aria-hidden="true">
            <SkeletonCard lines={4} titleHeight={18} />
            <div style={{ height: 12 }} />
            <SkeletonCard lines={7} titleHeight={14} />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || (!item && !error)) {
    return (
      <div className="announcement-detail-page">
        <PageHeader
          breadcrumbs={[
            { label: t('nav.home'), path: '/' },
            { label: t('nav.announcements'), path: '/announcements' },
          ]}
          title={t('nav.announcements')}
        />
        <div className="announcement-detail-error">
          <p>{t('homePage.announcementNotFound')}</p>
          <Link to="/announcements" className="btn btn-primary">
            {t('homePage.backToAnnouncementsList')}
          </Link>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="announcement-detail-page">
        <PageHeader
          breadcrumbs={[
            { label: t('nav.home'), path: '/' },
            { label: t('nav.announcements'), path: '/announcements' },
          ]}
          title={t('nav.announcements')}
        />
        <div className="announcement-detail-error">
          <p>{error || t('homePage.announcementsError')}</p>
          <Link to="/announcements" className="btn btn-outline-primary btn-sm">
            {t('homePage.backToAnnouncementsList')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="announcement-detail-page">
      <PageHeader breadcrumbs={breadcrumbs} title={item.title} />
      <div className="announcement-detail-toolbar">
        <Link to="/announcements" className="btn btn-sm btn-outline-secondary announcement-detail-toolbar__back">
          {t('homePage.backToAnnouncementsList')}
        </Link>
        <button
          type="button"
          className="announcement-detail-toolbar__copy"
          onClick={copyLink}
        >
          {copyDone ? t('announcementsPage.copyLinkDone') : t('announcementsPage.copyLink')}
        </button>
      </div>
      <article className="announcement-detail-article">
        <div className="announcement-detail-meta">
          <span className="announcement-detail-meta__item">
            <span className="announcement-detail-meta__label">日期</span>
            <span>{formatDateYMD(item.date || item.publishedAt)}</span>
          </span>
          {item.readingMinutes ? (
            <span className="announcement-detail-meta__item">
              <span className="announcement-detail-meta__label">閱讀</span>
              <span>{formatMessage(t('announcementsPage.readingMinutes'), { minutes: item.readingMinutes })}</span>
            </span>
          ) : null}
          {item.authorName ? (
            <span className="announcement-detail-meta__item">
              <span className="announcement-detail-meta__label">作者</span>
              <span>{item.authorName}</span>
            </span>
          ) : null}
          {item.updatedAt ? (
            <span className="announcement-detail-meta__item">
              <span className="announcement-detail-meta__label">{t('announcementsPage.updatedAt')}</span>
              <span>{formatDateTimeYMDHM(item.updatedAt)}</span>
            </span>
          ) : null}
        </div>

        <div className="announcement-detail-flags">
          {item.category ? (
            <span className="announcement-detail-chip announcement-detail-chip--category">
              {ANNOUNCEMENT_CATEGORY_LABELS[item.category] || item.category}
            </span>
          ) : null}
          {item.isPinned ? (
            <span className="announcement-detail-chip announcement-detail-chip--pinned">
              {t('announcementsPage.badgePinned')}
            </span>
          ) : null}
        </div>

        {Array.isArray(item.tags) && item.tags.length > 0 ? (
          <div className="announcement-detail-topics" aria-label="主題標籤">
            {item.tags.map((tg) => (
              <span key={tg} className="announcement-detail-topic">
                {tg}
              </span>
            ))}
          </div>
        ) : null}

        {item.coverImage ? (
          <div className="announcement-detail-cover">
            <img
              src={item.coverImage}
              alt={item.coverImageAlt || item.title || ''}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        ) : null}

        <AnnouncementBody content={item.content} summary={item.summary} />

        <div className="announcement-detail-actions d-flex flex-wrap gap-2 align-items-center">
          <Link to="/announcements" className="btn btn-outline-secondary">
            {t('homePage.backToAnnouncementsList')}
          </Link>
          {item.category === 'activity' ? (
            <Link to="/activities" className="btn btn-primary">
              {t('announcementsPage.goBookActivity')}
            </Link>
          ) : null}
        </div>
      </article>
    </div>
  );
}
