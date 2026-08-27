import React from 'react';
import { Link } from 'react-router-dom';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { useLanguage } from '../../../context/LanguageContext';
import { useEnglishTestFormSchemaPublic } from '../../../hooks/useEnglishTestFormSchemaPublic';
import { fieldLabel, fieldRequired, fieldVisible } from '../../../utils/englishTestFormSchemaMeta';
import SchemaContentBlock from './SchemaContentBlock';

export default function RegistrationPrivacyStep({
  agreedToPrivacyPolicy,
  onAgreedChange,
  onNext,
}) {
  const { t } = useLanguage();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallMobile = useMediaQuery('(max-width: 576px)');
  const { schema } = useEnglishTestFormSchemaPublic();
  const questions = schema?.questions || [];
  const docQ = questions.find((q) => q.fieldKey === 'privacyDoc');
  const agreeQ = questions.find((q) => q.fieldKey === 'agreedToPrivacyPolicy');

  const title = fieldLabel(
    { labelsByFieldKey: { privacyDoc: docQ?.label } },
    'privacyDoc',
    '個資使用同意書'
  );
  const intro =
    docQ?.content?.intro ||
    docQ?.helpText ||
    '為配合政府個人資料保護法並確保考生的權益，請詳細閱讀下列個資使用同意書所載內容：';
  const agreeLabel = fieldLabel(
    { labelsByFieldKey: { agreedToPrivacyPolicy: agreeQ?.label } },
    'agreedToPrivacyPolicy',
    '本人已確實審閱並同意以上「BESTEP培力英檢考生個資使用同意書」內容。'
  );
  const showDoc = !docQ || fieldVisible({ visibleByFieldKey: { privacyDoc: docQ.visible !== false } }, 'privacyDoc');
  const showAgree = !agreeQ || fieldVisible({ visibleByFieldKey: { agreedToPrivacyPolicy: agreeQ.visible !== false } }, 'agreedToPrivacyPolicy');
  const agreeRequired = agreeQ
    ? fieldRequired({ requiredByFieldKey: { agreedToPrivacyPolicy: agreeQ.required } }, 'agreedToPrivacyPolicy', true)
    : true;

  // 若 schema 尚未載入，沿用舊版預設區塊
  const fallbackDoc = {
    label: title,
    helpText: intro,
    content: {
      intro,
      imageUrl: '/個資使用同意書.jpg',
      imageAlt: 'BESTEP培力英檢考生個資使用同意書',
      warning: '',
      listItems: [],
      images: [],
    },
    visible: true,
  };

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
        <h4
          className="mb-3"
          style={{
            color: '#FF6B6B',
            fontWeight: 'bold',
            fontSize: isSmallMobile ? '1.1rem' : isMobile ? '1.25rem' : '1.5rem',
          }}
        >
          {title}
        </h4>
        {showDoc && (
          <SchemaContentBlock question={docQ || fallbackDoc} />
        )}
      </div>

      {showAgree && (
        <div className="mb-4 privacy-checkbox">
          <div className="form-check" style={{ fontSize: isSmallMobile ? '0.9375rem' : '1rem' }}>
            <input
              className="form-check-input"
              type="checkbox"
              id="agreedToPrivacyPolicy"
              checked={agreedToPrivacyPolicy}
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
              htmlFor="agreedToPrivacyPolicy"
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
        {agreeRequired && !agreedToPrivacyPolicy ? (
          <p className="text-muted small mb-0" role="status">
            {t('page.englishTestPrivacyNextHint')}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary-custom"
          onClick={onNext}
          disabled={agreeRequired && !agreedToPrivacyPolicy}
          style={{
            padding: isSmallMobile ? '0.625rem 1.5rem' : '0.75rem 2rem',
            fontSize: isSmallMobile ? '0.9375rem' : '1rem',
            fontWeight: 'bold',
            borderRadius: '8px',
            minWidth: isSmallMobile ? '100px' : '120px',
          }}
        >
          下一步 →
        </button>
      </div>
    </div>
  );
}
