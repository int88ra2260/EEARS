import React from 'react';
import { Link } from 'react-router-dom';
import BestepImportPageComponent from '../../components/BestepImportPage';
import ImportCenterNotice from '../../components/admin/import/ImportCenterNotice';

/**
 * BESTEP 與相關匯入入口（/admin/english-test/import）。
 * 不重複實作匯入 UI，沿用既有 BestepImportPage。
 */
export default function EnglishTestImportHubPage() {
  return (
    <div className="container-fluid py-2">
      <ImportCenterNotice variant="import" />
      <p className="small text-muted mb-2">
        本頁只匯培力英檢的出席與成績。學期在學名冊與校外英檢請至{' '}
        <Link to="/admin/learning-journey/import">學習歷程匯入</Link>
        ；報名身分比對請至{' '}
        <Link to="/admin/english-test?tab=roster">報名核對名單</Link>
        。成績寫入後會自動同步到學習歷程，不必再匯校外英檢。
      </p>
      <BestepImportPageComponent />
    </div>
  );
}
