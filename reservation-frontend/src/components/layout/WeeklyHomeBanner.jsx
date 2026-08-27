import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { extractModalTeaser } from '../../constants/weeklyBlocks';
import { formatMessage } from '../../utils/formatMessage';
import './WeeklyHomeBanner.css';

function formatWeekRange(weekStart, weekEnd, lang) {
  if (!weekStart || !weekEnd) return '';
  try {
    const opts = { month: 'short', day: 'numeric' };
    const locale = lang === 'en' ? 'en-US' : 'zh-TW';
    const start = new Date(`${weekStart}T00:00:00`);
    const end = new Date(`${weekEnd}T00:00:00`);
    const fmt = (d) => d.toLocaleDateString(locale, opts);
    return `${fmt(start)} – ${fmt(end)}`;
  } catch {
    return `${weekStart} – ${weekEnd}`;
  }
}

/**
 * 手機首頁週報：非阻擋橫幅，不鎖捲動、不蓋住預約入口。
 */
export default function WeeklyHomeBanner({ weekly, onDismiss }) {
  const { t, lang } = useLanguage();

  const hasBlocks = Array.isArray(weekly?.blocks) && weekly.blocks.length > 0;
  const heroBlock = hasBlocks ? weekly.blocks.find((b) => b.type === 'hero') : null;
  const heroProps = heroBlock?.props || {};

  const teaser = useMemo(() => {
    if (!weekly) return { headline: '', learningTip: '' };
    if (hasBlocks) return extractModalTeaser(weekly.blocks);
    return {
      headline: weekly.headline || '',
      learningTip: weekly.learningTip || '',
    };
  }, [weekly, hasBlocks]);

  if (!weekly) return null;

  const title = heroProps.title || weekly.title || t('weekly.title');
  const headline = hasBlocks
    ? (teaser.headline || heroProps.subtitle || t('weekly.defaultHeadline'))
    : (teaser.headline || weekly.headline || t('weekly.defaultHeadline'));
  const weekRange = formatWeekRange(weekly.weekStart, weekly.weekEnd, lang);
  const issueLabel = weekRange
    ? `${formatMessage(t('weekly.issueLabel'), { issue: weekly.issueKey })} · ${weekRange}`
    : '';

  return (
    <aside className="weekly-home-banner" aria-label={t('weekly.title')}>
      <div className="weekly-home-banner__card">
        <div className="weekly-home-banner__copy">
          <p className="weekly-home-banner__kicker">{heroProps.kicker || t('weekly.kicker')}</p>
          <p className="weekly-home-banner__title">{title}</p>
          {issueLabel ? <p className="weekly-home-banner__meta">{issueLabel}</p> : null}
          <p className="weekly-home-banner__headline">{headline}</p>
        </div>
        <div className="weekly-home-banner__actions">
          <Link
            to={`/weekly/${weekly.slug || weekly.issueKey}`}
            className="btn btn-primary btn-sm"
            onClick={onDismiss}
          >
            {t('weekly.readFull')}
          </Link>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onDismiss}>
            {t('weekly.later')}
          </button>
        </div>
      </div>
    </aside>
  );
}
