import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchClient } from '../../utils/fetchClient';

export default function AnnouncementCardBlock({ props }) {
  const [item, setItem] = useState(null);
  const [error, setError] = useState(false);
  const key = props.slug || props.announcementId;

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    (async () => {
      setError(false);
      try {
        const res = await fetchClient(`/api/announcements/${encodeURIComponent(key)}`);
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setItem(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  if (!key) return null;
  if (error) return <p className="text-muted small public-card">無法載入公告</p>;
  if (!item) return <p className="text-muted small public-card">載入公告…</p>;

  const href = `/announcements/${item.slug || item.id}`;

  return (
    <article className="wb-announcement public-card">
      {item.coverImageUrl ? (
        <img src={item.coverImageUrl} alt={item.coverImageAlt || item.title} className="wb-announcement__cover" loading="lazy" />
      ) : null}
      <h3 className="wb-announcement__title">{item.title}</h3>
      {props.showSummary !== false && item.summary ? (
        <p className="wb-announcement__summary">{item.summary}</p>
      ) : null}
      <Link to={href} className="btn btn-sm btn-outline-primary">閱讀公告</Link>
    </article>
  );
}
