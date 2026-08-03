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
        全校英檢名冊與成績 Excel 匯入可從本頁完成；學生查詢與學期總覽請至{' '}
        <Link to="/admin/learning-journey">英語學習歷程中心</Link>。
      </p>
      <BestepImportPageComponent />
    </div>
  );
}
