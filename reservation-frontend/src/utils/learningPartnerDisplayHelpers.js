export const TEAM_STATUS_MAP = {
  pending_approval: { text: '待同意', color: 'warning', bgColor: '#fff3cd' },
  approved: { text: '已完成', color: 'success', bgColor: '#d1e7dd' },
  expired: { text: '已失效', color: 'danger', bgColor: '#f8d7da' },
  cancelled: { text: '已取消', color: 'secondary', bgColor: '#e2e3e5' },
};

export const TEAM_CARD_COLORS = [
  { header: '#17a2b8', bg: '#e7f3f5' },
  { header: '#007bff', bg: '#e7f0ff' },
  { header: '#6f42c1', bg: '#f0e7ff' },
  { header: '#dc3545', bg: '#ffe7e7' },
  { header: '#fd7e14', bg: '#fff4e7' },
  { header: '#28a745', bg: '#e7f5e7' },
  { header: '#ffc107', bg: '#fffbe7' },
];

export function getTeamStatusCounts(teams, total) {
  const counts = { all: total };
  teams.forEach((team) => {
    counts[team.status] = (counts[team.status] || 0) + 1;
  });
  return counts;
}
