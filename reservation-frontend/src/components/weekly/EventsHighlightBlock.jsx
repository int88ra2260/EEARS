import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { fetchClient } from '../../utils/fetchClient';

export default function EventsHighlightBlock({ props }) {
  const eventIds = useMemo(
    () => (Array.isArray(props.eventIds) ? props.eventIds : []),
    [props.eventIds]
  );
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventIds.length) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchClient('/api/events');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEvents(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventIds]);

  const picked = useMemo(() => {
    const byId = new Map(events.map((e) => [Number(e.id), e]));
    return eventIds
      .map((id) => byId.get(Number(id)))
      .filter(Boolean);
  }, [events, eventIds]);

  if (!eventIds.length) return null;

  return (
    <section className="wb-events public-card">
      {props.title ? <h2 className="wb-section-title">{props.title}</h2> : null}
      {loading ? <p className="text-muted small mb-0">載入活動…</p> : null}
      {!loading && picked.length === 0 ? (
        <p className="text-muted small mb-0">找不到所選活動</p>
      ) : (
        <ul className="wb-events__list list-unstyled mb-0">
          {picked.map((evt) => (
            <li key={evt.id} className="wb-events__item">
              <div>
                <strong>{evt.name}</strong>
                <div className="wb-events__meta text-muted small">
                  {evt.date ? dayjs(evt.date).format('YYYY-MM-DD') : ''}
                  {evt.startTime ? ` · ${evt.startTime}` : ''}
                  {evt.location ? ` · ${evt.location}` : ''}
                </div>
              </div>
              <Link to="/events" className="btn btn-sm btn-outline-primary">預約</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
