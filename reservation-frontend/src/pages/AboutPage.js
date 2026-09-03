import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLanguage } from '../context/LanguageContext';
import ContentText from '../components/siteContent/ContentText';
import { EMI_MAIN_PHONE } from '../data/emiCenterStaff';
import { SITE_CONTACT } from '../config/siteContact';
import useStaffMembers from '../hooks/useStaffMembers';
import useFaqItems, { pickLocalizedText } from '../hooks/useFaqItems';
import './AboutPage.css';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const ABOUT_UI_COPY = {
  zh: {
    heroBody: '認識中心定位與服務，完成預約、報名與學習紀錄。',
    storyKicker: 'Center overview',
    storyLead: '先認識中心，再開始使用服務。',
    missionLead: '成立背景、工作重點與教學方向，構成校內英語學習支持的核心。',
    goalsIntro: '學生與教師都能在同一個支持架構中，找到可實際使用的路徑。',
    servicesLead: '已經知道需求的話，可以直接前往。',
    teamLead: '先找對窗口，取得聯繫方式。',
    facultyHint: '教學與活動',
    adminHint: '預約、測驗與專案',
    contactCardTitle: '聯絡與來訪',
    contactCardLead: '活動、系統或行政協助，歡迎透過以下方式聯繫。',
    faqLead: '預約、取消與參與規則的常見問題。',
    locationLabel: '地點',
    roleCenter: '中心角色',
    rolePlatform: '平台定位',
    roleAudience: '適合誰',
    roleCenterBody: 'EMI 教學支持、英語增能活動與跨單位合作。',
    rolePlatformBody: '活動預約、英檢報名、學習歷程與必要問卷。',
    roleAudienceBody: '想參加活動、查詢預約、累積學習紀錄的本校師生。',
  },
  en: {
    heroBody: 'Learn what the center offers, then book, register, and track learning.',
    storyKicker: 'Center overview',
    storyLead: 'Understand the center first, then use the services.',
    missionLead: 'Background, priorities, and teaching goals shape campus English support.',
    goalsIntro: 'Students and teachers should find practical routes in one support structure.',
    servicesLead: 'If you already know what you need, go straight there.',
    teamLead: 'Find the right contact for your question.',
    facultyHint: 'Teaching & activities',
    adminHint: 'Reservations, tests & projects',
    contactCardTitle: 'Contact',
    contactCardLead: 'Reach the center for activities, platform, or admin support.',
    faqLead: 'Common questions on reservations, cancellations, and participation.',
    locationLabel: 'Location',
    roleCenter: 'Center role',
    rolePlatform: 'Platform role',
    roleAudience: 'Who it is for',
    roleCenterBody: 'EMI teaching support, English programs, and campus collaboration.',
    rolePlatformBody: 'Reservations, BESTEP registration, learning records, and surveys.',
    roleAudienceBody: 'Students and staff who need activities, bookings, and learning records.',
  },
};

function formatPhone(extension, lang, phoneExtLabel) {
  if (!extension) return null;
  return `${EMI_MAIN_PHONE} ${phoneExtLabel} ${extension}`;
}

function TeamMemberCard({ member, lang, phoneExtLabel }) {
  const name = member.name[lang] || member.name.zh;
  const role = member.role[lang] || member.role.zh;
  const phone = formatPhone(member.extension, lang, phoneExtLabel);

  return (
    <li className="about-team-card">
      <p className="about-team-card__name">{name}</p>
      <p className="about-team-card__role">{role}</p>
      <div className="about-team-card__meta">
        {member.email ? (
          <a href={`mailto:${member.email}`} className="about-team-card__link">
            {member.email}
          </a>
        ) : null}
        {phone ? <span>{phone}</span> : null}
      </div>
    </li>
  );
}

function AboutContactSection({ copy }) {
  return (
    <section id="contact" className="about-section about-section--contact" aria-labelledby="about-contact-title">
      <div className="about-shell">
        <div className="about-section-heading about-section-heading--split">
          <div>
            <ContentText k="homePage.contactTitle" as="p" className="about-kicker" />
            <h2 id="about-contact-title" className="about-section-title">{copy.contactCardTitle}</h2>
          </div>
          <p className="about-section-lead">{copy.contactCardLead}</p>
        </div>

        <div className="about-contact">
          <div className="about-contact__main">
            <h3 className="about-contact__name">{SITE_CONTACT.name}</h3>
            <ContentText k="homePage.contactLead" as="p" className="about-contact__lead" />
          </div>
          <dl className="about-contact__details">
            <div>
              <dt><ContentText k="homePage.contactAddress" /></dt>
              <dd>{SITE_CONTACT.address}</dd>
            </div>
            <div>
              <dt><ContentText k="homePage.contactPhone" /></dt>
              <dd>{SITE_CONTACT.phone}</dd>
            </div>
            <div>
              <dt><ContentText k="homePage.contactEmail" /></dt>
              <dd><a href={`mailto:${SITE_CONTACT.email}`}>{SITE_CONTACT.email}</a></dd>
            </div>
            <div>
              <dt><ContentText k="homePage.contactHours" /></dt>
              <dd>{SITE_CONTACT.hours}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function AboutFaqSection({ copy }) {
  const { lang } = useLanguage();
  const { faqItems } = useFaqItems();
  const [openId, setOpenId] = useState(null);

  return (
    <section id="faq" className="about-section about-section--faq" aria-labelledby="about-faq-title">
      <div className="about-shell">
        <div className="about-section-heading">
          <ContentText k="faq.title" as="h2" id="about-faq-title" className="about-section-title" />
          <p className="about-section-lead">{copy.faqLead}</p>
        </div>

        <div className="about-faq-list">
          {faqItems.map((item) => {
            const itemId = item.id;
            const isOpen = openId === itemId;
            const question = pickLocalizedText(item.question, lang);
            const answer = pickLocalizedText(item.answer, lang);
            return (
              <div key={String(itemId)} className={`about-faq-item${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="about-faq-question"
                  aria-expanded={isOpen}
                  aria-controls={`about-faq-${itemId}-answer`}
                  id={`about-faq-${itemId}-q`}
                  onClick={() => setOpenId(isOpen ? null : itemId)}
                >
                  <span>{question}</span>
                  <span className="about-faq-icon" aria-hidden />
                </button>
                <div
                  id={`about-faq-${itemId}-answer`}
                  role="region"
                  aria-labelledby={`about-faq-${itemId}-q`}
                  className="about-faq-answer"
                  hidden={!isOpen}
                >
                  {answer}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  const { t, lang } = useLanguage();
  const location = useLocation();
  const { faculty, adminStaff } = useStaffMembers();
  const copy = ABOUT_UI_COPY[lang] || ABOUT_UI_COPY.zh;
  const pageRef = useRef(null);

  const platformCards = useMemo(
    () => [
      {
        index: '01',
        title: t('homePage.heroCtaBook'),
        body: t('aboutPage.platformBookDesc'),
        to: '/events',
      },
      {
        index: '02',
        title: t('nav.englishTest'),
        body: t('aboutPage.platformBestepDesc'),
        to: '/register/english-test',
      },
      {
        index: '03',
        title: t('nav.englishLearningPassport'),
        body: t('aboutPage.platformPassportDesc'),
        to: '/student/english-learning-passport',
      },
    ],
    [t]
  );

  const roleRows = useMemo(
    () => [
      { title: copy.roleCenter, body: copy.roleCenterBody },
      { title: copy.rolePlatform, body: copy.rolePlatformBody },
      { title: copy.roleAudience, body: copy.roleAudienceBody },
    ],
    [copy]
  );

  const storyBlocks = useMemo(
    () => [
      { kicker: t('aboutPage.missionStep1'), titleKey: 'aboutPage.originTitle', bodyKey: 'aboutPage.originBody' },
      { kicker: t('aboutPage.missionStep2'), titleKey: 'aboutPage.valuesTitle', bodyKey: 'aboutPage.valuesBody' },
      { kicker: t('aboutPage.missionStep3'), titleKey: 'aboutPage.purposeTitle', bodyKey: 'aboutPage.purposeBody' },
    ],
    [t]
  );

  useGSAP(
    () => {
      const root = pageRef.current;
      if (!root) return undefined;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

      const reveals = gsap.utils.toArray('[data-about-reveal]', root);
      reveals.forEach((el) => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 28,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        });
      });

      return undefined;
    },
    { scope: pageRef }
  );

  useEffect(() => {
    const hash = location.hash?.replace('#', '');
    if (!hash || (hash !== 'faq' && hash !== 'contact')) return undefined;

    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        window.setTimeout(tryScroll, 100);
      }
    };

    const timer = window.setTimeout(tryScroll, 150);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname]);

  return (
    <div className="about-page" ref={pageRef}>
      <section className="about-hero" aria-labelledby="about-hero-title">
        <div className="about-hero__atmosphere" aria-hidden="true">
          <div className="about-hero__wash" />
          <div className="about-hero__glow" />
          <div className="about-hero__grain" />
        </div>

        <div className="about-shell about-hero__inner">
          <ContentText k="aboutPage.heroEyebrow" as="p" className="about-hero__eyebrow" />
          <ContentText k="aboutPage.heroTitle" as="h1" id="about-hero-title" className="about-hero__title" />
          <ContentText k="aboutPage.heroLead" as="p" className="about-hero__lead" />
          <p className="about-hero__body">{copy.heroBody}</p>

          <div className="about-hero__actions">
            <Link to="/events" className="about-btn about-btn--solid">{t('aboutPage.ctaBook')}</Link>
            <a href="#contact" className="about-btn about-btn--ghost">{t('aboutPage.ctaContact')}</a>
          </div>

          <p className="about-hero__meta">
            <span>{copy.locationLabel}</span>
            <ContentText k="aboutPage.heroLocation" as="span" />
          </p>

          <p className="about-hero__scroll" aria-hidden="true">
            <span>{t('aboutPage.scrollHint')}</span>
            <i />
          </p>
        </div>
      </section>

      <section className="about-section about-section--roles" aria-label={t('aboutPage.platformKicker')} data-about-reveal>
        <div className="about-shell">
          <ul className="about-roles">
            {roleRows.map((row) => (
              <li key={row.title} className="about-roles__item">
                <h2 className="about-roles__title">{row.title}</h2>
                <p className="about-roles__body">{row.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-story-title">
        <div className="about-shell">
          <div className="about-section-heading" data-about-reveal>
            <p className="about-kicker">{copy.storyKicker}</p>
            <ContentText k="aboutPage.missionTitle" as="h2" id="about-story-title" className="about-section-title" />
            <p className="about-section-lead">{copy.storyLead}</p>
          </div>

          <div className="about-story">
            {storyBlocks.map((block, index) => (
              <article
                key={block.titleKey}
                className={`about-story__block${index % 2 === 1 ? ' about-story__block--offset' : ''}`}
                data-about-reveal
              >
                <span className="about-story__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div className="about-story__copy">
                  <p className="about-kicker">{block.kicker}</p>
                  <ContentText k={block.titleKey} as="h3" className="about-story__title" />
                  <ContentText k={block.bodyKey} as="p" className="about-story__body" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section about-section--mission" aria-labelledby="about-mission-title">
        <div className="about-shell">
          <div className="about-section-heading about-section-heading--split" data-about-reveal>
            <div>
              <ContentText k="aboutPage.missionKicker" as="p" className="about-kicker" />
              <ContentText k="aboutPage.goalsTitle" as="h2" id="about-mission-title" className="about-section-title" />
            </div>
            <p className="about-section-lead">{copy.missionLead}</p>
          </div>

          <div className="about-mission" data-about-reveal>
            <p className="about-mission__intro">{copy.goalsIntro}</p>
            <ol className="about-goals">
              <li><ContentText k="aboutPage.goal1" /></li>
              <li><ContentText k="aboutPage.goal2" /></li>
              <li><ContentText k="aboutPage.goal3" /></li>
              <li><ContentText k="aboutPage.goal4" /></li>
            </ol>
            <div className="about-mission__notes">
              <p><ContentText k="aboutPage.centerIntro" /></p>
              <p><ContentText k="aboutPage.eearsIntro" /></p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-services-title">
        <div className="about-shell">
          <div className="about-section-heading" data-about-reveal>
            <ContentText k="aboutPage.platformKicker" as="p" className="about-kicker" />
            <ContentText k="aboutPage.platformTitle" as="h2" id="about-services-title" className="about-section-title" />
            <p className="about-section-lead">{copy.servicesLead}</p>
          </div>

          <div className="about-services" data-about-reveal>
            {platformCards.map((card) => (
              <Link key={card.to} to={card.to} className="about-service">
                <span className="about-service__index">{card.index}</span>
                <span className="about-service__copy">
                  <span className="about-service__title">{card.title}</span>
                  <span className="about-service__body">{card.body}</span>
                </span>
                <span className="about-service__cta">{t('aboutPage.activityCta')}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section about-section--team" aria-labelledby="about-team-title">
        <div className="about-shell">
          <div className="about-section-heading" data-about-reveal>
            <ContentText k="aboutPage.facultyTitle" as="p" className="about-kicker" />
            <h2 id="about-team-title" className="about-section-title">
              {t('aboutPage.facultyTitle')} & {t('aboutPage.adminTitle')}
            </h2>
            <p className="about-section-lead">{copy.teamLead}</p>
          </div>

          <div className="about-team-sections">
            <section className="about-team-section" aria-labelledby="about-team-faculty-title" data-about-reveal>
              <div className="about-team-section__head">
                <div>
                  <ContentText k="aboutPage.facultyTitle" as="h3" id="about-team-faculty-title" className="about-team-section__title" />
                  <ContentText k="aboutPage.facultyLead" as="p" className="about-team-section__lead" />
                </div>
                <span className="about-team-section__hint">{copy.facultyHint}</span>
              </div>
              <ul className="about-team-grid">
                {faculty.map((member) => (
                  <TeamMemberCard
                    key={member.id}
                    member={member}
                    lang={lang}
                    phoneExtLabel={t('aboutPage.phoneExt')}
                  />
                ))}
              </ul>
            </section>

            <section className="about-team-section" aria-labelledby="about-team-admin-title" data-about-reveal>
              <div className="about-team-section__head">
                <div>
                  <ContentText k="aboutPage.adminTitle" as="h3" id="about-team-admin-title" className="about-team-section__title" />
                  <ContentText k="aboutPage.adminLead" as="p" className="about-team-section__lead" />
                </div>
                <span className="about-team-section__hint">{copy.adminHint}</span>
              </div>
              <ul className="about-team-grid about-team-grid--compact">
                {adminStaff.map((member) => (
                  <TeamMemberCard
                    key={member.id}
                    member={member}
                    lang={lang}
                    phoneExtLabel={t('aboutPage.phoneExt')}
                  />
                ))}
              </ul>
            </section>
          </div>
        </div>
      </section>

      <div data-about-reveal>
        <AboutContactSection copy={copy} />
      </div>
      <div data-about-reveal>
        <AboutFaqSection copy={copy} />
      </div>
    </div>
  );
}
