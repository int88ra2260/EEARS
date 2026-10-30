import React from 'react';
import { NavLink } from 'react-router-dom';
import PageHeader from '../layout/PageHeader';
import { useLanguage } from '../../context/LanguageContext';
import useStudentSession from '../../hooks/useStudentSession';
import './StudentRecordShell.css';

function StudentIdentityBar() {
  const { t } = useLanguage();
  const session = useStudentSession();
  const student = session?.student;
  if (!student) return null;

  return (
    <div className="student-workspace-identity">
      <div>
        <p className="student-workspace-identity__name">{student.name}</p>
        <p className="student-workspace-identity__id">{student.studentId}</p>
      </div>
      <NavLink to="/student/account" className="student-workspace-identity__account">
        {t('nav.backToStudentAccount')}
      </NavLink>
    </div>
  );
}

export default function StudentRecordShell({ lead, titleKey = 'nav.myRecord', children }) {
  const { t } = useLanguage();
  const title = t(titleKey);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.home'), path: '/' },
          { label: title },
        ]}
        title={title}
        lead={lead}
      />
      <StudentIdentityBar />
      {children}
    </>
  );
}
