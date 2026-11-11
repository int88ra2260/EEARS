import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../src/index.css';
import '../src/styles/design-system.css';
import ToastProvider from '../src/components/ui/ToastProvider';
import AdminLayout from '../src/components/AdminLayout';
import AdminDashboardProduct from '../src/pages/admin/AdminDashboardProduct';
import { applyHarnessAuth } from './appAuth';

const boot = applyHarnessAuth('admin');

function Placeholder({ label }) {
  return <p>{label}</p>;
}

function AdminShell({ auth, onLogout }) {
  return (
    <AdminLayout
      token={auth.token}
      userRole={auth.userRole}
      username={auth.username}
      mustResetPassword={false}
      setMustResetPassword={() => {}}
      onLogout={onLogout}
    />
  );
}

function DashboardHarness() {
  const [auth, setAuth] = useState(boot);
  const logout = useMemo(
    () => () => {
      localStorage.clear();
      setAuth({ token: '', userRole: '', username: '' });
    },
    [],
  );

  return (
    <ToastProvider>
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/admin" element={<AdminShell auth={auth} onLogout={logout} />}>
            <Route path="dashboard" element={<AdminDashboardProduct />} />
            <Route path="operations" element={<Placeholder label="operations-placeholder" />} />
            <Route path="operations/:id" element={<Placeholder label="operation-detail-placeholder" />} />
            <Route path="settings/system" element={<Placeholder label="settings-placeholder" />} />
            <Route path="logs" element={<Placeholder label="logs-placeholder" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DashboardHarness />
  </React.StrictMode>,
);
