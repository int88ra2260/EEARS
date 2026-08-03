import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import ContentText from '../components/siteContent/ContentText';
import PageHeader from '../components/layout/PageHeader';
import { fetchRegulationsFormsPublic } from '../services/pageContentPublicApi';
import './RegulationsFormsPage.css';

const REGULATION_SECTIONS = [
  {
    id: 'english-proficiency-zh',
    title: { zh: '英語能力相關規範（中文）', en: 'English Proficiency Regulations (ZH)' },
    items: [
      { title: { zh: '109 學年以前入學生適用', en: 'Applicable to students enrolled in school year 109 and before' }, href: '/regulations-forms-files/english-proficiency-zh/01.pdf' },
      { title: { zh: '110 學年度入學生適用', en: 'Applicable to students enrolled in school year 110' }, href: '/regulations-forms-files/english-proficiency-zh/02.pdf' },
      { title: { zh: '111 學年度入學生適用', en: 'Applicable to students enrolled in school year 111' }, href: '/regulations-forms-files/english-proficiency-zh/03.pdf' },
      { title: { zh: '112 學年度入學生適用', en: 'Applicable to students enrolled in school year 112' }, href: '/regulations-forms-files/english-proficiency-zh/04.pdf' },
      { title: { zh: '113 學年度起入學生適用', en: 'Applicable to students enrolled in school year 113 and after' }, href: '/regulations-forms-files/english-proficiency-zh/05.pdf' },
    ],
  },
  {
    id: 'english-proficiency-en',
    title: { zh: 'Regulations for English Proficiency（英文版）', en: 'Regulations for English Proficiency' },
    items: [
      { title: { zh: '109 學年以前入學生適用', en: 'Applicable to students enrolled in school year 109 and before' }, href: '/regulations-forms-files/english-proficiency-en/01.pdf' },
      { title: { zh: '110 學年度入學生適用', en: 'Applicable to students enrolled in school year 110' }, href: '/regulations-forms-files/english-proficiency-en/02.pdf' },
      { title: { zh: '111 學年度入學生適用', en: 'Applicable to students enrolled in school year 111' }, href: '/regulations-forms-files/english-proficiency-en/03.pdf' },
      { title: { zh: '112 學年度入學生適用', en: 'Applicable to students enrolled in school year 112' }, href: '/regulations-forms-files/english-proficiency-en/04.pdf' },
      { title: { zh: '113 學年度起入學生適用', en: 'Applicable to students enrolled in school year 113 and after' }, href: '/regulations-forms-files/english-proficiency-en/05.pdf' },
    ],
  },
  {
    id: 'english-certification-zh',
    title: { zh: '英語能力檢定認定（中文）', en: 'English Level Certification (ZH)' },
    items: [
      { title: { zh: '109 學年度入學生適用', en: 'Applicable to students enrolled in school year 109' }, href: '/regulations-forms-files/english-certification-zh/01.pdf' },
      { title: { zh: '110-112 學年度入學生適用', en: 'Applicable to students enrolled in school year 110-112' }, href: '/regulations-forms-files/english-certification-zh/02.pdf' },
      { title: { zh: '113 學年度入學生適用', en: 'Applicable to students enrolled in school year 113' }, href: '/regulations-forms-files/english-certification-zh/03.pdf' },
      { title: { zh: '114 學年度起入學生適用', en: 'Applicable to students enrolled in school year 114 and after' }, href: '/regulations-forms-files/english-certification-zh/04.pdf' },
      { title: { zh: '學年度適用規範總覽', en: 'Applicable school-year overview' }, href: '/regulations-forms-files/english-certification-zh/05.pdf' },
    ],
  },
  {
    id: 'english-certification-en',
    title: { zh: 'Regulations for English Level Certification（英文版）', en: 'Regulations for English Level Certification' },
    items: [
      { title: { zh: '110-112 學年度入學生適用', en: 'Applicable to students enrolled in school year 110-112' }, href: '/regulations-forms-files/english-certification-en/01.pdf' },
      { title: { zh: '113 學年度起入學生適用', en: 'Applicable to students enrolled in school year 113 and after' }, href: '/regulations-forms-files/english-certification-en/02.pdf' },
      { title: { zh: '114 學年度起入學生適用', en: 'Applicable to students enrolled in school year 114 and after' }, href: '/regulations-forms-files/english-certification-en/03.pdf' },
    ],
  },
  {
    id: 'test-and-bestep-rewards',
    title: { zh: '英檢與 BESTEP 獎勵', en: 'English Test and BESTEP Rewards' },
    items: [
      { title: { zh: '培力英檢獎勵要點', en: 'BESTEP reward regulations' }, href: '/regulations-forms-files/test-and-bestep-rewards/01.pdf' },
      { title: { zh: '培力英檢獎勵申請表', en: 'BESTEP reward application form' }, href: '/regulations-forms-files/test-and-bestep-rewards/02.pdf' },
      { title: { zh: '英語檢定獎勵要點', en: 'English test reward regulations' }, href: '/regulations-forms-files/test-and-bestep-rewards/03.pdf' },
      { title: { zh: '英語檢定獎勵申請表', en: 'English test reward application form' }, href: '/regulations-forms-files/test-and-bestep-rewards/04.pdf' },
    ],
  },
  {
    id: 'form-download-zh',
    title: { zh: '表單下載（中文）', en: 'Form Download (ZH)' },
    items: [
      { title: { zh: '英語檢定獎勵申請表', en: 'English test reward application form' }, href: '/regulations-forms-files/form-download-zh/01.pdf' },
      { title: { zh: '學分抵免申請表（100-110 學年度入學生）', en: 'Credit transfer application form (school year 100-110)' }, href: '/regulations-forms-files/form-download-zh/02.pdf' },
      { title: { zh: '學分抵免申請表（111 學年度入學生）', en: 'Credit transfer application form (school year 111)' }, href: '/regulations-forms-files/form-download-zh/03.pdf' },
      { title: { zh: '學分抵免申請表（112 學年度起入學生）', en: 'Credit transfer application form (school year 112 and after)' }, href: '/regulations-forms-files/form-download-zh/04.pdf' },
      { title: { zh: '英語起始級別變更申請表', en: 'Change English beginning level application form' }, href: '/regulations-forms-files/form-download-zh/05.pdf' },
    ],
  },
  {
    id: 'form-download-en',
    title: { zh: 'Form Download（英文版）', en: 'Form Download (EN)' },
    items: [
      { title: { zh: 'Change English Beginning Level Application Form', en: 'Change English Beginning Level Application Form' }, href: '/regulations-forms-files/form-download-en/01.pdf' },
      { title: { zh: 'Credit Transfer Application Form（100-110）', en: 'Credit Transfer Application Form (Applicable to students enrolled in school year 100 - 110)' }, href: '/regulations-forms-files/form-download-en/02.pdf' },
      { title: { zh: 'Credit Transfer Application Form（111）', en: 'Credit Transfer Application Form (Applicable to students enrolled in school year 111)' }, href: '/regulations-forms-files/form-download-en/03.pdf' },
      { title: { zh: 'Credit Transfer Application Form（112 之後）', en: 'Credit Transfer Application Form (Applicable to students enrolled in school year 112 and after)' }, href: '/regulations-forms-files/form-download-en/04.pdf' },
    ],
  },
];

/**
 * 法規表單（Header 新頁）
 */
export default function RegulationsFormsPage() {
  const { t, lang } = useLanguage();
  const [openSections, setOpenSections] = useState(() => new Set());
  const [sections, setSections] = useState(() => REGULATION_SECTIONS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRegulationsFormsPublic();
        const apiGroups = data?.groups || [];
        const mapped = apiGroups.map((g) => ({
          id: String(g.id),
          title: { zh: g.titleZh, en: g.titleEn },
          items: (g.items || []).map((it) => ({
            id: String(it.id),
            title: { zh: it.titleZh, en: it.titleEn },
            href: it.fileUrl,
          })),
        }));
        if (!cancelled) setSections(mapped);
      } catch (_) {
        // keep fallback sections
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalFileCount = useMemo(
    () => sections.reduce((sum, section) => sum + (section.items ? section.items.length : 0), 0),
    [sections],
  );

  const breadcrumbs = useMemo(() => [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.regulationsForms') },
  ], [t]);

  const allExpanded = sections.length > 0 && openSections.size === sections.length;

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(sections.map((section) => section.id)));
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  return (
    <div className="regulations-forms-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={<ContentText k="regulationsFormsPage.title" />}
        lead={<ContentText k="regulationsFormsPage.lead" />}
      />

      <div className="regulations-forms-toolbar">
        <p className="regulations-forms-note">
          <span className="regulations-forms-note__icon" aria-hidden="true">PDF</span>
          <ContentText k="regulationsFormsPage.note" />
        </p>
        <div className="regulations-forms-toolbar__actions">
          <p className="regulations-forms-summary">
            {t('regulationsFormsPage.statsSummary', {
              sections: sections.length,
              files: totalFileCount,
            })}
          </p>
          <div className="regulations-forms-toolbar__buttons">
            <button
              type="button"
              className="regulations-forms-toolbar__btn"
              onClick={expandAll}
              disabled={allExpanded}
            >
              {t('regulationsFormsPage.expandAll')}
            </button>
            <button
              type="button"
              className="regulations-forms-toolbar__btn"
              onClick={collapseAll}
              disabled={openSections.size === 0}
            >
              {t('regulationsFormsPage.collapseAll')}
            </button>
          </div>
        </div>
      </div>

      <div className="regulations-forms-accordion">
        {sections.map((section, index) => {
          const isOpen = openSections.has(section.id);
          const panelId = `regulations-panel-${section.id}`;
          const triggerId = `regulations-trigger-${section.id}`;

          return (
            <section key={section.id} className={`regulations-forms-accordion-item${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                id={triggerId}
                className="regulations-forms-accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleSection(section.id)}
              >
                <span className="regulations-forms-accordion-trigger__main">
                  <span className="regulations-forms-accordion-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="regulations-forms-accordion-trigger__title">
                    {section.title[lang] || section.title.zh}
                  </span>
                </span>
                <span className="regulations-forms-accordion-trigger__meta">
                  <span className="regulations-forms-accordion-count">
                    {t('regulationsFormsPage.fileCount', { count: section.items.length })}
                  </span>
                  <span className="regulations-forms-accordion-icon" aria-hidden="true" />
                </span>
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                aria-hidden={!isOpen}
                className="regulations-forms-accordion-panel"
              >
                <div className="regulations-forms-accordion-panel__inner">
                  <div className="regulations-forms-grid">
                    {section.items.map((item) => (
                      <a
                        key={`${section.id}-${item.href}`}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="regulations-forms-card"
                        tabIndex={isOpen ? 0 : -1}
                      >
                        <span className="regulations-forms-card__badge" aria-hidden="true">PDF</span>
                        <h3 className="regulations-forms-card__title">
                          {item.title[lang] || item.title.zh}
                        </h3>
                        <span className="regulations-forms-card__cta">
                          <ContentText k="regulationsFormsPage.openFile" />
                          <span className="regulations-forms-card__arrow" aria-hidden="true">→</span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
