import React, { useEffect, useState } from 'react';
import { fetchClient } from '../../../utils/fetchClient';

export default function AnnouncementPicker({ value, onChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchClient('/api/announcements?limit=30');
        const data = res.ok ? await res.json() : { items: [] };
        if (!cancelled) setItems(data.items || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-muted small">載入公告…</p>;

  return (
    <div className="weekly-announcement-picker">
      {items.length === 0 ? (
        <p className="text-muted small mb-0">尚無已發布公告</p>
      ) : (
        items.map((item) => {
          const active = value?.announcementId === item.id || value?.slug === item.slug;
          return (
            <button
              key={item.id}
              type="button"
              className={`weekly-announcement-picker__item${active ? ' is-selected' : ''}`}
              onClick={() => onChange({ announcementId: item.id, slug: item.slug || '' })}
            >
              <strong>{item.title}</strong>
              {item.summary ? <span className="d-block small text-muted">{item.summary.slice(0, 80)}</span> : null}
            </button>
          );
        })
      )}
    </div>
  );
}
