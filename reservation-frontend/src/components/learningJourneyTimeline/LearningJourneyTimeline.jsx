import React, { useMemo } from 'react';
import { groupTimelineEvents } from './groupTimelineEvents';
import { buildLaneColumnGroups, buildTimelineColumns, TIMELINE_LANES } from './timelineLayout';
import { TimelineGrid } from './TimelineGrid';
import './learningJourneyTimeline.css';

export default function LearningJourneyTimeline({ data }) {
  const timeline = useMemo(() => data?.timeline || [], [data]);
  const enrollmentTerm = data?.student?.enrollmentTerm;
  const metaWarnings = useMemo(() => data?.meta?.warnings || [], [data]);

  const byLane = useMemo(() => {
    const map = Object.fromEntries(TIMELINE_LANES.map((lane) => [lane, []]));
    for (const ev of timeline) {
      const lane = ev.lane || 'activity';
      if (map[lane]) map[lane].push(ev);
    }
    return map;
  }, [timeline]);

  const columns = useMemo(
    () => buildTimelineColumns(timeline, enrollmentTerm),
    [timeline, enrollmentTerm]
  );

  const laneGroups = useMemo(
    () => buildLaneColumnGroups(byLane, columns, enrollmentTerm, groupTimelineEvents),
    [byLane, columns, enrollmentTerm]
  );

  if (!timeline.length) {
    return (
      <div className="lj-timeline-empty" role="status">
        <p className="lj-timeline-empty-title">尚無可顯示的學習歷程事件</p>
        <p className="lj-timeline-empty-copy">請先執行 analytic 重建，或確認英檢、活動、修課資料已匯入。</p>
      </div>
    );
  }

  return (
    <div className="lj-timeline-root">
      {metaWarnings.map((w) => (
        <div key={w.code || w.message} className="lj-timeline-notice" role="note">
          {w.message}
        </div>
      ))}

      <div className="lj-timeline-shell">
        <div className="lj-timeline-scroll-hint" aria-hidden>左右滑動查看更多學期</div>
        <div className="lj-timeline-scroll" role="region" aria-label="學生事件時間軸">
          <TimelineGrid columns={columns} laneGroups={laneGroups} />
        </div>
      </div>

      <footer className="lj-timeline-legend">
        <span className="lj-timeline-legend-item">
          <span className="lj-timeline-legend-swatch before-exam" />
          <span>考前暴露</span>
        </span>
        <span className="lj-timeline-legend-item">
          <span className="lj-timeline-legend-swatch after-exam" />
          <span>考後紀錄</span>
        </span>
        <span className="lj-timeline-legend-note">
          事件依學期欄位對齊；同類型可展開明細。
          {data?.meta?.snapshotVersion ? (
            <code className="lj-timeline-snapshot">{data.meta.snapshotVersion}</code>
          ) : null}
        </span>
      </footer>
    </div>
  );
}
