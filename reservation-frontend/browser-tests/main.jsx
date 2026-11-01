import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../src/index.css';
import '../src/styles/design-system.css';
import AdminAnalyticsPage from '../src/pages/admin/AdminAnalyticsPage.jsx';

function HarnessLayout() {
  return <Outlet context={{ token: 'analytics-browser-harness' }} />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={['/analytics-browser-harness']}>
      <Routes>
        <Route element={<HarnessLayout />}>
          <Route path="/analytics-browser-harness" element={<AdminAnalyticsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  </React.StrictMode>
);
