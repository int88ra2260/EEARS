/**
 * 將 Bootstrap Badge `bg` 或匯入狀態對應到 StatusBadge variant
 */
export function bootstrapBgToStatusVariant(bg) {
  const key = String(bg || '').toLowerCase();
  if (key === 'success' || key === 'success-subtle') return 'success';
  if (key === 'danger' || key === 'danger-subtle') return 'danger';
  if (key === 'warning') return 'warning';
  if (key === 'info' || key === 'primary') return 'info';
  return 'neutral';
}

/** @param {string} status import run / job status */
export function importRunStatusToVariant(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'success') return 'success';
  if (key === 'failed') return 'danger';
  if (key === 'partial' || key === 'partial_success') return 'warning';
  if (key === 'running') return 'info';
  return 'neutral';
}

/** @param {string} submissionStatus survey response status */
export function surveySubmissionStatusToVariant(submissionStatus) {
  const key = String(submissionStatus || '').toLowerCase();
  if (key === 'submitted' || key === 'complete' || key === 'completed') return 'success';
  if (key === 'draft' || key === 'in_progress') return 'warning';
  return 'neutral';
}

const ELP_STATUS_VARIANT = {
  pending: 'warning',
  active: 'success',
  rejected: 'danger',
  revoked: 'neutral',
  completed: 'info',
  submitted: 'warning',
  approved: 'success',
  draft: 'neutral',
  cancelled: 'neutral',
  none: 'neutral',
  approved_cert: 'success',
};

/** @param {string} status English Learning Passport status */
export function elpStatusToVariant(status) {
  return ELP_STATUS_VARIANT[status] || 'neutral';
}

/** @param {string} status survey answer mapping status */
export function surveyMappingStatusToVariant(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'approved') return 'success';
  if (key === 'pending') return 'warning';
  if (key === 'rejected') return 'danger';
  return 'neutral';
}

/** @param {string} status survey module status (published/draft/archived) */
export function surveyModuleStatusToVariant(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'published' || key === 'active') return 'success';
  if (key === 'draft') return 'warning';
  return 'neutral';
}

/** @param {string} mode survey repair run mode */
export function surveyRepairModeToVariant(mode) {
  return String(mode || '').toLowerCase() === 'execute' ? 'danger' : 'info';
}

/** @param {string} status generic job/row result status */
export function genericResultStatusToVariant(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'success' || key === 'ok' || key === 'completed') return 'success';
  if (key === 'failed' || key === 'error') return 'danger';
  if (key === 'warning' || key === 'partial' || key === 'partial_success') return 'warning';
  if (key === 'running' || key === 'pending') return 'info';
  return 'neutral';
}
