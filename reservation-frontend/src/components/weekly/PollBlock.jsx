import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useLanguage } from '../../context/LanguageContext';
import { getWeeklyVoterId } from '../../utils/weeklyVoter';
import { fetchPollResults, submitPollVote } from '../../services/weeklyInteractionApi';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) return vars.default || key;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

export default function PollBlock({ blockId, slug, props }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const voterKey = getWeeklyVoterId();

  const load = useCallback(async () => {
    if (!slug || !blockId) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchPollResults({ slug, blockId, voterKey });
      setData(result);
      if (result.userVote?.length) setSelected(result.userVote);
    } catch {
      setError(t('weekly.pollLoadError'));
    } finally {
      setLoading(false);
    }
  }, [slug, blockId, voterKey, t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (optionId) => {
    if (data?.userVote?.length) return;
    if (props?.allowMultiple) {
      setSelected((prev) => (
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      ));
    } else {
      setSelected([optionId]);
    }
  };

  const onSubmit = async () => {
    if (!selected.length) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await submitPollVote({ slug, blockId, optionIds: selected, voterKey });
      setData(result);
    } catch (err) {
      setError(err.message || t('weekly.pollVoteError'));
    } finally {
      setSubmitting(false);
    }
  };

  const hasVoted = Boolean(data?.userVote?.length);
  const showResults = props?.showResults === 'always'
    || (props?.showResults !== 'never' && hasVoted);

  if (loading) return <p className="text-muted small mb-0">{t('weekly.pollLoading')}</p>;
  if (!props?.question) return null;

  return (
    <section className="wb-poll public-card">
      <h2 className="wb-section-title">{props.question}</h2>
      {error ? <p className="text-danger small">{error}</p> : null}
      {!showResults ? (
        <div className="wb-poll__options">
          {(props.options || []).map((opt) => {
            const isOn = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={`wb-poll__option${isOn ? ' is-selected' : ''}`}
                onClick={() => toggle(opt.id)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="wb-poll__results">
          {(data?.options || props.options || []).map((opt) => {
            const result = data?.options?.find((o) => o.id === opt.id);
            const percent = result?.percent ?? 0;
            const count = result?.count ?? 0;
            return (
              <div key={opt.id} className="wb-poll__result-row">
                <div className="wb-poll__result-label">
                  <span>{opt.label}</span>
                  <span className="text-muted small">{percent}% ({count})</span>
                </div>
                <div className="wb-poll__bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-muted small mb-0 mt-2">
            {formatMessage(t, 'weekly.pollTotalVotes', { count: data?.totalVotes || 0 })}
          </p>
        </div>
      )}
      {!hasVoted && !showResults ? (
        <Button
          className="mt-3"
          size="sm"
          variant="primary"
          disabled={!selected.length || submitting}
          onClick={onSubmit}
        >
          {submitting ? t('weekly.pollSubmitting') : t('weekly.pollSubmit')}
        </Button>
      ) : null}
      {hasVoted ? <p className="text-muted small mb-0 mt-2">{t('weekly.pollThanks')}</p> : null}
    </section>
  );
}
