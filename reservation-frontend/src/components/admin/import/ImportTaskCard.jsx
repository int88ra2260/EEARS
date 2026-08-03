import React, { useState } from 'react';
import { Badge, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { canAccessAdminRoute } from '../../../constants/adminRouteAccess';
import {
  getPrimaryActionLabel,
  IMPORT_KIND_CLASS,
  IMPORT_KIND_LABEL,
  IMPORT_STATUS_BADGE,
  IMPORT_STATUS_LABEL,
  isImportCenterActionable,
} from '../../../constants/importCenterStatus';

/**
 * @param {{ card: import('../../../constants/importCenterCards').ImportCenterCard, accessProfile: object }} props
 */
export default function ImportTaskCard({ card, accessProfile }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const statusTier = card.statusTier;
  const actionable = isImportCenterActionable(statusTier);
  const canAccessTarget = card.routeAccess
    ? canAccessAdminRoute(accessProfile, card.routeAccess)
    : false;

  const primaryDisabled = !actionable || !canAccessTarget || !card.importPath;
  const showTemplate =
    actionable &&
    card.templateOnTarget &&
    canAccessTarget &&
    statusTier !== 'export_only';
  const showHistory =
    !card.hideHistoryButton &&
    Boolean(card.historyPath) &&
    actionable &&
    canAccessTarget;

  const primaryLabel = getPrimaryActionLabel(card.kind, statusTier);
  const badgeMeta = IMPORT_STATUS_BADGE[statusTier] || IMPORT_STATUS_BADGE.disabled;
  const statusLabel = IMPORT_STATUS_LABEL[statusTier] || statusTier;
  const kindClass = IMPORT_KIND_CLASS[card.kind] || '';

  const primaryDisabledTitle = !actionable
    ? card.pendingReason || '功能尚未開放'
    : !canAccessTarget
      ? '您沒有檢視此功能的權限'
      : '';

  const hasDetails = Boolean(
    card.riskHint || card.importNote || card.pendingReason || card.templateNote,
  );

  const cardStateClass = primaryDisabled
    ? 'import-center-card--inactive'
    : 'import-center-card--active';

  return (
    <Card className={`h-100 import-center-card ${cardStateClass}`}>
      <Card.Body className="d-flex flex-column">
        <div className="import-center-card__meta">
          <Badge
            className={`import-center-card__kind import-center-kind ${kindClass}`.trim()}
          >
            {IMPORT_KIND_LABEL[card.kind] || card.kind}
          </Badge>
          <Badge
            bg={badgeMeta.bg}
            className={`import-center-card__status ${badgeMeta.textClass || ''}`.trim()}
          >
            {statusLabel}
          </Badge>
        </div>

        <Card.Title className="import-center-card__title">{card.title}</Card.Title>
        {card.statusDetail ? (
          <p className="import-center-card__detail-note">{card.statusDetail}</p>
        ) : null}

        <Card.Text className="import-center-card__desc">{card.description}</Card.Text>

        <div className="import-center-card__impact" aria-label="影響模組">
          <span className="import-center-card__impact-label">影響模組</span>
          <ul className="import-center-card__modules">
            {card.impactModules.map((mod) => (
              <li key={mod}>{mod}</li>
            ))}
          </ul>
        </div>

        {hasDetails ? (
          <div className="import-center-card-details">
            <button
              type="button"
              className={`import-center-card-details__toggle${detailsOpen ? ' is-open' : ''}`}
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
            >
              <span className="import-center-card-details__icon" aria-hidden="true">
                {detailsOpen ? '−' : '+'}
              </span>
              操作風險與說明
            </button>
            {detailsOpen ? (
              <div className="import-center-card-details__panel">
                {card.riskHint ? (
                  <p className="import-center-card-details__row">
                    <span className="import-center-card-details__key">操作風險</span>
                    {card.riskHint}
                  </p>
                ) : null}
                {card.importNote ? (
                  <p className="import-center-card-details__row">
                    <span className="import-center-card-details__key">操作說明</span>
                    {card.importNote}
                  </p>
                ) : null}
                {card.pendingReason ? (
                  <p className="import-center-card-details__row">
                    <span className="import-center-card-details__key">狀態說明</span>
                    {card.pendingReason}
                  </p>
                ) : null}
                {card.templateNote && !showTemplate ? (
                  <p className="import-center-card-details__row mb-0">
                    <span className="import-center-card-details__key">範本</span>
                    {card.templateNote}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="import-center-card__actions">
          {primaryDisabled ? (
            <Button variant="primary" size="sm" disabled title={primaryDisabledTitle}>
              {primaryLabel}
            </Button>
          ) : (
            <Button
              as={Link}
              to={card.importPath}
              variant={statusTier === 'export_only' ? 'outline-primary' : 'primary'}
              size="sm"
              className="import-center-card__primary"
            >
              {primaryLabel}
            </Button>
          )}
          {showTemplate ? (
            <Button
              as={Link}
              to={card.importPath}
              variant="outline-secondary"
              size="sm"
              title={card.templateNote}
            >
              下載範本
            </Button>
          ) : null}
          {showHistory ? (
            <Button as={Link} to={card.historyPath} variant="outline-secondary" size="sm">
              查看匯入紀錄
            </Button>
          ) : null}
        </div>
      </Card.Body>
    </Card>
  );
}
