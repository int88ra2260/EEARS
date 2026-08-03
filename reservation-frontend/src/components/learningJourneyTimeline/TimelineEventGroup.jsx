import React, { useState } from 'react';
import TimelineEventCard from './TimelineEventCard';
import { summarizeTimelineGroup } from './groupTimelineEvents';

export default function TimelineEventGroup({ group }) {
  const { label, events } = group;
  const [open, setOpen] = useState(false);

  if (!events?.length) return null;
  if (events.length === 1) {
    return <TimelineEventCard event={events[0]} />;
  }

  const { dateRange, totalHours, count } = summarizeTimelineGroup(events);
  const toggleLabel = `${label}，${count} 筆，${open ? '收合' : '展開'}明細`;

  return (
    <div className={`lj-timeline-group ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="lj-timeline-group-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={toggleLabel}
      >
        <span className="lj-timeline-group-icon" aria-hidden>{open ? '−' : '+'}</span>
        <span className="lj-timeline-group-main">
          <span className="lj-timeline-group-title">{label}</span>
          <span className="lj-timeline-group-meta lj-tabular">
            {count} 筆 · {dateRange}
            {totalHours > 0 ? ` · ${totalHours.toFixed(2)} hr` : ''}
          </span>
        </span>
        <span className="lj-timeline-group-count lj-tabular">{count}</span>
      </button>
      {open ? (
        <div className="lj-timeline-group-items">
          {events.map((ev) => (
            <TimelineEventCard key={ev.eventId} event={ev} compact />
          ))}
        </div>
      ) : null}
    </div>
  );
}
