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
          {l && (
            <Badge bg={l.attended ? 'success' : 'danger'} className="me-1">
              L: {l.attended ? '出席' : '缺席'}
            </Badge>
          )}
          {r && (
            <Badge bg={r.attended ? 'success' : 'danger'}>
              R: {r.attended ? '出席' : '缺席'}
            </Badge>
          )}
        </div>
      )}
      {(s || w) && (
        <div>
          {s && (
            <Badge bg={s.attended ? 'success' : 'danger'} className="me-1">
              S: {s.attended ? '出席' : '缺席'}
            </Badge>
          )}
          {w && (
            <Badge bg={w.attended ? 'success' : 'danger'}>
              W: {w.attended ? '出席' : '缺席'}
            </Badge>
          )}
        </div>
      )}
      {!l && !r && lr && (
        <div className="mb-1">
          <Badge bg={lr.attended ? 'success' : 'danger'}>
            LR: {lr.attended ? '出席' : '缺席'}
          </Badge>
        </div>
      )}
      {!s && !w && sw && (
        <div>
          <Badge bg={sw.attended ? 'success' : 'danger'}>
            SW: {sw.attended ? '出席' : '缺席'}
          </Badge>
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
