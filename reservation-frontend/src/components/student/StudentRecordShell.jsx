import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import PageHeader from '../layout/PageHeader';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchClassCreditAllocation,
  fetchClassCreditNavEnabled,
} from '../../services/classCreditAllocationApi';
import { loadReservationIdentity } from '../../utils/studentIdentityStorage';
import { getCurrentSemester } from '../../utils/semesterUtils';
import './StudentRecordShell.css';

const TABS = [
  { id: 'reservations', to: '/my-reservations', labelKey: 'nav.myReservations' },
  { id: 'progress', to: '/student/progress', labelKey: 'nav.myProgress' },
  { id: 'credit', to: '/student/class-credit-allocation', labelKey: 'nav.classCreditAllocation', gated: true },
];

export function StudentRecordTabs() {
  const { t } = useLanguage();
  const [creditAllowed, setCreditAllowed] = useState(false);
  const [identityVersion, setIdentityVersion] = useState(0);

  useEffect(() => {
    const bump = () => setIdentityVersion((n) => n + 1);
    window.addEventListener('eears-student-identity', bump);
    return () => window.removeEventListener('eears-student-identity', bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = await fetchClassCreditNavEnabled();
      if (cancelled) return;
      if (!enabled) {
        setCreditAllowed(false);
        return;
      }
      const identity = loadReservationIdentity();
      const semester = getCurrentSemester();
      if (!identity || !semester) {
        setCreditAllowed(true);
        return;
      }
      try {
        const data = await fetchClassCreditAllocation(identity, semester);
        if (!cancelled) setCreditAllowed((data?.classCount || 0) > 1);
      } catch {
        if (!cancelled) setCreditAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identityVersion]);

  const tabs = TABS.filter((tab) => !tab.gated || creditAllowed);

  return (
    <nav className="student-record-tabs" aria-label={t('nav.myRecord')}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.to}
          end
          className={({ isActive }) => `student-record-tabs__link${isActive ? ' is-active' : ''}`}
        >
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}

export default function StudentRecordShell({ lead, children }) {
  const { t } = useLanguage();

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.home'), path: '/' },
          { label: t('nav.myRecord') },
        ]}
        title={t('nav.myRecord')}
        lead={lead}
      />
      <StudentRecordTabs />
      {children}
    </>
  );
}
