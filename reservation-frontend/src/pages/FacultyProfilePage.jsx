import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { EMI_MAIN_PHONE } from '../data/emiCenterStaff';
import useStaffMembers from '../hooks/useStaffMembers';
import {
  facultyProfileSections,
  facultyRoleLines,
  isProfileLinkLine,
} from './facultyProfile';
import './AboutPage.css';

const COPY = {
  zh: {
    back: '返回師資介紹',
    missingTitle: '找不到這位師資',
    missingBody: '這位老師沒有公開的學歷、經歷與著作，或連結已經變更。',
    loading: '載入中',
  },
  en: {
    back: 'Back to faculty',
    missingTitle: 'Faculty profile not found',
    missingBody: 'This profile is unavailable, or the link has changed.',
    loading: 'Loading',
  },
};

function ProfileLine({ line }) {
  if (!isProfileLinkLine(line)) return line;
  return (
    <a href={line} className="about-profile__link">
      {line}
    </a>
  );
}

export default function FacultyProfilePage() {
  const { memberId = '' } = useParams();
  const { t, lang } = useLanguage();
  const { faculty, loading } = useStaffMembers();
  const copy = COPY[lang] || COPY.zh;
  const id = useMemo(() => {
    try {
      return decodeURIComponent(memberId);
    } catch {
      return memberId;
    }
  }, [memberId]);
  const member = faculty.find((item) => item.id === id) || null;
  const sections = facultyProfileSections(member, lang);
  const name = member ? (member.name[lang] || member.name.zh) : '';
  const role = member ? (member.role[lang] || member.role.zh) : '';
  const roles = facultyRoleLines(role);
  const phone = member?.extension
    ? `${EMI_MAIN_PHONE} ${t('aboutPage.phoneExt')} ${member.extension}`
    : '';

  return (
    <div className="about-page">
      <article className="about-profile">
        <div className="about-shell">
          <Link className="about-profile__back" to="/about#faculty">
            {copy.back}
          </Link>
          {loading ? (
            <p className="about-profile__status" role="status">{copy.loading}</p>
          ) : null}
          {!loading && !sections.length ? (
            <>
              <h1 className="about-profile__name">{copy.missingTitle}</h1>
              <p className="about-profile__status">{copy.missingBody}</p>
            </>
          ) : null}
          {!loading && sections.length ? (
            <>
              <p className="about-kicker">{t('aboutPage.facultyTitle')}</p>
              <h1 className="about-profile__name">{name}</h1>
              {roles.length ? (
                <ul className="about-profile__roles">
                  {roles.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              <div className="about-profile__contact">
                {phone ? <p>{phone}</p> : null}
                {member.email ? (
                  <p>
                    <a className="about-profile__link" href={`mailto:${member.email}`}>
                      {member.email}
                    </a>
                  </p>
                ) : null}
              </div>
              {sections.map((section) => (
                <section key={section.label} className="about-profile__section">
                  <h2>{section.label}</h2>
                  <ul className="about-profile__lines">
                    {section.lines.map((line, index) => (
                      <li key={`${section.label}-${index}`}>
                        <ProfileLine line={line} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          ) : null}
        </div>
      </article>
    </div>
  );
}
