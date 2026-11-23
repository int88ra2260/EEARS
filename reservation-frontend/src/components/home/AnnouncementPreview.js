import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ContentText from '../siteContent/ContentText';
import useAnnouncements from '../../hooks/useAnnouncements';
import { announcementDetailPath, truncateAnnouncementPreview } from '../../services/announcementApi';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '../../constants/announcementLabels';
import { formatDateYMD } from '../../utils/announcementFormatters';
import './home.css';

function sortAnnouncements(items) {
  return [...items].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return b.isPinned ? 1 : -1;
    }
    const aTime = new Date(a.date || a.publishedAt || 0).getTime();
    const bTime = new Date(b.date || b.publishedAt || 0).getTime();
    return bTime - aTime;
  });
}

function splitAnnouncementDate(dateStr) {
  const formatted = formatDateYMD(dateStr);
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(formatted);
  if (!match) return { formatted, year: '', month: '', day: '' };
  return { formatted, year: match[1], month: match[2], day: match[3] };
}

export default function AnnouncementPreview() {
  const { items, loading, error } = useAnnouncements(4);
  const sortedItems = useMemo(() => sortAnnouncements(items), [items]);

  return (
    <section
      id="announcements"
      className="home-section home-section--announcements"
      aria-labelledby="announcements-title"
    >
      <div className="home-shell home-reveal">
        <header className="home-section__header home-section__header--split">
          <div>
            <ContentText k="homePage.announcementsKicker" as="p" className="home-kicker home-kicker--section" />
            <ContentText
              k="homePage.announcementsTitle"
              as="h2"
              id="announcements-title"
              className="home-section__title"
            />
            <ContentText k="homePage.announcementsLead" as="p" className="home-section__lead" />
          </div>
          <Link to="/announcements" className="home-btn home-btn--outline home-section__header-action">
            <ContentText k="homePage.viewAllAnnouncements" />
          </Link>
        </header>

        {loading && (
          <div className="home-announce-board" aria-busy="true" aria-live="polite">
            {[1, 2, 3].map((i) => (
              <div key={i} className="home-announce-card home-announce-card--skeleton">
                <div className="home-skeleton home-skeleton--meta" />
                <div>
                  <div className="home-skeleton home-skeleton--title" />
                  <div className="home-skeleton home-skeleton--body" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="home-empty-state">
            <p><ContentText k="homePage.announcementsError" /></p>
            <div className="home-empty-state__actions">
              <Link to="/" className="home-btn home-btn--ghost">
                <ContentText k="homePage.announcementsEmptyBack" />
              </Link>
              <Link to="/activities" className="home-btn home-btn--solid">
                <ContentText k="homePage.announcementsEmptyActivities" />
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && sortedItems.length > 0 && (
          <div className="home-announce-board">
            {sortedItems.map((item, index) => {
              const date = splitAnnouncementDate(item.date);
              const lead = index === 0;
              return (
                <Link
                  key={item.id}
                  to={announcementDetailPath(item)}
                  className={[
                    'home-announce-card-link',
                    lead ? 'home-announce-card-link--lead' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <article className={`home-announce-card${item.coverImage ? ' home-announce-card--has-cover' : ''}`}>
                    <time className="home-announce-card__date" dateTime={item.date || undefined}>
                      {date.day ? (
                        <>
                          <span className="home-announce-card__day">{date.month}/{date.day}</span>
                          <span className="home-announce-card__year">{date.year}</span>
                        </>
                      ) : (
                        <span className="home-announce-card__day">{date.formatted}</span>
                      )}
                    </time>
                    <div className="home-announce-card__content">
                      <div className="home-announce-card__meta">
                        {item.category ? (
                          <span className="home-tag home-tag--neutral">
                            {ANNOUNCEMENT_CATEGORY_LABELS[item.category] || item.category}
                          </span>
                        ) : null}
                        {item.isPinned ? (
                          <span className="home-tag home-tag--yellow">
                            <ContentText k="homePage.pinnedBadge" />
                          </span>
                        ) : null}
                      </div>
                      <h3>{item.title}</h3>
                      {item.summary ? (
                        <p>{truncateAnnouncementPreview(item.summary, lead ? 160 : 96)}</p>
                      ) : null}
                      <span className="home-text-link">
                        <ContentText k="homePage.readMore" />
                        <span aria-hidden="true"> →</span>
                      </span>
                    </div>
                    {item.coverImage ? (
                      <img
                        src={item.coverImage}
                        alt={item.coverImageAlt || ''}
                        className="home-announce-card__cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : null}
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && !error && sortedItems.length === 0 && (
          <div className="home-empty-state">
            <p><ContentText k="homePage.noAnnouncements" /></p>
            <div className="home-empty-state__actions">
              <Link to="/activities" className="home-btn home-btn--solid">
                <ContentText k="homePage.announcementsEmptyActivities" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
