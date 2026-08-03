import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Form } from 'react-bootstrap';
import { fetchClient } from '../../../utils/fetchClient';

export default function EventPicker({ selectedIds = [], onChange, max = 6 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchClient('/api/events');
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setEvents(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = new Set(selectedIds.map((id) => Number(id)));

  const sortedEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...events]
      .filter((evt) => {
        if (!q) return true;
        const name = String(evt.name || '').toLowerCase();
        const loc = String(evt.location || '').toLowerCase();
        return name.includes(q) || loc.includes(q);
      })
      .sort((a, b) => {
        const da = a.date ? dayjs(a.date).valueOf() : 0;
        const db = b.date ? dayjs(b.date).valueOf() : 0;
        return da - db;
      });
  }, [events, query]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < max) next.add(id);
    onChange(Array.from(next));
  };

  if (loading) return <p className="text-muted small">載入活動…</p>;

  return (
    <div className="weekly-event-picker">
      <p className="small text-muted mb-2">已選 {selectedIds.length} / {max}</p>
      <Form.Control
        size="sm"
        className="mb-2"
        placeholder="搜尋活動名稱或地點"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="weekly-event-picker__list">
        {sortedEvents.length === 0 ? (
          <p className="text-muted small mb-0">沒有符合的活動</p>
        ) : null}
        {sortedEvents.map((evt) => {
          const isOn = selected.has(Number(evt.id));
          return (
            <button
              key={evt.id}
              type="button"
              className={`weekly-event-picker__item${isOn ? ' is-selected' : ''}`}
              disabled={!isOn && selected.size >= max}
              onClick={() => toggle(Number(evt.id))}
            >
              <span>{evt.name}</span>
              <span className="text-muted small">
                {evt.date ? dayjs(evt.date).format('MM/DD') : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
