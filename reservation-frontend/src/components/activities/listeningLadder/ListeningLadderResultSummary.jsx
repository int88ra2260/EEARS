import React from 'react';
import { Link } from 'react-router-dom';
import GameCefrDisclaimer from '../shared/GameCefrDisclaimer';
import { getListeningLadderBest } from '../../../services/listeningLadderLocalStore';
import './ListeningLadderGame.css';

function formatDuration(ms) {
  if (!ms) return '—';
  const sec = Math.round(ms / 1000);
  return `${sec}s`;
}

export default function ListeningLadderResultSummary({
  t,
  result,
  onPlayAgain,
}) {
  const best = getListeningLadderBest();
  const answerLog = result.answerLog || [];

  return (
    <div className="listening-ladder-results">
      <p className="listening-ladder-kicker">{t('listeningLadder.resultsKicker')}</p>
      <h3 className="listening-ladder-title">{t('listeningLadder.resultsTitle')}</h3>

      <dl className="listening-ladder-results__grid">
        <div>
          <dt>{t('listeningLadder.resultScore')}</dt>
          <dd>{result.score}</dd>
        </div>
        <div>
          <dt>{t('listeningLadder.resultCorrect')}</dt>
          <dd>{result.correctCount}</dd>
        </div>
        <div>
          <dt>{t('listeningLadder.resultAccuracy')}</dt>
          <dd>{result.accuracy}%</dd>
        </div>
        <div>
          <dt>{t('listeningLadder.resultHighest')}</dt>
          <dd>{result.highestLevelReached}</dd>
        </div>
        <div>
          <dt>{t('listeningLadder.resultStreak')}</dt>
          <dd>{result.bestStreak}</dd>
        </div>
        <div>
          <dt>{t('listeningLadder.resultWords')}</dt>
          <dd>{result.wordsHeard?.length ?? 0}</dd>
        </div>
        <div>
          <dt>{t('listeningLadder.resultDuration')}</dt>
          <dd>{formatDuration(result.durationMs)}</dd>
        </div>
      </dl>

      {answerLog.length > 0 ? (
        <section className="listening-ladder-answer-log" aria-labelledby="listening-ladder-answer-log-title">
          <h4 id="listening-ladder-answer-log-title" className="listening-ladder-answer-log__title">
            {t('listeningLadder.resultAnswerLog')}
          </h4>
          <ul className="listening-ladder-answer-log__list">
            {answerLog.map((entry, index) => (
              <li
                key={`${entry.word}-${index}`}
                className={`listening-ladder-answer-log__item${
                  entry.isCorrect ? ' listening-ladder-answer-log__item--correct' : ' listening-ladder-answer-log__item--incorrect'
                }`}
              >
                <span className="listening-ladder-answer-log__index">{index + 1}</span>
                <div className="listening-ladder-answer-log__main">
                  <span className="listening-ladder-answer-log__word">{entry.word}</span>
                  <span className="listening-ladder-answer-log__meta">
                    {t('listeningLadder.resultAnswerSelected', { answer: entry.selectedText })}
                    {' · '}
                    {t('listeningLadder.resultAnswerExpected', { answer: entry.translationZh })}
                  </span>
                </div>
                <span className="listening-ladder-answer-log__status" aria-label={entry.isCorrect ? t('listeningLadder.resultAnswerCorrect') : t('listeningLadder.resultAnswerWrong')}>
                  {entry.isCorrect ? '✓' : '✗'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {best ? (
        <p className="listening-ladder-results__best">
          {t('listeningLadder.personalBest', { score: best.score, level: best.highestLevelReached })}
        </p>
      ) : null}

      <GameCefrDisclaimer text={t('listeningLadder.cefrDisclaimer')} />

      <div className="listening-ladder-results__actions">
        <button type="button" className="btn btn-primary" onClick={onPlayAgain}>
          {t('listeningLadder.playAgain')}
        </button>
        <Link to="/guides/activity-phrasebook" className="btn btn-outline-secondary">
          {t('listeningLadder.phrasebookCta')}
        </Link>
        <Link to="/activities" className="btn btn-link">
          {t('listeningLadder.backToActivities')}
        </Link>
      </div>
    </div>
  );
}
