import React from 'react';
import { Link } from 'react-router-dom';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { useLanguage } from '../../../context/LanguageContext';
import { useEnglishTestFormSchemaPublic } from '../../../hooks/useEnglishTestFormSchemaPublic';
import { fieldLabel, fieldRequired, fieldVisible } from '../../../utils/englishTestFormSchemaMeta';
import SchemaContentBlock from './SchemaContentBlock';
import {
  ENGLISH_TEST_OFFICIAL_ANNOUNCEMENT_URL,
  ENGLISH_TEST_ANNOUNCEMENT_FALLBACK,
} from '../../../constants/englishTestRegistrationAnnouncement';

export default function RegistrationAnnouncementStep({
  agreedToAnnouncement,
  onAgreedChange,
  onNext,
}) {
  const { t } = useLanguage();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallMobile = useMediaQuery('(max-width: 576px)');
  const { schema } = useEnglishTestFormSchemaPublic();
  const questions = schema?.questions || [];
  const docQ = questions.find((q) => q.fieldKey === 'announcementDoc');
  const agreeQ = questions.find((q) => q.fieldKey === 'agreedToAnnouncement');

  const title = fieldLabel(
    { labelsByFieldKey: { announcementDoc: docQ?.label } },
    'announcementDoc',
    ENGLISH_TEST_ANNOUNCEMENT_FALLBACK.title
  );
  const intro =
    docQ?.content?.intro ||
    docQ?.helpText ||
    ENGLISH_TEST_ANNOUNCEMENT_FALLBACK.intro;
  const agreeLabel = fieldLabel(
    { labelsByFieldKey: { agreedToAnnouncement: agreeQ?.label } },
    'agreedToAnnouncement',
    ENGLISH_TEST_ANNOUNCEMENT_FALLBACK.agreeLabel
  );
  const showDoc =
    !docQ ||
    fieldVisible({ visibleByFieldKey: { announcementDoc: docQ.visible !== false } }, 'announcementDoc');
  const showAgree =
    !agreeQ ||
    fieldVisible(
      { visibleByFieldKey: { agreedToAnnouncement: agreeQ.visible !== false } },
      'agreedToAnnouncement'
    );
  const agreeRequired = agreeQ
    ? fieldRequired(
        { requiredByFieldKey: { agreedToAnnouncement: agreeQ.required } },
        'agreedToAnnouncement',
        true
      )
    : true;

  const fallbackDoc = {
    label: title,
    helpText: intro,
    content: {
      intro,
      imageUrl: '',
      imageAlt: '',
      warning: ENGLISH_TEST_ANNOUNCEMENT_FALLBACK.warning,
      listItems: ENGLISH_TEST_ANNOUNCEMENT_FALLBACK.listItems,
      images: [],
      officialUrl: ENGLISH_TEST_OFFICIAL_ANNOUNCEMENT_URL,
    },
    visible: true,
  };

  const docContent = docQ?.content || fallbackDoc.content;
  const officialUrl = docContent.officialUrl || ENGLISH_TEST_OFFICIAL_ANNOUNCEMENT_URL;

  return (
    <div>
      <div className="alert alert-info mb-4" role="note">
        <p className="mb-2">{t('page.englishTestNotGraduation')}</p>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/student/progress" className="btn btn-sm btn-outline-primary">
            {t('page.englishTestProgressLink')}
          </Link>
          <Link to="/course-guide" className="btn btn-sm btn-outline-secondary">
            {t('page.englishTestCourseGuideLink')}
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="public-registration__step-title mb-3">
          {title}
        </h4>

        {showDoc && (
          <div className="public-registration__announcement-panel">
            <SchemaContentBlock question={docQ || fallbackDoc} compact collapsibleListFrom={3} />
          </div>
        )}

        <div className="mt-3">
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-primary btn-sm"
          >
            {t('page.englishTestOfficialAnnouncementLink')}
          </a>
          <p className="text-muted small mt-2 mb-0">
            {t('page.englishTestOfficialAnnouncementHint')}
          </p>
        </div>
      </div>

      {showAgree && (
        <div className="mb-4 privacy-checkbox">
          <div className="form-check" style={{ fontSize: isSmallMobile ? '0.9375rem' : '1rem' }}>
            <input
              className="form-check-input"
              type="checkbox"
              id="agreedToAnnouncement"
              checked={agreedToAnnouncement}
              onChange={(e) => onAgreedChange(e.target.checked)}
              style={{
                width: isSmallMobile ? '1.1rem' : '1.25rem',
                height: isSmallMobile ? '1.1rem' : '1.25rem',
                cursor: 'pointer',
                marginTop: '0.25rem',
              }}
            />
            <label
              className="form-check-label"
              htmlFor="agreedToAnnouncement"
              style={{
                marginLeft: '0.75rem',
                cursor: 'pointer',
                fontWeight: '600',
                lineHeight: '1.5',
              }}
            >
              {agreeLabel}
              {agreeRequired ? <span style={{ color: '#dc3545' }}> *</span> : null}
            </label>
          </div>
        </div>
      )}

      <div className="d-flex flex-column align-items-end gap-2">
        <button
          type="button"
          className="btn btn-primary-custom"
          onClick={onNext}
          disabled={agreeRequired && !agreedToAnnouncement}
          aria-describedby={agreeRequired && !agreedToAnnouncement ? 'announcementNextHint' : undefined}
          style={{
            padding: isSmallMobile ? '0.625rem 1.5rem' : '0.75rem 2rem',
            fontSize: isSmallMobile ? '0.9375rem' : '1rem',
            fontWeight: 'bold',
            borderRadius: '8px',
            minWidth: isSmallMobile ? '100px' : '120px',
          }}
        >
          {t('page.englishTestAnnouncementNext')}
        </button>
        {agreeRequired && !agreedToAnnouncement ? (
          <p id="announcementNextHint" className="public-registration__next-hint mb-0" role="status">
            {t('page.englishTestAnnouncementNextHint')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
