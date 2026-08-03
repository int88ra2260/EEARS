import React from 'react';
import { Card } from 'react-bootstrap';
import { PERM_OVERRIDE_MODES } from '../../../constants/accountManagement';

export default function PermissionOverrideGuide() {
  return (
    <Card className="border-0 bg-light small mb-3">
      <Card.Body className="py-3">
        <div className="fw-semibold mb-2">這個分頁在做什麼？</div>
        <p className="text-muted mb-2">
          角色（例如老師、行政）已內建一組功能權限。此處僅在需要<strong>例外</strong>時，針對單一功能加開或關閉；
          多數帳號維持「沿用預設」即可。
        </p>
        <div className="row g-2">
          {PERM_OVERRIDE_MODES.map((opt) => (
            <div key={opt.value} className="col-md-4">
              <div className="border rounded bg-white p-2 h-100">
                <div className="fw-semibold">{opt.label}</div>
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>{opt.title}</div>
              </div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
