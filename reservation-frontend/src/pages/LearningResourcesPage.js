import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import ContentText from '../components/siteContent/ContentText';
import PageHeader from '../components/layout/PageHeader';
import { fetchLearningResourcesPublic } from '../services/pageContentPublicApi';
import { mergeLearningResourceMiniGames } from '../constants/miniGamesCatalog';
import { LEARNING_GUIDES_CATALOG } from '../constants/learningGuidesCatalog';
import ActivityStepOneTools from '../components/activities/ActivityStepOneTools';
import './LearningResourcesPage.css';
import './ActivitiesPage.css';
import '../components/activities/ActivityStepOneTools.css';

const LEARNING_SITES = [
  {
    id: 'live-abc',
    title: 'Live ABC',
    href: 'https://lpc.liveabc.com/flhs/login/login.php',
    introKey: 'learningResourcesPage.sitesLiveAbc',
  },
  {
    id: 'easytest',
    title: 'EasyTest',
    href: 'https://easytest.nsysu.edu.tw/',
    introKey: 'learningResourcesPage.sitesEasyTest',
  },
  {
    id: 'walking-library',
    title: 'WalkingLibrary',
    href: 'https://nsysu.primo.exlibrisgroup.com/view/action/uresolver.do?operation=resolveService&package_service_id=6285981510007977&institutionId=7977&customerId=7975&VE=true',
    introKey: 'learningResourcesPage.sitesWalkingLibrary',
  },
  {
    id: 'cool-english',
    title: 'Cool English',
    href: 'https://www.coolenglish.edu.tw/',
    introKey: 'learningResourcesPage.sitesCoolEnglish',
  },
  {
    id: 'teemi',
    title: '英語文說寫能力檢測平台 (TEEMI)',
    href: 'https://teemi.tw/',
    introKey: 'learningResourcesPage.sitesTeemi',
  },
];

const FALLBACK_SITES = LEARNING_SITES.map((s, idx) => ({
  id: s.id,
  titleZh: s.title,
  titleEn: s.title,
  introZh: null,
  introEn: null,
  tag: null,
  href: s.href,
  titleKey: null,
  introKey: s.introKey || 'learningResourcesPage.sitesCardLead',
  tagKey: 'learningResourcesPage.sitesTag',
  sortOrder: idx,
  isActive: true,
}));

/**
 * 學習資源（Header 新頁）
 * 先彙整既有練習遊戲與學習指南，後續可再擴充外部資源／教材。
 */
export default function LearningResourcesPage() {
  const { t, lang } = useLanguage();

  const [content, setContent] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLearningResourcesPublic();
        if (!cancelled) setContent(data);
      } catch (e) {
        // keep page usable even if API fails
        if (!cancelled) setContent(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sites = content?.sites || FALLBACK_SITES;
  const miniGames = useMemo(
    () => mergeLearningResourceMiniGames(content?.miniGames),
    [content?.miniGames],
  );
  const guides = content?.guides || LEARNING_GUIDES_CATALOG.filter((c) => c.available).map((c, idx) => ({
    id: c.id,
    titleZh: null,
    titleEn: null,
    introZh: null,
    introEn: null,
    tag: c.tag,
    href: c.path,
    isExternal: false,
    titleKey: c.titleKey,
    introKey: c.introKey,
    sortOrder: idx,
    isActive: true,
  }));

  const breadcrumbs = useMemo(() => [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.learningResources') },
  ], [t]);

  return (
    <div className="learning-resources-page activities-page">
      <PageHeader
        variant="editorial"
        breadcrumbs={breadcrumbs}
        eyebrow={<ContentText k="miniGames.practiceKicker" />}
        title={<ContentText k="learningResourcesPage.title" />}
        lead={<ContentText k="learningResourcesPage.lead" />}
      />

      <section className="activities-practice" aria-labelledby="learning-resources-practice-title">
        <div className="activities-section-heading">
          <ContentText k="miniGames.practiceKicker" as="p" className="activities-eyebrow" />
          <ContentText k="miniGames.practiceTitle" as="h2" id="learning-resources-practice-title" />
          <ContentText k="miniGames.practiceLead" as="p" />
        </div>
        <div className="activities-practice-grid">
          {miniGames.map((card) => (
            card.isExternal ? (
              <a
                key={card.id}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="activities-practice-card"
              >
                <span className="activities-practice-card__tag">{card.tag}</span>
                <h3 className="activities-practice-card__title">
                  {lang === 'zh' ? (card.titleZh || (card.titleKey ? t(card.titleKey) : '')) : (card.titleEn || (card.titleKey ? t(card.titleKey) : ''))}
                </h3>
                <p className="activities-practice-card__intro">
                  {lang === 'zh' ? (card.introZh || (card.introKey ? t(card.introKey) : '')) : (card.introEn || (card.introKey ? t(card.introKey) : ''))}
                </p>
                <span className="activities-practice-card__cta">{t('miniGames.startPractice')} →</span>
              </a>
            ) : (
              <Link key={card.id} to={card.href} className="activities-practice-card">
                <span className="activities-practice-card__tag">{card.tag}</span>
                <h3 className="activities-practice-card__title">
                  {lang === 'zh' ? (card.titleZh || (card.titleKey ? t(card.titleKey) : '')) : (card.titleEn || (card.titleKey ? t(card.titleKey) : ''))}
                </h3>
                <p className="activities-practice-card__intro">
                  {lang === 'zh' ? (card.introZh || (card.introKey ? t(card.introKey) : '')) : (card.introEn || (card.introKey ? t(card.introKey) : ''))}
                </p>
                <span className="activities-practice-card__cta">{t('miniGames.startPractice')} →</span>
              </Link>
            )
          ))}
        </div>
        <ActivityStepOneTools />
      </section>

      <section className="activities-guides" aria-labelledby="learning-resources-guides-title">
        <div className="activities-section-heading">
          <ContentText k="miniGames.guidesKicker" as="p" className="activities-eyebrow" />
          <ContentText k="miniGames.guidesTitle" as="h2" id="learning-resources-guides-title" />
          <ContentText k="miniGames.guidesLead" as="p" />
        </div>
        <div className="activities-practice-grid">
          {guides.map((card) =>
            card.isExternal ? (
              <a
                key={card.id}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="activities-practice-card activities-practice-card--guide"
              >
                <span className="activities-practice-card__tag">{card.tag}</span>
                <h3 className="activities-practice-card__title">
                  {lang === 'zh' ? (card.titleZh || (card.titleKey ? t(card.titleKey) : '')) : (card.titleEn || (card.titleKey ? t(card.titleKey) : ''))}
                </h3>
                <p className="activities-practice-card__intro">
                  {lang === 'zh' ? (card.introZh || (card.introKey ? t(card.introKey) : '')) : (card.introEn || (card.introKey ? t(card.introKey) : ''))}
                </p>
                <span className="activities-practice-card__cta">{t('miniGames.openGuide')} →</span>
              </a>
            ) : (
              <Link key={card.id} to={card.href} className="activities-practice-card activities-practice-card--guide">
                <span className="activities-practice-card__tag">{card.tag}</span>
                <h3 className="activities-practice-card__title">
                  {lang === 'zh' ? (card.titleZh || (card.titleKey ? t(card.titleKey) : '')) : (card.titleEn || (card.titleKey ? t(card.titleKey) : ''))}
                </h3>
                <p className="activities-practice-card__intro">
                  {lang === 'zh' ? (card.introZh || (card.introKey ? t(card.introKey) : '')) : (card.introEn || (card.introKey ? t(card.introKey) : ''))}
                </p>
                <span className="activities-practice-card__cta">{t('miniGames.openGuide')} →</span>
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="activities-practice" aria-labelledby="learning-resources-sites-title">
        <div className="activities-section-heading">
          <ContentText k="learningResourcesPage.sitesKicker" as="p" className="activities-eyebrow" />
          <ContentText k="learningResourcesPage.sitesTitle" as="h2" id="learning-resources-sites-title" />
          <ContentText k="learningResourcesPage.sitesLead" as="p" />
        </div>
        <div className="activities-practice-grid">
          {sites.map((site) => {
            const fallback = FALLBACK_SITES.find((s) => s.id === site.id);
            const title = lang === 'zh' ? (site?.titleZh || site?.titleEn || '') : (site?.titleEn || site?.titleZh || '');
            const intro =
              lang === 'zh'
                ? site?.introZh || (site?.introKey ? t(site.introKey) : fallback?.introKey ? t(fallback.introKey) : t('learningResourcesPage.sitesCardLead'))
                : site?.introEn || (site?.introKey ? t(site.introKey) : fallback?.introKey ? t(fallback.introKey) : t('learningResourcesPage.sitesCardLead'));
            const tagText = site?.tag || (site?.tagKey ? t(site.tagKey) : t('learningResourcesPage.sitesTag'));
            const isInternal = typeof site.href === 'string' && site.href.startsWith('/');
            if (isInternal) {
              return (
                <Link
                  key={site.id}
                  to={site.href}
                  className="activities-practice-card learning-resources-page__site-card"
                >
                  <span className="activities-practice-card__tag">{tagText}</span>
                  <h3 className="activities-practice-card__title">{title}</h3>
                  <p className="activities-practice-card__intro">{intro}</p>
                  <span className="activities-practice-card__cta">
                    <ContentText k="learningResourcesPage.openWebsite" /> →
                  </span>
                </Link>
              );
            }
            return (
              <a
                key={site.id}
                href={site.href}
                target="_blank"
                rel="noopener noreferrer"
                className="activities-practice-card learning-resources-page__site-card"
              >
                <span className="activities-practice-card__tag">{tagText}</span>
                <h3 className="activities-practice-card__title">{title}</h3>
                <p className="activities-practice-card__intro">{intro}</p>
                <span className="activities-practice-card__cta">
                  <ContentText k="learningResourcesPage.openWebsite" /> →
                </span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
