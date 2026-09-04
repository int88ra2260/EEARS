import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import { formatMessage } from '../utils/formatMessage';
import { fetchPublicAnnouncement, normalizeAnnouncementItem } from '../services/announcementApi';
import './AnnouncementDetailPage.css';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '../constants/announcementLabels';
import { formatDateTimeYMDHM, formatDateYMD } from '../utils/announcementFormatters';
import SkeletonCard from '../components/ui/SkeletonCard';

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

  const renderAnnouncementBody = (text) => {
    const raw = String(text || '');
    if (!raw.trim()) return null;

    // 允許「段落換行（空行分段）」與「段內換行（換行插入 br）」。
    const paragraphs = raw.split(/\n{2,}/).filter((p) => p.trim().length > 0);
    if (paragraphs.length === 0) return null;

    return paragraphs.map((p, idx) => {
      const lines = p.split('\n');
      return (
        <p key={idx}>
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <br /> : null}
              {line}
            </React.Fragment>
          ))}
        </p>
      );
    });
  };

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
      <div className="announcement-detail-toolbar d-flex flex-wrap gap-2 align-items-center">
        <Link to="/announcements" className="btn btn-sm btn-outline-primary">
          ← {t('homePage.backToAnnouncementsList')}
        </Link>
        <Button type="button" size="sm" variant="outline-secondary" onClick={copyLink}>
          {copyDone ? t('announcementsPage.copyLinkDone') : t('announcementsPage.copyLink')}
        </Button>
      </div>
      <article className="announcement-detail-article">
        <p className="announcement-detail-meta d-flex flex-wrap align-items-center gap-2">
          <span>{formatDateYMD(item.date || item.publishedAt)}</span>
          {item.readingMinutes ? (
            <span className="text-muted">
              · {formatMessage(t('announcementsPage.readingMinutes'), { minutes: item.readingMinutes })}
            </span>
          ) : null}
          {item.authorName ? <span className="text-muted">· {item.authorName}</span> : null}
          {item.updatedAt ? (
            <span className="text-muted">
              · {t('announcementsPage.updatedAt')} {formatDateTimeYMDHM(item.updatedAt)}
            </span>
          ) : null}
          {item.category ? (
            <StatusBadge variant="neutral" size="sm">
              {ANNOUNCEMENT_CATEGORY_LABELS[item.category] || item.category}
            </StatusBadge>
          ) : null}
          {item.isPinned ? (
            <StatusBadge variant="warning" size="sm">
              {t('announcementsPage.badgePinned')}
            </StatusBadge>
          ) : null}
        </p>
        {Array.isArray(item.tags) && item.tags.length > 0 ? (
          <p className="mb-3">
            {item.tags.map((tg) => (
              <StatusBadge key={tg} variant="neutral" size="sm" className="me-1">
                {tg}
              </StatusBadge>
            ))}
          </p>
        ) : null}
        {item.coverImage ? (
          <div className="announcement-detail-cover mb-3">
            <img
              src={item.coverImage}
              alt={item.coverImageAlt || item.title || ''}
              className="img-fluid rounded border"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        ) : null}
        <div className="announcement-detail-body">{renderAnnouncementBody(item.content || item.summary || '')}</div>

        <div className="announcement-detail-actions mt-4 d-flex flex-wrap gap-2 align-items-center">
          <Link to="/announcements" className="btn btn-outline-secondary">
            ← {t('homePage.backToAnnouncementsList')}
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
