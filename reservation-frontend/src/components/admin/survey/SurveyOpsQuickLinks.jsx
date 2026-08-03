import React from 'react';
import { Link } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';

/**
 * @param {{ links: Array<{ to: string, label: string, description?: string, variant?: string }> }} props
 */
export default function SurveyOpsQuickLinks({ links }) {
  const visible = (links || []).filter(Boolean);
  if (!visible.length) return null;

  return (
    <Alert variant="light" className="border mb-3 py-2">
      <div className="small fw-semibold mb-2">建議下一步</div>
      <div className="d-flex flex-wrap gap-2">
        {visible.map((item) => (
          <div key={item.to} className="d-flex flex-column">
            <Button as={Link} to={item.to} variant={item.variant || 'outline-primary'} size="sm">
              {item.label}
            </Button>
            {item.description ? (
              <span className="text-muted small mt-1" style={{ maxWidth: 220 }}>
                {item.description}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Alert>
  );
}
