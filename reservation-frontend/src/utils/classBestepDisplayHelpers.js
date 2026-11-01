import React from 'react';
import { Badge } from 'react-bootstrap';

export const EXAM_TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'LR', label: 'LR（聽讀）' },
  { value: 'SW', label: 'SW（說寫）' },
];

export function sanitizeFileName(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

export function getRegistrationStatusInfo(status) {
  const statusMap = {
    pending: { label: '審核中', variant: 'warning' },
    approved: { label: '已通過', variant: 'info' },
    revision: { label: '請修正', variant: 'danger' },
    success: { label: '報名成功', variant: 'success' },
    failed: { label: '報名失敗', variant: 'secondary' },
    expired: { label: '已過期', variant: 'secondary' },
  };
  if (!status) return { label: '已報名', variant: 'secondary' };
  return statusMap[status] || { label: status, variant: 'secondary' };
}

export function formatLevelBadge(level) {
  if (!level) return '-';
  const levelColors = {
    A1: 'secondary',
    A2: 'info',
    B1: 'warning',
    B2: 'success',
    C1: 'primary',
    C2: 'danger',
  };
  return <Badge bg={levelColors[level] || 'secondary'}>{level}</Badge>;
}

export function renderPersonalRegistrationBadge(registration) {
  if (!registration) return <Badge bg="secondary">未報名</Badge>;
  const info = getRegistrationStatusInfo(registration.status);
  return <Badge bg={info.variant}>{info.label}</Badge>;
}

function attendanceStateLabel(attended) {
  if (attended === true) return { text: '出席', variant: 'success' };
  if (attended === false) return { text: '缺席', variant: 'danger' };
  return { text: '未確認', variant: 'secondary' };
}

function renderAttendanceBadge(prefix, record, className) {
  const { text, variant } = attendanceStateLabel(record && record.attended);
  return (
    <Badge bg={variant} className={className}>
      {prefix}: {text}
    </Badge>
  );
}

export function formatAttendanceCell(attendance) {
  if (!attendance || Object.keys(attendance).length === 0) {
    return <Badge bg="secondary">未匯入</Badge>;
  }

  const { L: l, R: r, S: s, W: w, LR: lr, SW: sw } = attendance;
  if (!l && !r && !s && !w && !lr && !sw) {
    return <Badge bg="secondary">未匯入</Badge>;
  }

  return (
    <div>
      {(l || r) && (
        <div className="mb-1">
          {l && renderAttendanceBadge('L', l, 'me-1')}
          {r && renderAttendanceBadge('R', r)}
        </div>
      )}
      {(s || w) && (
        <div>
          {s && renderAttendanceBadge('S', s, 'me-1')}
          {w && renderAttendanceBadge('W', w)}
        </div>
      )}
      {!l && !r && lr && (
        <div className="mb-1">
          {renderAttendanceBadge('LR', lr)}
        </div>
      )}
      {!s && !w && sw && (
        <div>
          {renderAttendanceBadge('SW', sw)}
        </div>
      )}
    </div>
  );
}

export function formatExamTypeLabel(personalRegistration) {
  if (personalRegistration?.examTypeLabel) return personalRegistration.examTypeLabel;
  if (!personalRegistration?.examType) return '—';
  const map = { LRSW: '聽讀說寫', LR: '聽讀', SW: '說寫', NON: '不報考' };
  return map[personalRegistration.examType] || personalRegistration.examType;
}
