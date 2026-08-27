import React, { lazy } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { getAdminRoleHomePath } from '../../constants/adminNavigation';

const AdminDashboardProduct = lazy(() => import('../../pages/admin/AdminDashboardProduct'));

/**
 * /admin index route: 依使用者角色導向對應首頁。
 * admin / executive → 顯示 Dashboard；其他角色 → redirect 至各自 home path。
 */
export default function AdminRoleIndex() {
  const { userRole, teacherLevel } = useOutletContext();
  const homePath = getAdminRoleHomePath({ role: userRole, teacherLevel });

  if (homePath === '/admin/dashboard') {
    return <AdminDashboardProduct />;
  }

  return <Navigate to={homePath} replace />;
}
