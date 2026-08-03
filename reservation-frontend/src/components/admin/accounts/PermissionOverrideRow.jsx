import React from 'react';
import { Badge, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import {
  SYSTEM_ONLY_ASSIGNMENT_KEYS,
  canActorAssignPermission,
  pickPermissionDescription,
  pickPermissionLabel,
} from '../../../constants/permissionGroups';
import { PERM_OVERRIDE_MODES } from '../../../constants/accountManagement';

export default function PermissionOverrideRow({ permKey, mode, accessProfile, onChange, showTechId }) {
  const { assignable, reason } = canActorAssignPermission(accessProfile, permKey);
  const systemOnly = SYSTEM_ONLY_ASSIGNMENT_KEYS.has(permKey);
  const title = pickPermissionLabel(permKey);
  const desc = pickPermissionDescription(permKey);
  const effectiveMode = mode || 'inherit';
  return (
    <div className="py-2 border-bottom">
      <div className="d-flex flex-column flex-lg-row align-items-lg-start justify-content-lg-between gap-2">
        <div className="small flex-grow-1">
          <div className="fw-semibold">{title}</div>
          {desc ? <div className="text-muted mt-1" style={{ fontSize: '0.8rem' }}>{desc}</div> : null}
          {showTechId ? (
            <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
              技術代碼：<code>{permKey}</code>
            </div>
          ) : null}
          <div className="mt-1 d-flex flex-wrap gap-1">
            {systemOnly ? <Badge bg="secondary">系統層級</Badge> : null}
            {!assignable ? <Badge bg="warning" text="dark">僅系統管理員可調整</Badge> : null}
            {effectiveMode === 'allow' ? <Badge bg="success-subtle" text="success-emphasis">已加開</Badge> : null}
            {effectiveMode === 'deny' ? <Badge bg="danger-subtle" text="danger-emphasis">已關閉</Badge> : null}
          </div>
          {!assignable && reason ? (
            <div className="text-warning-emphasis mt-1" style={{ fontSize: '0.75rem' }}>{reason}</div>
          ) : null}
        </div>
        <ToggleButtonGroup
          type="radio"
          name={`perm-override-${permKey}`}
          value={effectiveMode}
          onChange={(val) => val && onChange(val)}
          className="flex-shrink-0"
          style={{ maxWidth: '100%' }}
        >
          {PERM_OVERRIDE_MODES.map((opt) => (
            <ToggleButton
              key={opt.value}
              id={`${permKey}-${opt.value}`}
              value={opt.value}
              variant={effectiveMode === opt.value ? opt.activeVariant : 'outline-secondary'}
              disabled={!assignable}
              title={opt.title}
              size="sm"
            >
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
    </div>
  );
}
