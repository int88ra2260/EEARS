import React from 'react';
import Spinner from 'react-bootstrap/Spinner';

export default function RouteLoading({ label = '載入中...' }) {
  return (
    <div className="d-flex justify-content-center align-items-center py-5" role="status" aria-live="polite">
      <Spinner animation="border" size="sm" className="me-2" />
      <span>{label}</span>
    </div>
  );
}
