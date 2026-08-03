import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { HOME_IMMERSIVE_JOURNEY } from '../../constants/homeImmersiveTestConfig';
import DioramaScene from '../scrollWorld/DioramaScene';

/**
 * 四島敘事：B 質感 diorama + 飛入切島 + 右側路徑；仍保留導流 CTA（A 職能）
 */
export default function HomeImmersiveJourney({ onSelectStep }) {
  const { lang } = useLanguage();
  const locale = lang === 'en' ? 'en' : 'zh';

  return (
    <section
      id="hit-journey"
      className="hit-journey hit-journey--islands"
      aria-labelledby="hit-journey-title"
      data-hit-journey
    >
      <div className="hit-journey__sky" aria-hidden="true">
        <div className="hit-journey__sky-grad" />
        <div className="hit-journey__sky-glow" />
        <div className="hit-journey__particles">
          {[
            { left: '12%', top: '18%' },
            { left: '28%', top: '42%' },
            { left: '48%', top: '22%' },
            { left: '66%', top: '58%' },
            { left: '82%', top: '34%' },
            { left: '18%', top: '72%' },
            { left: '54%', top: '78%' },
            { left: '88%', top: '68%' },
          ].map((pos, i) => (
            <span
              key={i}
              className={`hit-journey__pt${i % 3 === 0 ? ' hit-journey__pt--ring' : ''}`}
              style={{ left: pos.left, top: pos.top, animationDelay: `${-i * 1.4}s` }}
            />
          ))}
        </div>
      </div>

      <div className="hit-journey__pin">
        <div className="hit-journey__stage" aria-hidden="true">
          {HOME_IMMERSIVE_JOURNEY.map((step) => (
            <div
              key={step.id}
              className="hit-journey__scene"
              data-hit-scene={step.id}
              style={{ '--hit-accent': step.accent }}
            >
              <div className="hit-journey__diorama-wrap">
                <DioramaScene variant={step.diorama} accent={step.accent} />
              </div>
            </div>
          ))}
        </div>

        <div className="hit-journey__copylayer">
          <p className="hit-journey__world-kicker" id="hit-journey-title">
            {locale === 'en' ? 'EEARS World · Four islands' : 'EEARS World · 四座島嶼'}
          </p>

          {HOME_IMMERSIVE_JOURNEY.map((step, index) => (
            <article
              key={step.id}
              className="hit-journey__panel"
              data-hit-journey-panel={step.id}
              style={{ '--hit-accent': step.accent }}
            >
              <span className="hit-journey__num">{String(index + 1).padStart(2, '0')}</span>
              <span className="hit-journey__eyebrow">{step.eyebrow[locale]}</span>
              <h3 className="hit-journey__title">{step.title[locale]}</h3>
              <p className="hit-journey__body">{step.body[locale]}</p>
              <ul className="hit-journey__tags">
                {step.tags[locale].map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
              <Link to={step.cta.to} className="hit-btn hit-btn--accent">
                {step.cta[locale]}
              </Link>
            </article>
          ))}
        </div>

        <nav className="hit-journey__route" aria-label={locale === 'en' ? 'Island path' : '島嶼路徑'}>
          {HOME_IMMERSIVE_JOURNEY.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={`hit-journey__route-dot${index === 0 ? ' is-active' : ''}`}
              data-hit-journey-dot={step.id}
              aria-label={step.label[locale]}
              onClick={() => onSelectStep?.(index)}
            >
              <i aria-hidden="true" />
              <span className="hit-journey__route-label">{step.label[locale]}</span>
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
