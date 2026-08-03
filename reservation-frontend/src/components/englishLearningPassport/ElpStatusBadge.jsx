import React from 'react';
import StatusBadge from '../ui/StatusBadge';
import { elpStatusToVariant } from '../../utils/statusBadgeUtils';
import { ELP_STATUS_LABELS } from '../../services/englishLearningPassportApi';

export default function ElpStatusBadge({ status, size = 'md' }) {
  return (
    <StatusBadge variant={elpStatusToVariant(status)} size={size}>
      {ELP_STATUS_LABELS[status] || status}
    </StatusBadge>
  );
}
