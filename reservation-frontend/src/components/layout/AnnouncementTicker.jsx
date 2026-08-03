import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAnnouncements from '../../hooks/useAnnouncements';
import { announcementDetailPath, truncateAnnouncementPreview } from '../../services/announcementApi';
import { formatDateYMD } from '../../utils/announcementFormatters';

const TICKER_PATHS = new Set([
  '/',
  '/events',
  '/activities',
  '/my-reservations',
  '/learning-resources',
  '/regulations-forms',
  '/about',
  '/survey/choice',
  '/student/english-learning-passport',
]);

function shouldShowTicker(pathname) {
  return TICKER_PATHS.has(pathname);
}

function tickerText(item) {
  const title = item.title || '公告';
  const summary = item.summary ? `：${truncateAnnouncementPreview(item.summary, 56)}` : '';
  return `${title}${summary}`;
}

function TickerItems({ items, hidden = false }) {
  return (
    <div className="announcement-ticker__group" aria-hidden={hidden ? 'true' : undefined}>
      {items.map((item) => (
        <Link
          key={`${hidden ? 'copy' : 'main'}-${item.id || item.slug}`}
          role="listitem"
          className="announcement-ticker__item"
          to={announcementDetailPath(item)}
        >
          <span className="announcement-ticker__date">{formatDateYMD(item.date)}</span>
          {item.isPinned ? <span className="announcement-ticker__badge">置頂</span> : null}
          <span className="announcement-ticker__text">{tickerText(item)}</span>
        </Link>
      ))}
    </div>
  );
}

export default function AnnouncementTicker() {
  const location = useLocation();
  const { items, loading, error } = useAnnouncements({ limit: 5, sliceMax: 5 });

  if (!shouldShowTicker(location.pathname)) return null;
  if (error) return null;

  if (loading) {
    return (
      <div className="announcement-ticker announcement-ticker--loading" aria-hidden="true">
        <div className="announcement-ticker__shell">
          <div className="announcement-ticker__label">最新公告</div>
          <div className="announcement-ticker__skeleton" />
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <aside className="announcement-ticker" aria-label="最新公告摘要">
      <div className="announcement-ticker__shell">
        <Link to="/announcements" className="announcement-ticker__label">
          最新公告
        </Link>
        <div className="announcement-ticker__viewport">
          <div className="announcement-ticker__track" role="list">
            <TickerItems items={items} />
            <TickerItems items={items} hidden />
          </div>
        </div>
      </div>
    </aside>
  );
}
