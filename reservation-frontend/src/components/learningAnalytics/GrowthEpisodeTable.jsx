import React from 'react';
import Table from 'react-bootstrap/Table';
import { Link } from 'react-router-dom';
import EvidenceQualityBadge from './EvidenceQualityBadge';

function formatHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

export default function GrowthEpisodeTable({ episodes = [] }) {
  if (!episodes.length) {
    return (
      <p className="small text-muted mb-0">
        目前無可顯示的前後測成長樣本；請確認快照已重建且含重測紀錄。
      </p>
    );
  }

  return (
    <div className="table-responsive">
      <Table size="sm" hover className="la-episode-table mb-0">
        <thead>
          <tr>
            <th>學號</th>
            <th>技能</th>
            <th>工具</th>
            <th>後測日期</th>
            <th className="text-end">原始成長</th>
            <th className="text-end">修正成長</th>
            <th className="text-end">考前曝光(h)</th>
            <th>可信度</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {episodes.map((episode) => {
            const key = `${episode.studentId}-${episode.skill}-${episode.instrument}-${episode.examDate}`;
            const exposure = episode.timeWindow || {};
            const resourceHours = exposure.resourceHoursBeforeExam ?? episode.exposureBeforeExam?.resourceHours;
            return (
              <tr key={key}>
                <td className="font-monospace">{episode.studentId}</td>
                <td>{episode.skillLabel || episode.skill}</td>
                <td>{episode.instrument}</td>
                <td>{episode.examDate || '—'}</td>
                <td className="text-end">{episode.rawGrowth ?? '—'}</td>
                <td className="text-end">{episode.adjustedGseGrowth ?? '—'}</td>
                <td className="text-end" title={`課程 ${formatHours(exposure.courseHoursBeforeExam)} / 活動 ${formatHours(exposure.activityHoursBeforeExam)}`}>
                  {formatHours(resourceHours)}
                </td>
                <td>
                  <EvidenceQualityBadge level={episode.evidenceQuality} />
                </td>
                <td>
                  <Link
                    to={`/admin/learning-analytics/students/${encodeURIComponent(episode.studentId)}`}
                    className="small me-2"
                  >
                    軌跡
                  </Link>
                  <Link
                    to={`/admin/learning-analytics/skills/${encodeURIComponent(episode.studentId)}`}
                    className="small"
                  >
                    技能
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
