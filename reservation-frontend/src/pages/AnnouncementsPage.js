import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Pagination, Row, Col, Button } from 'react-bootstrap';
import { useLanguage } from '../context/LanguageContext';
import useAnnouncements from '../hooks/useAnnouncements';
import PageHeader from '../components/layout/PageHeader';
import { announcementDetailPath, truncateAnnouncementPreview } from '../services/announcementApi';
import StatusBadge from '../components/ui/StatusBadge';
import './AnnouncementsPage.css';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '../constants/announcementLabels';
import { formatDateYMD } from '../utils/announcementFormatters';

const PAGE_SIZE = 20;

export default function AnnouncementsPage() {
  const { t, lang } = useLanguage();
  const [qInput, setQInput] = useState('');
  const [catInput, setCatInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState({ q: '', category: '', tag: '' });

  const hookOpts = useMemo(
    () => ({
      limit: PAGE_SIZE,
      page,
      q: applied.q || undefined,
      category: applied.category || undefined,
      tag: applied.tag || undefined,
      sliceMax: null,
    }),
    [page, applied]
  );

  const { items, loading, error, retry, pagination } = useAnnouncements(hookOpts);

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.announcements') },
  ];

  const categoryLabels = useMemo(() => {
    if (lang === 'en') {
      return {
        general: 'General',
        activity: 'Activity',
        policy: 'Policy',
        system: 'System',
        emergency: 'Emergency',
      };
    }
    return ANNOUNCEMENT_CATEGORY_LABELS;
  }, [lang]);

  const onApplyFilters = (e) => {
    e?.preventDefault?.();
    setApplied({
      q: qInput.trim(),
      category: catInput.trim(),
      tag: tagInput.trim(),
    });
    setPage(1);
  };

  const onResetFilters = () => {
    setQInput('');
    setCatInput('');
    setTagInput('');
    setApplied({ q: '', category: '', tag: '' });
    setPage(1);
  };

  return (
    <div className="announcements-page">
      <div className="announcements-hero">
        <div className="container">
          <PageHeader
            variant="editorial"
            breadcrumbs={breadcrumbs}
            eyebrow={t('nav.announcements')}
            title={t('homePage.announcementsTitle')}
            lead={t('announcementsPage.heroLead')}
          />
          <div className="announcements-hero-hints" aria-label="公告提示">
            <div className="announcements-hero-hint-item">
              <StatusBadge variant="warning" size="md">{t('announcementsPage.hintPinned')}</StatusBadge>
              <span className="text-muted">{t('announcementsPage.hintPinnedDesc')}</span>
            </div>
            <div className="announcements-hero-hint-item">
              <StatusBadge variant="neutral" size="md">{t('announcementsPage.hintCategory')}</StatusBadge>
              <span className="text-muted">{t('announcementsPage.hintCategoryDesc')}</span>
            </div>
            <div className="announcements-hero-hint-item">
              <StatusBadge variant="info" size="md">{t('announcementsPage.hintPublished')}</StatusBadge>
              <span className="text-muted">{t('announcementsPage.hintPublishedDesc')}</span>
            </div>
          </div>
        </div>
      </div>

      <Form className="announcements-toolbar" onSubmit={onApplyFilters}>
        <Row className="g-2 align-items-end">
          <Col md={4}>
            <Form.Label className="small mb-1">{t('announcementsPage.filterSearch')}</Form.Label>
            <Form.Control
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder={t('announcementsPage.filterSearchPlaceholder')}
            />
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1">{t('announcementsPage.filterCategory')}</Form.Label>
            <Form.Select value={catInput} onChange={(e) => setCatInput(e.target.value)}>
              <option value="">{t('announcementsPage.filterCategoryAll')}</option>
              {Object.entries(categoryLabels).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1">{t('announcementsPage.filterTag')}</Form.Label>
            <Form.Control
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder={t('announcementsPage.filterTagPlaceholder')}
            />
          </Col>
          <Col md={2} className="d-flex gap-1">
            <Button type="submit" variant="dark" size="sm">
              {t('announcementsPage.filterApply')}
            </Button>
            <Button type="button" variant="outline-secondary" size="sm" onClick={onResetFilters}>
              {t('announcementsPage.filterReset')}
            </Button>
          </Col>
        </Row>
      </Form>

      {loading && (
        <div className="announcements-page-loading" aria-busy="true" aria-live="polite">
          <div className="announcements-page-skeleton-list">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} lines={3} titleHeight={16} />
            ))}
          </div>
          <p className="mt-2 text-muted">{t('home.loading')}</p>
        </div>
      )}
      {!loading && error && (
        <EmptyState
          icon="⚠️"
          title={t('homePage.announcementsError')}
          description={error}
          actions={
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={retry}>
                重新嘗試
              </button>
              <Link to="/" className="btn btn-outline-primary btn-sm">
                {t('homePage.announcementsEmptyBack')}
              </Link>
            </>
          }
        />
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="announcements-list">
          {items.map((item) => {
            const displayCategory = item.category || 'general';
            const coverAlt = item.coverImageAlt || item.title || t('nav.announcements');
            return (
              <li key={item.id}>
                <Link to={announcementDetailPath(item)} className="announcement-card-link">
                  <article className="announcement-card">
                    <div className="d-flex flex-column flex-md-row gap-3 h-100">
                      <div className="announcement-list-cover flex-shrink-0">
                        {item.coverImage ? (
                          <img
                            src={item.coverImage}
                            alt={coverAlt}
                            className="rounded border announcement-card-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="announcement-card-cover announcement-card-cover--placeholder" aria-hidden="true">
                            <span className="announcement-card-cover__label">{t('nav.announcements')}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-grow-1 d-flex flex-column">
                        <p className="announcement-meta">
                          <span>{formatDateYMD(item.date || item.publishedAt)}</span>
                          <span className="visually-hidden">發布日期</span>
                          {displayCategory ? (
                            <StatusBadge variant="neutral" size="sm" className="ms-1">
                              {categoryLabels[displayCategory] || displayCategory}
                            </StatusBadge>
                          ) : null}
                          {item.isPinned ? (
                            <StatusBadge variant="warning" size="sm" className="ms-1">
                              {t('announcementsPage.badgePinned')}
                            </StatusBadge>
                          ) : null}
                        </p>

                        <h2 className="announcement-title" title={item.title}>
                          {item.title}
                        </h2>

                        {item.summary ? (
                          <p className="announcement-summary" title={item.summary}>
                            {truncateAnnouncementPreview(item.summary, 120)}
                          </p>
                        ) : null}

                        <div className="announcement-readmore-row mt-auto">
                          <span className="announcement-readmore btn btn-sm btn-outline-primary">
                            {t('homePage.readMore')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="🗞️"
          title={t('homePage.noAnnouncements')}
          description={t('announcementsPage.emptyDescription')}
          actions={
            <>
              <Link to="/" className="btn btn-outline-primary btn-sm">
                {t('homePage.announcementsEmptyBack')}
              </Link>
              <Link to="/activities" className="btn btn-primary btn-sm ms-2">
                {t('homePage.announcementsEmptyActivities')}
              </Link>
            </>
          }
        />
      )}

      {!loading && !error && pagination.totalPages > 1 && (
        <Pagination className="justify-content-center mt-4 flex-wrap">
          <Pagination.Prev disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
          <Pagination.Item active>
            {pagination.page} / {pagination.totalPages}
          </Pagination.Item>
          <Pagination.Next
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          />
        </Pagination>
      )}
    </div>
  );
}
