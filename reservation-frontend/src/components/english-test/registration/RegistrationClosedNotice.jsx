import React from 'react';
import useMediaQuery from '../../../hooks/useMediaQuery';

export default function RegistrationClosedNotice() {
  const isSmallMobile = useMediaQuery('(max-width: 576px)');

  return (
    <div
      className="alert alert-warning mb-4"
      role="alert"
      style={{
        borderRadius: '8px',
        fontSize: isSmallMobile ? '0.875rem' : '0.9375rem',
        lineHeight: '1.6',
        border: '2px solid #ffc107',
      }}
    >
      <strong>報名已截止</strong>
      <br />
      報名時間已截止，無法進行新報名。如需檢視或修正已報名資料，請使用「檢視與修正」功能。
    </div>
  );
}
