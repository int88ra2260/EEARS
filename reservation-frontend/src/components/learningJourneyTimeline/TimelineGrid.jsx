import React from 'react';
import TimelineEventGroup from './TimelineEventGroup';
import { TIMELINE_LANES } from './timelineLayout';

const LANE_LABELS = {
  baseline: '入學基準',
  exam: '英檢',
  course: '修課',
  activity: '活動',
};

export function TimelineGrid({ columns, laneGroups }) {
  const colCount = columns.length;

  return (
    <div
      className="lj-timeline-grid"
      style={{ '--lj-col-count': colCount }}
    >
      <div className="lj-timeline-corner lj-timeline-sticky-left">
        <span className="lj-timeline-kicker">Timeline</span>
        <span className="lj-timeline-corner-title">學期軸</span>
      </div>

      {columns.map((col) => (
        <div
          key={col.key}
          className={`lj-timeline-col-head ${col.isMilestone ? 'is-milestone' : ''}`}
        >
          <span className="lj-timeline-col-head-label">{col.label}</span>
        </div>
      ))}

      {TIMELINE_LANES.map((lane) => (
        <React.Fragment key={lane}>
          <div className={`lj-timeline-lane-label lj-timeline-sticky-left lane-${lane}`}>
            <span className="lj-timeline-lane-kicker">{lane}</span>
            <span className="lj-timeline-lane-name">{LANE_LABELS[lane]}</span>
          </div>
          {columns.map((col) => {
            const groups = laneGroups[lane]?.[col.key] || [];
            const isEmpty = !groups.length;

            return (
              <div
                key={`${lane}-${col.key}`}
                className={`lj-timeline-cell lane-${lane} ${col.isMilestone ? 'is-milestone' : ''} ${isEmpty ? 'is-empty' : ''}`}
              >
                {isEmpty ? (
                  <span className="lj-timeline-cell-empty" aria-hidden />
                ) : (
                  <div className="lj-timeline-cell-stack">
                    {groups.map((group) => (
                      <TimelineEventGroup
                        key={`${lane}-${col.key}-${group.key}`}
                        group={group}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
