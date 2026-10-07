import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getEnglishTableTopic, listEnglishTableReviewLinks, listEnglishTableWarmupLinks } from '../../data/englishTableTopics1151';
import { loadSpeakingPortfolio, saveSpeakingPortfolioCard } from '../../services/speakingPortfolioStore';
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
  showReviewLinks = false,
}) {
  const { t } = useLanguage();
  const detailsRef = useRef(null);
  const session = isEnglishTableEventType(eventType) ? getEnglishTableTopic(date) : null;
  const [savedKeys, setSavedKeys] = useState(() => new Set(loadSpeakingPortfolio().cards.map((item) => item.stableKey)));

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
  const reviewLinks = showReviewLinks ? listEnglishTableReviewLinks(date) : [];
  const baseTags = useMemo(() => ['English Table', session.format, session.topic].filter(Boolean), [session.format, session.topic]);

  const saveQuestionCard = (question, index) => {
    const stableKey = `english-table:${date}:q${index + 1}`;
    saveSpeakingPortfolioCard({
      stableKey,
      type: 'prompt',
      source: 'English Table',
      title: `${session.topic} Q${index + 1}`,
      prompt: question,
      sample: 'A2: I think... because...\nB1: One reason is... For example...\nB2: From my perspective..., although...',
      level: index < 2 ? 'A2' : index < 4 ? 'B1' : 'B2',
      tags: baseTags,
      href: warmupLinks[index]?.href || reviewLinks[index]?.href || '/student/speaking-portfolio',
    });
    setSavedKeys((prev) => new Set([...prev, stableKey]));
  };

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
                {reviewLinks[index] ? (
                  <Link className="et-topic__practice-link et-topic__practice-link--review" to={reviewLinks[index].href}>
                    活動後複習
                  </Link>
                ) : null}
                <button
                  className="et-topic__save-card"
                  type="button"
                  onClick={() => saveQuestionCard(question, index)}
                >
                  {savedKeys.has(`english-table:${date}:q${index + 1}`) ? '已收藏' : '收藏題目'}
                </button>
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
