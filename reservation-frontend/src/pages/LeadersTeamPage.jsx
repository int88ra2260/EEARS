import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import {
  leaderFieldRows,
  leaderMonogram,
  listLeaders,
  youtubeEmbedUrl,
} from '../data/leadersTeam';
import { fetchPublicLeaders } from '../services/leadersTeamPublicApi';
import './LeadersTeamPage.css';

// 預設輪播圖片（API 未返回時使用）
const DEFAULT_SLIDES = [
  { src: '/images/leaders/nice-to-meet-you.jpg', altKey: 'leadersTeam.slideNiceAlt' },
  { src: '/images/leaders/group-hall.jpg', altKey: 'leadersTeam.slideHallAlt' },
  { src: '/images/leaders/writing-awards.jpg', altKey: 'leadersTeam.slideAwardsAlt' },
];

const SLIDE_INTERVAL_MS = 5000;

function shouldAutoplay() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function LeadersPhotoCarousel({ t, lang, slides: apiSlides }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(shouldAutoplay);

  // 優先使用 API 返回的輪播圖片，否則用預設
  const slides = useMemo(() => {
    if (Array.isArray(apiSlides) && apiSlides.length > 0) {
      return apiSlides.map((s) => ({
        src: s.imageUrl,
        alt: lang === 'en' ? (s.alt?.en || s.alt?.zh || '') : (s.alt?.zh || s.alt?.en || ''),
      }));
    }
    return DEFAULT_SLIDES.map((s) => ({
      src: s.src,
      alt: t(s.altKey),
    }));
  }, [apiSlides, lang, t]);

  const count = slides.length;
  const slide = slides[index];

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % count);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, count]);

  const go = (delta) => {
    setIndex((current) => (current + delta + count) % count);
  };

  return (
    <section
      className="leaders-carousel"
      aria-roledescription="carousel"
      aria-label={t('leadersTeam.carouselLabel')}
    >
      <div className="leaders-carousel__frame">
        <img src={slide.src} alt={slide.alt} />
        <div className="leaders-carousel__transport">
          <button
            type="button"
            aria-pressed={!playing}
            onClick={() => setPlaying(false)}
          >
            {t('leadersTeam.pause')}
          </button>
          <button
            type="button"
            aria-pressed={playing}
            onClick={() => setPlaying(true)}
          >
            {t('leadersTeam.play')}
          </button>
        </div>
        <button
          type="button"
          className="leaders-carousel__nav leaders-carousel__nav--prev"
          aria-label={t('leadersTeam.prev')}
          onClick={() => go(-1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          className="leaders-carousel__nav leaders-carousel__nav--next"
          aria-label={t('leadersTeam.next')}
          onClick={() => go(1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {t('leadersTeam.slideStatus', { current: index + 1, total: count })}
      </p>
    </section>
  );
}

const FIELD_LABEL_KEYS = {
  degree: 'leadersTeam.degree',
  experience: 'leadersTeam.experience',
  languages: 'leadersTeam.languages',
  focus: 'leadersTeam.focus',
};

function LeaderNameplate({ name, meta }) {
  return (
    <div className="leader-nameplate">
      <p className="leader-nameplate__name">
        <span className="leader-nameplate__mark" aria-hidden="true">EMI</span>
        {name}
      </p>
      <p className="leader-nameplate__meta">{meta}</p>
    </div>
  );
}

function LeaderCard({ leader, t }) {
  const rows = leaderFieldRows(leader);
  const videoSrc = youtubeEmbedUrl(leader.videoId);
  const photo = String(leader.photo || '').trim();

  return (
    <article className="leader-card">
      <div className="leader-card__photo">
        {photo ? (
          <img src={photo} alt={t('leadersTeam.photoAlt', { name: leader.name })} />
        ) : (
          <span className="leader-card__monogram" aria-hidden="true">{leaderMonogram(leader.name)}</span>
        )}
      </div>

      <div className="leader-card__body">
        <h2>{leader.name}</h2>
        <p className="leader-card__role">{t('leadersTeam.role')}</p>
        {rows.length > 0 ? (
          <dl className="leader-fields">
            {rows.map((row) => (
              <div key={row.key}>
                <dt>{t(FIELD_LABEL_KEYS[row.key])}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="leader-card__board">
        {videoSrc ? (
          <iframe
            className="leader-card__video"
            src={videoSrc}
            title={t('leadersTeam.videoTitle', { name: leader.name })}
            allow="fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <LeaderNameplate name={leader.name} meta={t('leadersTeam.nameplateMeta')} />
        )}
      </div>
    </article>
  );
}

export default function LeadersTeamPage() {
  const { t, lang } = useLanguage();
  const [leaders, setLeaders] = useState(() => listLeaders());
  const [loadedFromApi, setLoadedFromApi] = useState(false);
  const [carousel, setCarousel] = useState([]);
  const [textOverrides, setTextOverrides] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetchPublicLeaders()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.leaders)) {
          setLeaders(data.leaders);
          setLoadedFromApi(true);
        }
        if (Array.isArray(data?.carousel)) {
          setCarousel(data.carousel);
        }
        if (data?.textOverrides && typeof data.textOverrides === 'object') {
          setTextOverrides(data.textOverrides);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 取得文案：優先使用後台覆寫，否則用 i18n 預設
  const getText = (key) => {
    const override = textOverrides[key];
    if (override) {
      const text = lang === 'en' ? (override.en || override.zh) : (override.zh || override.en);
      if (text) return text;
    }
    return t(key);
  };

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.activities'), path: '/activities' },
    { label: t('activities.englishTable'), path: '/activities/english-table' },
    { label: getText('leadersTeam.pageTitle') },
  ];

  return (
    <div className="leaders-team-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={getText('leadersTeam.pageTitle')}
        lead={getText('leadersTeam.pageLead')}
      />

      <section className="leaders-team-intro" aria-labelledby="leaders-team-intro-title">
        <h2 id="leaders-team-intro-title">{getText('leadersTeam.introTitle')}</h2>
        <p>{getText('leadersTeam.intro')}</p>
      </section>

      <LeadersPhotoCarousel t={t} lang={lang} slides={carousel} />

      <section className="leaders-team-list" aria-labelledby="leaders-team-list-title">
        <h2 id="leaders-team-list-title" className="visually-hidden">{getText('leadersTeam.listTitle')}</h2>
        {loadedFromApi && leaders.length === 0 ? (
          <p>{t('leadersTeam.empty')}</p>
        ) : (
          leaders.map((leader) => (
            <LeaderCard key={leader.id} leader={leader} t={t} />
          ))
        )}
      </section>

      <div className="leaders-team-actions">
        <Link to="/activities" className="btn btn-outline-primary">
          {t('leadersTeam.backToActivities')}
        </Link>
        <Link to="/activities/english-table" className="btn btn-primary">
          {t('leadersTeam.bookEnglishTable')}
        </Link>
      </div>
    </div>
  );
}
