import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import ImportCenterNotice from '../../components/admin/import/ImportCenterNotice';
import SurveyWorkflowGuide from '../../components/admin/survey/SurveyWorkflowGuide';
import { canAccessAdminRoute } from '../../constants/adminRouteAccess';
import { buildAccessProfile } from '../../utils/accessControl';
import SurveyAdminModulePage from './SurveyAdminModulePage';
import './surveyAdminModule.css';

const SURVEY_OPS_LINKS = [
  ['/admin/survey-health', '資料品質'],
  ['/admin/survey-answer-mappings', '答案對照'],
];

export default function AdminSurveyCenterPage() {
  const { token } = useOutletContext() || {};
  const profile = buildAccessProfile(token || '', localStorage.getItem('userRole') || '');
  const opsLinks = SURVEY_OPS_LINKS.filter(([to]) => canAccessAdminRoute(profile, to));

  return (
    <div className="survey-center-page container-fluid px-2 px-lg-3 pb-4">
      <div className="pt-2">
        <SurveyWorkflowGuide variant="center" defaultOpen={false} />
        {opsLinks.length > 0 ? (
          <div className="d-flex flex-wrap gap-3 mb-2">
            {opsLinks.map(([to, label]) => (
              <Link key={to} to={to}>{label}</Link>
            ))}
          </div>
        ) : null}
        <ImportCenterNotice variant="export" className="mb-2" />
      </div>
      <SurveyAdminModulePage embedded />
    </div>
  );
}
