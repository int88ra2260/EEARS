import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import ContentText from '../components/siteContent/ContentText';
import { EMI_MAIN_PHONE } from '../data/emiCenterStaff';
import { SITE_CONTACT, EMI_CENTER_URL } from '../config/siteContact';
import useStaffMembers from '../hooks/useStaffMembers';
import useFaqItems, { pickLocalizedText } from '../hooks/useFaqItems';
import './AboutPage.css';

const ABOUT_UI_COPY = {
  zh: {
    heroBadge1: 'EMI 教學支持',
    heroBadge2: '英語增能活動',
    heroBadge3: '學生常用服務',
    heroBody:
      '這個頁面重新整理了中心定位、平台用途與對外聯繫方式，讓第一次進入 EEARS 的使用者也能快速知道這裡提供什麼、適合從哪裡開始。',
    heroCardTitle: '這個平台能幫你做什麼',
    heroCardLead: '中心官網與 EEARS 分工清楚：一個負責整體資訊，一個負責學生常用流程。',
    heroPanel1Title: '中心角色',
    heroPanel1Body: '推動 EMI 教學支持、英語增能活動與校內跨單位合作。',
    heroPanel2Title: '平台定位',
    heroPanel2Body: '整合活動預約、英檢報名、學習歷程與必要問卷流程。',
    heroPanel3Title: '適合誰使用',
    heroPanel3Body: '想參加英語活動、查詢預約、累積學習紀錄的本校學生與教職員。',
    storyKicker: 'Center overview',
    storyLead: '把原本分散在不同頁面的資訊整理成一個清楚入口，先理解中心，再開始使用服務。',
    missionLead: '中心的成立背景、工作重點與教學方向，構成學生在校英語學習支持的核心。',
    goalsIntro: '我們希望學生與教師都能在同一個支持架構中找到可實際使用的資源與路徑。',
    servicesLead: '以下是學生最常使用的三個數位入口；若你已經知道需求，可以直接前往對應頁面。',
    teamLead: '以下名單來自目前站內資料來源；你可以先查看主要聯絡窗口，再決定是否前往中心官網看完整介紹。',
    facultyHint: '教學與活動支持',
    adminHint: '預約、測驗與專案窗口',
    contactCardTitle: '聯絡與來訪資訊',
    contactCardLead: '若需要活動、系統或行政協助，可透過以下方式與中心聯繫。',
    faqLead: '整理學生最常詢問的使用問題，包含預約、取消與活動參與規則。',
    locationLabel: '地點',
    officialSiteLabel: '中心官網',
    teamSiteLabel: '查看中心官網',
  },
  en: {
    heroBadge1: 'EMI support',
    heroBadge2: 'English enhancement',
    heroBadge3: 'Student services',
    heroBody:
      'This page reframes the center’s role, the platform’s purpose, and contact information so first-time visitors can quickly understand what the EMI Center offers and where to begin.',
    heroCardTitle: 'What this platform helps you do',
    heroCardLead: 'The center website and EEARS serve different needs: one provides institutional information, the other supports everyday student tasks.',
    heroPanel1Title: 'Center role',
    heroPanel1Body: 'Support EMI teaching, English enhancement programs, and cross-campus collaboration.',
    heroPanel2Title: 'Platform role',
    heroPanel2Body: 'Bring together reservations, BESTEP registration, learning records, and required survey steps.',
    heroPanel3Title: 'Who it is for',
    heroPanel3Body: 'Students and staff who need a clear entry point to activities, reservations, and learning records.',
    storyKicker: 'Center overview',
    storyLead: 'This page gathers the center’s key information into one clearer entry point so users can understand the center before using its services.',
    missionLead: 'The center’s background, priorities, and teaching goals shape the support system behind students’ English learning on campus.',
    goalsIntro: 'We aim to give both students and teachers practical routes, not just policy language.',
    servicesLead: 'These are the three digital entry points students use most often. If you already know what you need, you can go straight there.',
    teamLead: 'The directory below comes from the current site data source. Use it to find the right contact, then visit the center website if you need fuller profiles.',
    facultyHint: 'Teaching and activity support',
    adminHint: 'Reservations, testing, and project contact',
    contactCardTitle: 'Contact information',
    contactCardLead: 'For support related to activities, the platform, or administration, contact the center through the details below.',
    faqLead: 'Common questions about reservations, cancellations, and participation rules are collected here for quick reference.',
    locationLabel: 'Location',
    officialSiteLabel: 'Center website',
    teamSiteLabel: 'Visit center website',
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

        <div className="about-contact-card">
          <div className="about-contact-card__main">
            <h3 className="about-contact-card__name">{SITE_CONTACT.name}</h3>
            <ContentText k="homePage.contactLead" as="p" className="about-contact-card__lead" />
          </div>
          <dl className="about-contact-card__details">
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
          <div className="about-contact-card__actions">
            <a href={EMI_CENTER_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <ContentText k="homePage.goToCenter" />
            </a>
          </div>
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
              <div key={String(itemId)} className="about-faq-item">
                <button
                  type="button"
                  className="about-faq-question"
                  aria-expanded={isOpen}
                  aria-controls={`about-faq-${itemId}-answer`}
                  id={`about-faq-${itemId}-q`}
                  onClick={() => setOpenId(isOpen ? null : itemId)}
                >
                  <span>{question}</span>
                  <span className="about-faq-icon" aria-hidden>{isOpen ? '−' : '+'}</span>
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

  const platformCards = useMemo(
    () => [
      {
        title: t('homePage.heroCtaBook'),
        body: t('aboutPage.platformBookDesc'),
        to: '/events',
      },
      {
        title: t('nav.englishTest'),
        body: t('aboutPage.platformBestepDesc'),
        to: '/register/english-test',
      },
      {
        title: t('nav.englishLearningPassport'),
        body: t('aboutPage.platformPassportDesc'),
        to: '/student/english-learning-passport',
      },
    ],
    [t]
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
    <div className="about-page">
      <section className="about-hero" aria-labelledby="about-hero-title">
        <div className="about-shell about-hero__layout">
          <div className="about-hero__copy">
            <ContentText k="aboutPage.heroEyebrow" as="p" className="about-kicker" />
            <ContentText k="aboutPage.heroTitle" as="h1" id="about-hero-title" className="about-hero__title" />
            <ContentText k="aboutPage.heroLead" as="p" className="about-hero__lead" />
            <p className="about-hero__body">{copy.heroBody}</p>
            <div className="about-hero__meta">
              <span>{copy.locationLabel}</span>
              <ContentText k="aboutPage.heroLocation" as="span" />
            </div>
            <div className="about-hero__badges" aria-label={t('aboutPage.missionStepsAria')}>
              <span className="about-badge">{copy.heroBadge1}</span>
              <span className="about-badge">{copy.heroBadge2}</span>
              <span className="about-badge">{copy.heroBadge3}</span>
            </div>
            <div className="about-actions">
              <Link to="/events" className="btn btn-primary">{t('aboutPage.ctaBook')}</Link>
              <a href="#contact" className="btn btn-outline-primary">{t('aboutPage.ctaContact')}</a>
            </div>
          </div>

          <aside className="about-hero-card" aria-label={copy.heroCardTitle}>
            <p className="about-kicker">{t('aboutPage.platformKicker')}</p>
            <h2 className="about-card-title">{copy.heroCardTitle}</h2>
            <p className="about-card-lead">{copy.heroCardLead}</p>
            <div className="about-hero-card__grid">
              <article className="about-mini-card">
                <h3>{copy.heroPanel1Title}</h3>
                <p>{copy.heroPanel1Body}</p>
              </article>
              <article className="about-mini-card">
                <h3>{copy.heroPanel2Title}</h3>
                <p>{copy.heroPanel2Body}</p>
              </article>
              <article className="about-mini-card about-mini-card--accent">
                <h3>{copy.heroPanel3Title}</h3>
                <p>{copy.heroPanel3Body}</p>
              </article>
            </div>
          </aside>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-story-title">
        <div className="about-shell">
          <div className="about-section-heading">
            <p className="about-kicker">{copy.storyKicker}</p>
            <ContentText k="aboutPage.missionTitle" as="h2" id="about-story-title" className="about-section-title" />
            <p className="about-section-lead">{copy.storyLead}</p>
          </div>

          <div className="about-story-grid">
            <article className="about-story-card">
              <ContentText k="aboutPage.originTitle" as="h3" className="about-card-title" />
              <ContentText k="aboutPage.originBody" as="p" className="about-card-body" />
            </article>
            <article className="about-story-card">
              <ContentText k="aboutPage.valuesTitle" as="h3" className="about-card-title" />
              <ContentText k="aboutPage.valuesBody" as="p" className="about-card-body" />
            </article>
            <article className="about-story-card about-story-card--wide">
              <ContentText k="aboutPage.purposeTitle" as="h3" className="about-card-title" />
              <ContentText k="aboutPage.purposeBody" as="p" className="about-card-body" />
            </article>
          </div>
        </div>
      </section>

      <section className="about-section about-section--muted" aria-labelledby="about-mission-title">
        <div className="about-shell">
          <div className="about-section-heading about-section-heading--split">
            <div>
              <ContentText k="aboutPage.missionKicker" as="p" className="about-kicker" />
              <ContentText k="aboutPage.goalsTitle" as="h2" id="about-mission-title" className="about-section-title" />
            </div>
            <p className="about-section-lead">{copy.missionLead}</p>
          </div>

          <div className="about-mission-layout">
            <div className="about-mission-panel">
              <p className="about-mission-panel__intro">{copy.goalsIntro}</p>
              <ul className="about-goals-list">
                <li><ContentText k="aboutPage.goal1" /></li>
                <li><ContentText k="aboutPage.goal2" /></li>
                <li><ContentText k="aboutPage.goal3" /></li>
                <li><ContentText k="aboutPage.goal4" /></li>
              </ul>
            </div>
            <div className="about-mission-side">
              <article className="about-side-note">
                <h3><ContentText k="aboutPage.centerIntro" /></h3>
              </article>
              <article className="about-side-note">
                <p><ContentText k="aboutPage.eearsIntro" /></p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-services-title">
        <div className="about-shell">
          <div className="about-section-heading">
            <ContentText k="aboutPage.platformKicker" as="p" className="about-kicker" />
            <ContentText k="aboutPage.platformTitle" as="h2" id="about-services-title" className="about-section-title" />
            <p className="about-section-lead">{copy.servicesLead}</p>
          </div>

          <div className="about-service-grid">
            {platformCards.map((card) => (
              <article key={card.title} className="about-service-card">
                <h3 className="about-card-title">{card.title}</h3>
                <p className="about-card-body">{card.body}</p>
                <Link to={card.to} className="about-inline-link">
                  {t('aboutPage.activityCta')}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section about-section--team" aria-labelledby="about-team-title">
        <div className="about-shell">
          <div className="about-section-heading">
            <ContentText k="aboutPage.facultyTitle" as="p" className="about-kicker" />
            <h2 id="about-team-title" className="about-section-title">{t('aboutPage.facultyTitle')} & {t('aboutPage.adminTitle')}</h2>
            <p className="about-section-lead">{copy.teamLead}</p>
          </div>

          <div className="about-team-sections">
            <section className="about-team-section" aria-labelledby="about-team-faculty-title">
              <div className="about-team-section__head">
                <div>
                  <ContentText k="aboutPage.facultyTitle" as="h3" id="about-team-faculty-title" className="about-card-title" />
                  <ContentText k="aboutPage.facultyLead" as="p" className="about-card-body" />
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

            <section className="about-team-section" aria-labelledby="about-team-admin-title">
              <div className="about-team-section__head">
                <div>
                  <ContentText k="aboutPage.adminTitle" as="h3" id="about-team-admin-title" className="about-card-title" />
                  <ContentText k="aboutPage.adminLead" as="p" className="about-card-body" />
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
              <a
                href={EMI_CENTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="about-inline-link"
              >
                {copy.teamSiteLabel}
              </a>
            </section>
          </div>
        </div>
      </section>

      <AboutContactSection copy={copy} />
      <AboutFaqSection copy={copy} />
    </div>
  );
}
