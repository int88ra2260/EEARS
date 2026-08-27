import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import CourseGuideBlocks from '../components/courseGuide/CourseGuideBlocks';
import {
  COURSE_GUIDE_DEFAULT,
  COURSE_GUIDE_SOURCE_LINKS,
} from '../constants/courseGuideContent';
import { fetchCourseGuidePublic } from '../services/pageContentPublicApi';
import { useLanguage } from '../context/LanguageContext';
import './CourseGuidePage.css';

function pickLocalized(obj, lang, zhKey, enKey) {
  if (!obj) return '';
  if (lang === 'en') return obj[enKey] || obj[zhKey] || '';
  return obj[zhKey] || obj[enKey] || '';
}

/**
 * 修課說明 — 資料驅動（API + 靜態 fallback，後台可 CRUD）
 */
export default function CourseGuidePage() {
  const { t, lang } = useLanguage();
  const [payload, setPayload] = useState(COURSE_GUIDE_DEFAULT);
  const [openSections, setOpenSections] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCourseGuidePublic();
        if (!cancelled && data?.sections?.length) {
          setPayload({
            pageTitleZh: data.pageTitleZh || COURSE_GUIDE_DEFAULT.pageTitleZh,
            pageTitleEn: data.pageTitleEn || COURSE_GUIDE_DEFAULT.pageTitleEn,
            pageLeadZh: data.pageLeadZh || COURSE_GUIDE_DEFAULT.pageLeadZh,
            pageLeadEn: data.pageLeadEn || COURSE_GUIDE_DEFAULT.pageLeadEn,
            sections: data.sections,
          });
        }
      } catch {
        // keep static fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = useMemo(
    () => (Array.isArray(payload.sections) ? payload.sections.filter((s) => s.isActive !== false) : []),
    [payload.sections],
  );

  const breadcrumbs = useMemo(
    () => [
      { label: lang === 'en' ? 'Home' : '首頁', path: '/' },
      { label: pickLocalized(payload, lang, 'pageTitleZh', 'pageTitleEn') },
    ],
    [lang, payload],
  );

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  const openSection = (sectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add(sectionKey);
      return next;
    });
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`course-guide-trigger-${sectionKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const allExpanded = sections.length > 0 && openSections.size === sections.length;
  const expandAll = () => setOpenSections(new Set(sections.map((s) => s.sectionKey)));
  const collapseAll = () => setOpenSections(new Set());

  return (
    <div className="course-guide-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        variant="editorial"
        title={pickLocalized(payload, lang, 'pageTitleZh', 'pageTitleEn')}
        lead={pickLocalized(payload, lang, 'pageLeadZh', 'pageLeadEn')}
      />

      <section className="course-guide-status" aria-labelledby="course-guide-status-title">
        <h2 id="course-guide-status-title" className="course-guide-status__title">
          {t('page.courseGuideStatusTitle')}
        </h2>
        <p className="course-guide-status__lead">{t('page.courseGuideStatusLead')}</p>
        <div className="course-guide-status__actions">
          <Link to="/student/progress" className="btn btn-primary btn-sm">
            {t('page.courseGuideStatusCtaProgress')}
          </Link>
          <Link to="/student/english-learning-passport" className="btn btn-outline-primary btn-sm">
            {t('page.courseGuideStatusCtaPassport')}
          </Link>
          <Link to="/register/english-test" className="btn btn-outline-secondary btn-sm">
            {t('page.courseGuideStatusCtaBestepNote')}
            <span className="course-guide-status__hint">{t('page.courseGuideStatusBestepHint')}</span>
          </Link>
        </div>
      </section>

      <section className="course-guide-standard" aria-labelledby="course-guide-standard-title">
        <h2 id="course-guide-standard-title" className="course-guide-standard__title">
          {lang === 'en'
            ? '[English Graduation Standard: Courses + Test]'
            : '【英文畢業標準：修課＋英檢】'}
        </h2>

        <div className="course-guide-standard__row">
          <div className="course-guide-standard__card">
            <div className="course-guide-standard__card-head">
              {lang === 'en' ? (
                <>
                  Reach Upper-Intermediate · <span className="course-guide-standard__em">6</span> credits
                </>
              ) : (
                <>
                  達中高級程度 共<span className="course-guide-standard__em">6</span>學分
                </>
              )}
            </div>
            <div className="course-guide-standard__card-body">
              <p>{lang === 'en' ? '1 GE English course · 3 credits' : '通識英文一堂 3學分'}</p>
              <span className="course-guide-standard__plus-sm" aria-hidden="true">+</span>
              <p>{lang === 'en' ? '1 cross-college EAP/ESP · 3 credits' : '跨院EAP/ESP一堂 3學分'}</p>
            </div>
          </div>

          <span className="course-guide-standard__plus" aria-hidden="true">+</span>

          <div className="course-guide-standard__card">
            <div className="course-guide-standard__card-head">
              {lang === 'en' ? 'English Proficiency Certification' : '英語能力標準認證'}
            </div>
            <div className="course-guide-standard__card-body">
              <button
                type="button"
                className="course-guide-standard__link"
                onClick={() => openSection('certification')}
              >
                {lang === 'en' ? 'English test score' : '英文檢定成績'}
              </button>
              <p className="course-guide-standard__or">{lang === 'en' ? 'or' : '或'}</p>
              <button
                type="button"
                className="course-guide-standard__link"
                onClick={() => openSection('practice-portfolio')}
              >
                {lang === 'en' ? 'Practice portfolio' : '英語實踐歷程'}
                <span className="course-guide-standard__em">
                  {lang === 'en' ? ' (100 points)' : '（集滿100點）'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="course-guide-standard__meta">
          <div className="course-guide-standard__defs">
            <p>
              {lang === 'en' ? 'Academic English: ' : '學術英語: '}
              <span className="course-guide-standard__initial">E</span>nglish for{' '}
              <span className="course-guide-standard__initial">A</span>cademic{' '}
              <span className="course-guide-standard__initial">P</span>urpose
            </p>
            <p>
              {lang === 'en' ? 'Professional English: ' : '專業英語: '}
              <span className="course-guide-standard__initial">E</span>nglish for{' '}
              <span className="course-guide-standard__initial">S</span>pecific{' '}
              <span className="course-guide-standard__initial">P</span>urpose
            </p>
          </div>
          <p className="course-guide-standard__note">
            {lang === 'en'
              ? '*Separate rules for Foreign Languages majors'
              : '*外文系學生另訂'}
          </p>
        </div>
      </section>

      <div className="course-guide-toolbar">
        <div className="course-guide-toolbar__left">
          <span className="course-guide-toolbar__chip" aria-hidden="true">
            {lang === 'en' ? 'Official summary' : '官方摘要'}
          </span>
          <span className="course-guide-toolbar__text">
            {lang === 'en'
              ? `${sections.length} sections · collapsed by default`
              : `共 ${sections.length} 大章節，預設全部收合`}
          </span>
        </div>

        <div className="course-guide-toolbar__actions">
          <button
            type="button"
            className="course-guide-toolbar__btn"
            onClick={expandAll}
            disabled={allExpanded}
          >
            {lang === 'en' ? 'Expand all' : '全部展開'}
          </button>
          <button
            type="button"
            className="course-guide-toolbar__btn"
            onClick={collapseAll}
            disabled={openSections.size === 0}
          >
            {lang === 'en' ? 'Collapse all' : '全部收合'}
          </button>
        </div>
      </div>

      <div className="course-guide-accordion">
        {sections.map((section) => {
          const sectionKey = section.sectionKey;
          const isOpen = openSections.has(sectionKey);
          const panelId = `course-guide-panel-${sectionKey}`;
          const triggerId = `course-guide-trigger-${sectionKey}`;
          const topics = (section.topics || []).filter((t) => t.isActive !== false);
          const intro = pickLocalized(section, lang, 'introZh', 'introEn');

          return (
            <section
              key={sectionKey}
              className={`course-guide-accordion-item${isOpen ? ' is-open' : ''}`}
            >
              <button
                type="button"
                id={triggerId}
                className="course-guide-accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleSection(sectionKey)}
              >
                <span className="course-guide-accordion-trigger__title">
                  {pickLocalized(section, lang, 'titleZh', 'titleEn')}
                </span>
                <span className="course-guide-accordion-trigger__icon" aria-hidden="true" />
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="course-guide-accordion-panel"
                aria-hidden={!isOpen}
              >
                <div className="course-guide-accordion-panel__inner">
                  <div className="course-guide-content">
                    <div className="course-guide-subcard course-guide-subcard--flush">
                      {intro ? (
                        <p className="course-guide-p course-guide-p--muted">{intro}</p>
                      ) : null}

                      {topics.map((topic) => (
                        <details
                          key={topic.topicKey || topic.id || topic.titleZh}
                          className="course-guide-details"
                          open={!!topic.defaultOpen}
                        >
                          <summary className="course-guide-details__summary">
                            {pickLocalized(topic, lang, 'titleZh', 'titleEn')}
                          </summary>
                          <div className="course-guide-details__body">
                            <CourseGuideBlocks blocks={topic.blocks} lang={lang} />
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="course-guide-sources">
        <div className="course-guide-sources__title">
          {lang === 'en' ? 'Sources (official pages)' : '資料來源（官方頁面）'}
        </div>
        <ul className="course-guide-sources__list">
          {COURSE_GUIDE_SOURCE_LINKS.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noopener noreferrer">
                {pickLocalized(s, lang, 'labelZh', 'labelEn')}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
