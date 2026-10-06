import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getEnglishTableTopic, listEnglishTableWarmupLinks } from '../../data/englishTableTopics1151';
import { isEnglishTableEventType } from '../../utils/eventCapacityFields';
import './EnglishTableTopicPanel.css';

const FORMAT_KEYS = {
  conversation: 'booking.etFormatConversation',
  chart: 'booking.etFormatChart',
  passage: 'booking.etFormatPassage',
  discussion: 'booking.etFormatDiscussion',
  holiday: 'booking.etFormatHoliday',
};

export default function EnglishTableTopicPanel({
  date,
  eventType,
  variant = 'full',
  defaultOpen = true,
  showCatalogLink = false,
  showPracticeLinks = false,
}) {
  const { t } = useLanguage();
  const detailsRef = useRef(null);
  const session = isEnglishTableEventType(eventType) ? getEnglishTableTopic(date) : null;

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = Boolean(defaultOpen);
  }, [defaultOpen, date]);

  if (!session) return null;

  if (variant === 'compact') {
    return (
      <p className="et-topic-compact">
        <span className="et-topic-compact__label">{t('booking.etTopicLabel')}</span>
        {session.topic}
      </p>
    );
  }

  const formatLabel = t(FORMAT_KEYS[session.format] || 'booking.etTopicSummary');
  const weekLabel = t('booking.etTopicWeek', { week: session.week });
  const warmupLinks = showPracticeLinks ? listEnglishTableWarmupLinks(date) : [];

  return (
    <details className="et-topic" ref={detailsRef}>
      <summary className="et-topic__summary">
        <span className="et-topic__kicker">{formatLabel} · {weekLabel}</span>
        <strong className="et-topic__title">{session.topic}</strong>
      </summary>
      <div className="et-topic__body">
        {session.format === 'holiday' ? (
          <p className="et-topic__holiday">{t('booking.etTopicHoliday')}</p>
        ) : null}
        {session.lead ? <p className="et-topic__lead">{session.lead}</p> : null}
        {session.format === 'chart' || session.format === 'passage' ? (
          <p className="et-topic__note">{t('booking.etTopicChartNote')}</p>
        ) : null}
        {session.passage ? (
          <div className="et-topic__passage">
            <p className="et-topic__passage-label">{t('booking.etTopicPassageLabel')}</p>
            {session.passageTitle ? <p className="et-topic__passage-title">{session.passageTitle}</p> : null}
            <p>{session.passage}</p>
          </div>
        ) : null}
        {session.questions?.length ? (
          <ol className="et-topic__questions">
            {session.questions.map((question, index) => (
              <li key={question}>
                <span>{question}</span>
                {warmupLinks[index] ? (
                  <Link className="et-topic__practice-link" to={warmupLinks[index].href}>
                    會前練習
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
        {showCatalogLink ? (
          <p className="et-topic__catalog">
            <Link to="/activities/english-table/topics">{t('booking.etTopicCatalogLink')}</Link>
          </p>
        ) : null}
      </div>
    </details>
  );
}
