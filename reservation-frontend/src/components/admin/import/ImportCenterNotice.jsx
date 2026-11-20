import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import { canAccessAdminRoute } from '../../../constants/adminRouteAccess';

const VARIANT_COPY = {
  import: '各類資料匯入入口已整理在「資料匯入中心」，可對照任務後再回到此頁上傳。',
  sync: '資料同步與維運入口已列入「資料匯入中心」，可集中查看相關說明與捷徑。',
};

/**
 * 引導至資料匯入中心，不取代既有匯入 UI。
 * 無匯入中心權限者（如 et_manager）不顯示。
 * @param {{ variant?: 'import' | 'sync', className?: string, compact?: boolean }} props
 */
export default function ImportCenterNotice({ variant = 'import', className = '', compact = false }) {
  const { accessProfile } = useOutletContext() || {};
  if (!canAccessAdminRoute(accessProfile, '/admin/import-center')) {
    return null;
  }

  const message = VARIANT_COPY[variant] || VARIANT_COPY.import;

  return (
    <Alert
      variant="info"
      className={`${compact ? 'py-2 small mb-2' : 'py-2 mb-3'} ${className}`.trim()}
    >
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span className="mb-0">{message}</span>
        <Button
          as={Link}
          to="/admin/import-center"
          variant="outline-primary"
          size="sm"
          className="text-nowrap flex-shrink-0"
        >
          前往資料匯入中心
        </Button>
      </div>
    </Alert>
  );
}
