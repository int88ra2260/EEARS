import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentRecordShell from '../../components/student/StudentRecordShell';
import {
  clearSpeakingPortfolio,
  loadSpeakingPortfolio,
  removeSpeakingPortfolioCard,
  subscribeSpeakingPortfolio,
} from '../../services/speakingPortfolioStore';
import './SpeakingPortfolioPage.css';

function formatPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n)}%` : '--';
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return '';
  }
}

const PHASE_LABELS = {
  pre_activity: '會前',
  post_activity: '會後',
  diagnostic: '診斷',
};

export default function SpeakingPortfolioPage() {
  const [portfolio, setPortfolio] = useState(() => loadSpeakingPortfolio());
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => subscribeSpeakingPortfolio(setPortfolio), []);

  const stats = useMemo(() => {
    const attempts = portfolio.attempts || [];
    const scores = attempts.map((item) => Number(item.overallPercent)).filter(Number.isFinite);
    return {
      cards: portfolio.cards?.length || 0,
      attempts: attempts.length,
      average: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
      pre: attempts.filter((item) => item.activityPhase === 'pre_activity').length,
      post: attempts.filter((item) => item.activityPhase === 'post_activity').length,
    };
  }, [portfolio]);

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearSpeakingPortfolio();
    setConfirmClear(false);
  };

  return (
    <StudentRecordShell lead="收藏 English Table 題目、句型卡與口說練習摘要，讓活動前後的學習有地方留下來。">
      <main className="container speaking-portfolio-page pb-5">
        <section className="speaking-portfolio-hero">
          <div>
            <p className="speaking-portfolio-kicker">Speaking Portfolio</p>
            <h2>我的口說紀錄</h2>
            <p>這裡只保留你主動收藏的題目卡和本機練習摘要；不會取代正式學習歷程。</p>
          </div>
          <div className="speaking-portfolio-stats">
            <div><strong>{stats.cards}</strong><span>收藏卡</span></div>
            <div><strong>{stats.attempts}</strong><span>練習</span></div>
            <div><strong>{formatPercent(stats.average)}</strong><span>平均</span></div>
            <div><strong>{stats.pre}/{stats.post}</strong><span>會前/會後</span></div>
          </div>
        </section>

        <section className="speaking-portfolio-actions">
          <Link className="btn btn-primary" to="/activities/english-table/topics">找 English Table 題目</Link>
          <Link className="btn btn-outline-primary" to="/practice/speaking-diagnostic">開始口說診斷</Link>
          <button className="btn btn-outline-secondary" type="button" onClick={handleClear}>
            {confirmClear ? '再按一次清空' : '清空本機紀錄'}
          </button>
        </section>

        <div className="speaking-portfolio-grid">
          <section className="speaking-portfolio-panel">
            <div className="speaking-portfolio-panel__head">
              <h3>收藏卡片</h3>
              <span>{portfolio.cards?.length || 0}</span>
            </div>
            {portfolio.cards?.length ? (
              <div className="speaking-portfolio-card-list">
                {portfolio.cards.map((card) => (
                  <article className="speaking-portfolio-card" key={card.id}>
                    <div>
                      <span className="speaking-portfolio-card__source">{card.source} · {card.level || 'Guide'}</span>
                      <h4>{card.title}</h4>
                      <p>{card.prompt}</p>
                      {card.sample ? <pre>{card.sample}</pre> : null}
                      <div className="speaking-portfolio-tags">
                        {(card.tags || []).slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    </div>
                    <div className="speaking-portfolio-card__actions">
                      {card.href ? <Link className="btn btn-sm btn-outline-primary" to={card.href}>練習</Link> : null}
                      <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => removeSpeakingPortfolioCard(card.id)}>移除</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="speaking-portfolio-empty">
                還沒有收藏卡。到 English Table 題目頁把想練的問題收進來。
              </div>
            )}
          </section>

          <section className="speaking-portfolio-panel">
            <div className="speaking-portfolio-panel__head">
              <h3>近期練習</h3>
              <span>{portfolio.attempts?.length || 0}</span>
            </div>
            {portfolio.attempts?.length ? (
              <div className="speaking-portfolio-attempt-list">
                {portfolio.attempts.map((attempt) => (
                  <article className="speaking-portfolio-attempt" key={attempt.attemptUid}>
                    <div>
                      <span>{attempt.source} · {PHASE_LABELS[attempt.activityPhase] || '練習'} · {formatDate(attempt.submittedAt)}</span>
                      <h4>{attempt.title}</h4>
                    </div>
                    <div className="speaking-portfolio-attempt__metrics">
                      <div><strong>{formatPercent(attempt.overallPercent)}</strong><span>總分</span></div>
                      <div><strong>{formatPercent(attempt.completionPercent ?? attempt.overallPercent)}</strong><span>完成度</span></div>
                    </div>
                    {attempt.advice ? <p>{attempt.advice}</p> : null}
                    {attempt.href ? <Link className="btn btn-sm btn-outline-primary" to={attempt.href}>再練一次</Link> : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="speaking-portfolio-empty">
                完成 English Table Warm-up 或 Review 後，練習摘要會自動出現在這裡。
              </div>
            )}
          </section>
        </div>
      </main>
    </StudentRecordShell>
  );
}
