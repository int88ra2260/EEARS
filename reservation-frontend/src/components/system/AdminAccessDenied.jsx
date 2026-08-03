import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminAccessDenied({ route, rule, missingRule = false }) {
  return (
    <div className="container-fluid py-4">
      <div className="alert alert-warning border-warning-subtle shadow-sm" role="alert">
        <h3 className="h5 mb-2">無權限檢視此頁面</h3>
        <p className="mb-2">
          {missingRule
            ? '此後台頁面尚未設定權限規則，請聯絡系統管理員。'
            : '您沒有檢視此後台頁面的權限。如需使用，請聯絡系統管理員或中心管理者。'}
        </p>
        {rule?.label ? <div className="small text-muted">頁面名稱：{rule.label}</div> : null}
        {route ? <div className="small text-muted">目前路徑：{route}</div> : null}
        <div className="mt-3">
          <Link className="btn btn-primary btn-sm" to="/admin/dashboard">
            返回後台首頁
          </Link>
        </div>
      </div>
    </div>
  );
}
