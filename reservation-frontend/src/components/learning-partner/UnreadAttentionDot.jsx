import React from 'react';
import './UnreadAttentionDot.css';

/** 未讀紅點（像訊息提示） */
export default function UnreadAttentionDot({ label = '尚未查看', className = '' }) {
  return (
    <span
      className={`lp-ops-attention-dot ${className}`.trim()}
      title={label}
      aria-label={label}
      role="status"
    />
  );
}
