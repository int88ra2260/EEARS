import React, { useEffect, useState } from 'react';
import { fetchSpeakingHostAudio } from '../services/speakingCheckApi';

const SCALES = [
  { key: 'fluency', label: '流暢度', hint: '停頓、重來、速度', required: true },
  { key: 'pronunciationIntelligibility', label: '可懂度', hint: '聽得懂幾個字', required: true },
  { key: 'taskAchievement', label: '完成度', hint: '有沒有念完題目', required: true },
  { key: 'grammar', label: '文法', hint: '讀稿時可留空', required: false },
  { key: 'vocabulary', label: '用字', hint: '有沒有換成別的字', required: false },
];

const WORD_STATUS = {
  missing: '沒念到',
  ending: '字尾不清',
  unknown: '尚未對上',
};

function formatPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}%` : '—';
}

function formatDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return '';
  const seconds = Math.max(1, Math.round(n / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${seconds % 60} 秒`;
}

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function draftFromRating(rating) {
  return {
    fluency: rating?.fluency || '',
    pronunciationIntelligibility: rating?.pronunciationIntelligibility || '',
    taskAchievement: rating?.taskAchievement || '',
    grammar: rating?.grammar || '',
    vocabulary: rating?.vocabulary || '',
    comments: rating?.comments || '',
  };
}

function ResponseAudio({ responseId }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    fetchSpeakingHostAudio(responseId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [responseId]);

  if (failed) return <p className="speaking-host-muted">錄音無法播放</p>;
  if (!src) return <p className="speaking-host-muted">正在載入錄音…</p>;
  return <audio className="speaking-host-audio" controls src={src}><track kind="captions" /></audio>;
}

export default function SpeakingHostResponseReview({ response, targetText, onSave }) {
  const [draft, setDraft] = useState(() => draftFromRating(response.rating));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(response.rating ? '已儲存' : '');
  const [error, setError] = useState('');
  const words = Array.isArray(response.wordResults) ? response.wordResults : [];
  const missed = words.filter((word) => WORD_STATUS[word.status]);
  const matchedCount = words.filter((word) => word.status === 'matched').length;
  const ready = SCALES.filter((scale) => scale.required).every((scale) => draft[scale.key]);
  const duration = formatDuration(response.durationMs);
  const when = formatWhen(response.submittedAt);
  const pauseLabel = Number.isFinite(Number(response.pauseCount)) ? `停頓 ${response.pauseCount} 次` : '';

  const choose = (key, value) => {
    setDraft((current) => ({ ...current, [key]: current[key] === value ? '' : value }));
    setMessage('');
  };

  const save = async (event) => {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(response.id, {
        ...draft,
        grammar: draft.grammar || null,
        vocabulary: draft.vocabulary || null,
        comments: draft.comments,
      });
      setMessage('已儲存。這份評分會留下來，之後用來對照自動分數。');
    } catch (err) {
      setError(err.message || '無法儲存評分');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="speaking-host-review">
      <p className="speaking-host-passage">{targetText}</p>
      {response.hasAudio ? <ResponseAudio responseId={response.id} /> : <p className="speaking-host-muted">這次沒有留下錄音。</p>}
      <p className="speaking-host-meta">
        {[duration && `念了 ${duration}`, pauseLabel, when && `${when} 送出`].filter(Boolean).join(' · ')}
      </p>
      <div className="speaking-host-scores" aria-label="自動回饋">
        <span><small>流暢度</small>{formatPercent(response.fluencyPercent)}</span>
        <span><small>完成度</small>{formatPercent(response.completionPercent)}</span>
        <span><small>可懂度</small>{formatPercent(response.pronunciationPercent)}</span>
      </div>
      <p className="speaking-host-transcript">
        <small>學生念出來的</small>
        {response.transcript || '沒有辨識到文字'}
      </p>
      <p className="speaking-host-meta">
        {words.length ? `對上 ${matchedCount} 個字` : '還沒有逐字對照'}
        {missed.length ? `，有 ${missed.length} 個地方不一樣` : ''}
      </p>
      {missed.length ? (
        <ul className="speaking-host-words">
          {missed.slice(0, 24).map((word) => (
            <li key={`${word.index}-${word.word}`}>
              <span>{word.word}</span>
              <small>{WORD_STATUS[word.status]}</small>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="speaking-host-rating" onSubmit={save}>
        <p className="speaking-host-kicker">老師評分</p>
        {SCALES.map((scale) => (
          <fieldset key={scale.key}>
            <legend>
              {scale.label}
              <small>{scale.hint}</small>
            </legend>
            <div className="speaking-host-scale">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={Number(draft[scale.key]) === value ? 'is-selected' : ''}
                  aria-pressed={Number(draft[scale.key]) === value}
                  onClick={() => choose(scale.key, value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <label htmlFor={`rating-note-${response.id}`}>備註</label>
        <textarea
          id={`rating-note-${response.id}`}
          value={draft.comments}
          maxLength={2000}
          placeholder="例如：第三句重來了兩次，company 聽不清楚"
          onChange={(event) => {
            setDraft((current) => ({ ...current, comments: event.target.value }));
            setMessage('');
          }}
        />
        {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
        {message ? <p className="speaking-host-meta">{message}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={!ready || saving}>
          {saving ? '儲存中...' : '儲存評分'}
        </button>
      </form>
    </div>
  );
}
