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
 * 從學號推測入學年（民國年）：B113xxx → 113, D112xxx → 112
 * 回傳 null 表示無法辨識。
 */
function guessEnrollmentYear(studentId) {
  if (!studentId) return null;
  const m = String(studentId).match(/^[A-Za-z](\d{3})/);
  return m ? Number(m[1]) : null;
}

/**
 * 解析標題裡的入學年適用範圍。
 * 回傳：
 * - null：標題沒有學年度條件（例如獎勵申請表、總覽）→ 入學年篩選時仍顯示
 * - { min, max }：含邊界的適用區間
 */
function parseYearScopeFromTitle(title) {
  const text = String(title || '');
  if (!text) return null;

  // 110-112 / 100-110
  const range = text.match(/(\d{3})\s*[-–~至到]\s*(\d{3})/);
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]) };
  }

  // 109 學年以前 / 之前
  const before = text.match(/(\d{3})\s*學年(?:度)?\s*(?:以前|之前)/);
  if (before) {
    return { min: 0, max: Number(before[1]) };
  }

  // 113 學年度起 / 以後 / 之後
  const from = text.match(/(\d{3})\s*學年(?:度)?\s*(?:起|以後|之後)/);
  if (from) {
    return { min: Number(from[1]), max: 999 };
  }

  // 112 學年度入學生適用 / 112 學年度
  const exact = text.match(/(\d{3})\s*學年(?:度)?/);
  if (exact) {
    const year = Number(exact[1]);
    return { min: year, max: year };
  }

  return null;
}

function itemMatchesEnrollmentYear(item, year) {
  if (!year) return true;
  const title = item.title?.zh || item.title?.en || '';
  const scope = parseYearScopeFromTitle(title);
  // 沒有學年度條件的檔案（獎勵表、總覽等）一律保留
  if (!scope) return true;
  return year >= scope.min && year <= scope.max;
}

function filterSectionsByEnrollmentYear(allSections, year) {
  if (!year) return allSections;
  return allSections
    .map((section) => ({
      ...section,
      items: (section.items || []).filter((item) => itemMatchesEnrollmentYear(item, year)),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * 法規表單（Header 新頁）
 */
export default function RegulationsFormsPage() {
  const { t, lang } = useLanguage();
  const [enrollYearInput, setEnrollYearInput] = useState(() => {
    try {
      const sid = sessionStorage.getItem('eears-student-id') || '';
      const year = guessEnrollmentYear(sid);
      return year ? String(year) : '';
    } catch {
      return '';
    }
  });
  const [openSections, setOpenSections] = useState(() => new Set());
  const [sections, setSections] = useState(() => REGULATION_SECTIONS);

  const enrollYear = useMemo(() => {
    if (!/^\d{3}$/.test(enrollYearInput)) return null;
    const year = Number(enrollYearInput);
    if (year < 100 || year > 120) return null;
    return year;
  }, [enrollYearInput]);

  const visibleSections = useMemo(
    () => filterSectionsByEnrollmentYear(sections, enrollYear),
    [sections, enrollYear],
  );

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

  useEffect(() => {
    if (!enrollYear) return;
    setOpenSections(new Set(visibleSections.map((section) => section.id)));
  }, [enrollYear, visibleSections]);

  const totalFileCount = useMemo(
    () => visibleSections.reduce((sum, section) => sum + (section.items ? section.items.length : 0), 0),
    [visibleSections],
  );

  const breadcrumbs = useMemo(() => [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.regulationsForms') },
  ], [t]);

  const allExpanded = visibleSections.length > 0 && openSections.size === visibleSections.length;

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
    setOpenSections(new Set(visibleSections.map((section) => section.id)));
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

      <div className="regulations-forms-enroll-hint">
        <label htmlFor="enroll-year-input" className="regulations-forms-enroll-hint__label">
          {t('regulationsFormsPage.enrollYearLabel')}
        </label>
        <input
          id="enroll-year-input"
          type="text"
          inputMode="numeric"
          maxLength={3}
          placeholder={t('regulationsFormsPage.enrollYearPlaceholder')}
          value={enrollYearInput}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 3);
            setEnrollYearInput(val);
            if (val === '') setOpenSections(new Set());
          }}
          className="regulations-forms-enroll-hint__input"
          aria-describedby="enroll-year-hint"
        />
        {enrollYear ? (
          <span id="enroll-year-hint" className="regulations-forms-enroll-hint__tag">
            {t('regulationsFormsPage.enrollYearTag', { year: enrollYear })}
          </span>
        ) : (
          <span id="enroll-year-hint" className="regulations-forms-enroll-hint__hint">
            {t('regulationsFormsPage.enrollYearHint')}
          </span>
        )}
      </div>

      <div className="regulations-forms-toolbar">
        <p className="regulations-forms-note">
          <span className="regulations-forms-note__icon" aria-hidden="true">PDF</span>
          <ContentText k="regulationsFormsPage.note" />
        </p>
        <div className="regulations-forms-toolbar__actions">
          <p className="regulations-forms-summary">
            {t('regulationsFormsPage.statsSummary', {
              sections: visibleSections.length,
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
        {visibleSections.map((section, index) => {
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
                        key={`${section.id}-${item.href || item.id}`}
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
