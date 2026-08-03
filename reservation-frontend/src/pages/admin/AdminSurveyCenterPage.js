import React from 'react';
import ImportCenterNotice from '../../components/admin/import/ImportCenterNotice';
import SurveyWorkflowGuide from '../../components/admin/survey/SurveyWorkflowGuide';
import SurveyAdminModulePage from './SurveyAdminModulePage';
import './surveyAdminModule.css';

export default function AdminSurveyCenterPage() {
  return (
    <div className="survey-center-page container-fluid px-2 px-lg-3 pb-4">
      <div className="pt-2">
        <SurveyWorkflowGuide variant="center" defaultOpen={false} />
        <ImportCenterNotice variant="export" className="mb-2" />
      </div>
      <SurveyAdminModulePage embedded />
    </div>
  );
}
