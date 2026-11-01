import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../src/index.css';
import '../src/styles/design-system.css';
import ClassBestepOverview from '../src/components/ClassBestepOverview';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={['/admin/classes/SYN-CLASS/bestep']}>
      <Routes>
        <Route path="/admin/classes/:classId/bestep" element={<ClassBestepOverview />} />
      </Routes>
    </MemoryRouter>
  </React.StrictMode>
);
