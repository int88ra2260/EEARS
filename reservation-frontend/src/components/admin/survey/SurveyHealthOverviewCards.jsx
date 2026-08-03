import React from 'react';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import {
  HEALTH_METRIC_HINTS,
  HEALTH_METRIC_LABELS,
  healthMetricCardVariant,
} from '../../../constants/surveyAdminUx';

const VARIANT_BORDER = {
  primary: 'border-primary border-opacity-25',
  success: 'border-success border-opacity-25',
  warning: 'border-warning border-opacity-50',
  danger: 'border-danger border-opacity-50',
};

/**
 * @param {{ overview: object, metricKeys: string[], sampleNote?: string }} props
 */
export default function SurveyHealthOverviewCards({ overview, metricKeys, sampleNote }) {
  if (!overview) return null;

  return (
    <>
      {sampleNote ? (
        <div className="small text-muted mb-2">{sampleNote}</div>
      ) : null}
      <div className="row g-2 mb-3">
        {metricKeys.map((key) => {
          const variant = healthMetricCardVariant(key, overview[key]);
          const hint = HEALTH_METRIC_HINTS[key];
          const label = HEALTH_METRIC_LABELS[key] || key;
          const value = overview[key];
          const card = (
            <Card className={`border-0 shadow-sm h-100 ${VARIANT_BORDER[variant] || ''}`}>
              <Card.Body className="py-2">
                <div className="d-flex justify-content-between align-items-start gap-1">
                  <div className="small text-muted">{label}</div>
                  {variant !== 'primary' && Number(value) > 0 ? (
                    <Badge bg={variant} className="fw-normal">
                      需處理
                    </Badge>
                  ) : variant === 'success' && key !== 'responsesTotal' ? (
                    <Badge bg="success" className="fw-normal">
                      正常
                    </Badge>
                  ) : null}
                </div>
                <div className={`h4 mb-0 ${variant === 'danger' ? 'text-danger' : variant === 'warning' ? 'text-warning' : ''}`}>
                  {value ?? '—'}
                </div>
              </Card.Body>
            </Card>
          );
          return (
            <div key={key} className="col-md-3 col-sm-6">
              {hint ? (
                <OverlayTrigger placement="top" overlay={<Tooltip>{hint}</Tooltip>}>
                  <div>{card}</div>
                </OverlayTrigger>
              ) : (
                card
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
