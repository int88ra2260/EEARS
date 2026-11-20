import React from 'react';
import { Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { canAccessAdminRoute } from '../../../constants/adminRouteAccess';

/**
 * @param {{
 *   hub: {
 *     id: string,
 *     title: string,
 *     description: string,
 *     includes?: string[],
 *     routeAccess: string,
 *     primaryPath: string,
 *     primaryLabel: string,
 *     secondaryLinks?: { label: string, path: string, routeAccess?: string }[],
 *   },
 *   accessProfile: object,
 * }} props
 */
export default function ImportHubCard({ hub, accessProfile }) {
  const canPrimary = canAccessAdminRoute(accessProfile, hub.routeAccess);
  const includes = Array.isArray(hub.includes) ? hub.includes : [];
  const secondaryLinks = Array.isArray(hub.secondaryLinks) ? hub.secondaryLinks : [];

  return (
    <Card className="h-100 import-center-card import-center-card--active import-hub-card">
      <Card.Body className="d-flex flex-column">
        <Card.Title className="import-center-card__title">{hub.title}</Card.Title>
        <Card.Text className="import-center-card__desc">{hub.description}</Card.Text>
        {includes.length ? (
          <ul className="import-hub-card__includes">
            {includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="import-center-card__actions mt-auto">
          <Button
            as={Link}
            to={hub.primaryPath}
            variant="primary"
            size="sm"
            disabled={!canPrimary}
            title={canPrimary ? undefined : '您沒有檢視此功能的權限'}
          >
            {hub.primaryLabel}
          </Button>
          {secondaryLinks.map((link) => {
            const canLink = canAccessAdminRoute(accessProfile, link.routeAccess || hub.routeAccess);
            return (
              <Button
                key={link.path}
                as={Link}
                to={link.path}
                variant="outline-secondary"
                size="sm"
                disabled={!canLink}
                title={canLink ? undefined : '您沒有檢視此功能的權限'}
              >
                {link.label}
              </Button>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );
}
