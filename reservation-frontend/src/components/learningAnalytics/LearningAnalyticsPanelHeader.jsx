import React from 'react';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

/**
 * 圖表／區塊標題 + 一句話說明（給非技術使用者）
 */
export default function LearningAnalyticsPanelHeader({ title, lead, tooltip }) {
  return (
    <div className="la-panel-header mb-3">
      <div className="la-panel-title mb-0 d-flex align-items-center gap-1">
        <span>{title}</span>
        {tooltip ? (
          <OverlayTrigger placement="top" overlay={<Tooltip>{tooltip}</Tooltip>}>
            <span className="la-info-icon" aria-label="說明">ⓘ</span>
          </OverlayTrigger>
        ) : null}
      </div>
      {lead ? <p className="la-panel-lead mb-0 mt-1">{lead}</p> : null}
    </div>
  );
}
