import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Collapse } from 'react-bootstrap';
import { SURVEY_PAGE_GUIDES, SURVEY_WORKFLOW_STEPS } from '../../../constants/surveyAdminUx';

/**
 * @param {{ variant: 'center' | 'rules' | 'health' | 'mapping', defaultOpen?: boolean }} props
 */
export default function SurveyWorkflowGuide({ variant, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const guide = SURVEY_PAGE_GUIDES[variant];

  if (!guide) return null;

  const isOps = variant === 'health' || variant === 'mapping';

  return (
    <Card className="border-0 shadow-sm mb-3">
      <Card.Header className="bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
        <span className="fw-semibold">{guide.title}</span>
        <Button
          variant="link"
          size="sm"
          className="p-0 text-decoration-none"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? '收合說明' : '展開說明'}
        </Button>
      </Card.Header>
      <Collapse in={open}>
        <div>
          <Card.Body className="pt-2 pb-3">
            {isOps ? (
              <Alert variant="warning" className="small py-2 mb-2">
                此頁屬於<strong>進階維運</strong>，一般行政人員請優先使用「問卷中心」與「啟用規則」。
              </Alert>
            ) : null}
            <p className="small text-muted mb-2">{guide.intro}</p>
            <ul className="small mb-3 ps-3">
              {guide.bullets.map((line) => (
                <li key={line} className="mb-1">{line}</li>
              ))}
            </ul>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowWorkflow((v) => !v)}
              aria-expanded={showWorkflow}
            >
              {showWorkflow ? '隱藏完整流程' : '查看完整操作流程（5 步）'}
            </Button>
            <Collapse in={showWorkflow}>
              <div className="mt-3">
                <ol className="small mb-0 ps-3">
                  {SURVEY_WORKFLOW_STEPS.map((step, idx) => (
                    <li key={step.id} className="mb-2">
                      <strong>{idx + 1}. {step.title}</strong>
                      <div className="text-muted">{step.summary}</div>
                      {step.path ? (
                        <Link className="small" to={step.path}>{step.action}</Link>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            </Collapse>
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
}
