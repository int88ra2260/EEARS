import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import {
  clearSpeakingHostToken,
  closeSpeakingHostSet,
  createSpeakingHostSet,
  fetchSpeakingHostResults,
  fetchSpeakingHostSet,
  fetchSpeakingHostSets,
  publishSpeakingHostSet,
  readSpeakingHostToken,
  saveSpeakingHostRating,
  updateSpeakingHostSet,
} from '../services/speakingCheckApi';
import SpeakingHostResponseReview from './SpeakingHostResponseReview';
import './SpeakingHostPage.css';

const STATUS_LABEL = {
  draft: '草稿',
  published: '進行中',
  closed: '已結束',
};

function blankItems() {
  return [
    { key: 'a', title: '', targetText: '' },
    { key: 'b', title: '', targetText: '' },
  ];
}

function formatCode(code) {
  const digits = String(code || '');
  if (digits.length !== 6) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export default function SpeakingHostPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState(blankItems);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(null);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const readyCount = useMemo(
    () => items.filter((item) => item.targetText.trim().length >= 8).length,
    [items],
  );

  const loadSets = async () => {
    const data = await fetchSpeakingHostSets();
    setSets(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (!readSpeakingHostToken()) {
      navigate('/practice/speaking-host/login', { replace: true });
      return undefined;
    }
    let cancelled = false;
    loadSets()
      .catch((err) => {
        if (!cancelled) {
          if (err.status === 401) navigate('/practice/speaking-host/login', { replace: true });
          else setError(err.message || '無法載入題組');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const openNew = () => {
    setEditingId(null);
    setTitle('');
    setItems(blankItems());
    setPublished(null);
    setResults(null);
    setError('');
    setMode('edit');
  };

  const openExisting = async (setId) => {
    setError('');
    setSaving(true);
    try {
      const data = await fetchSpeakingHostSet(setId);
      setEditingId(data.id);
      setTitle(data.title === '未命名題組' ? '' : data.title);
      setItems((data.items || blankItems()).map((item) => ({
        key: String(item.id),
        title: item.title || '',
        targetText: item.targetText || '',
      })));
      setPublished(data.status === 'published' ? data : null);
      setMode(data.status === 'draft' ? 'edit' : 'published');
    } catch (err) {
      setError(err.message || '無法開啟題組');
    } finally {
      setSaving(false);
    }
  };

  const payload = () => ({
    title,
    items: items.map((item) => ({ title: item.title, targetText: item.targetText })),
  });

  const saveDraft = async () => {
    setSaving(true);
    setError('');
    try {
      const data = editingId
        ? await updateSpeakingHostSet(editingId, payload())
        : await createSpeakingHostSet(payload());
      setEditingId(data.id);
      await loadSets();
      return data;
    } catch (err) {
      setError(err.message || '無法儲存');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const saved = await saveDraft();
    if (!saved) return;
    setSaving(true);
    try {
      const data = await publishSpeakingHostSet(saved.id);
      setPublished(data);
      setMode('published');
      await loadSets();
    } catch (err) {
      setError(err.message || '無法公布');
    } finally {
      setSaving(false);
    }
  };

  const openResults = async (setId) => {
    setError('');
    setSaving(true);
    try {
      const data = await fetchSpeakingHostResults(setId);
      setResults(data);
      setMode('results');
    } catch (err) {
      setError(err.message || '無法載入結果');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!published?.id) return;
    setSaving(true);
    try {
      await closeSpeakingHostSet(published.id);
      setMode('list');
      setPublished(null);
      await loadSets();
    } catch (err) {
      setError(err.message || '無法結束題組');
    } finally {
      setSaving(false);
    }
  };

  const saveRating = async (responseId, draft) => {
    const saved = await saveSpeakingHostRating(responseId, draft);
    setResults((current) => {
      if (!current) return current;
      const participants = current.participants.map((participant) => ({
        ...participant,
        responses: participant.responses.map((response) => (
          response && response.id === responseId ? { ...response, rating: saved } : response
        )),
      }));
      const ratedCount = participants.reduce(
        (sum, participant) => sum + participant.responses.filter((response) => response?.rating).length,
        0,
      );
      return {
        ...current,
        participants,
        summary: { ...current.summary, ratedCount },
      };
    });
    return saved;
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const logout = () => {
    clearSpeakingHostToken();
    navigate('/practice/speaking-host/login');
  };

  return (
    <div className="speaking-host-page">
      <PageHeader
        breadcrumbs={[
          { label: '首頁', path: '/' },
          { label: '口說題組' },
        ]}
        title="口說題組"
        lead="一個題組裡有多題。公布後學生用代碼加入，並依序念完。"
        actions={(
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={logout}>登出</button>
        )}
      />
      <main className="container pb-5">
        {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

        {mode === 'list' ? (
          <section className="speaking-host-panel" aria-label="題組列表">
            <div className="speaking-host-panel__bar">
              <h2>我的題組</h2>
              <button className="btn btn-primary" type="button" onClick={openNew}>新題組</button>
            </div>
            {loading ? <p className="speaking-host-muted">載入中...</p> : null}
            {!loading && sets.length === 0 ? (
              <div className="speaking-host-empty">
                <strong>還沒有題組</strong>
                <p>先寫兩題以上的英文，再公布代碼給學生。</p>
              </div>
            ) : null}
            <div className="speaking-host-set-list">
              {sets.map((set) => (
                <article key={set.id} className="speaking-host-set-card">
                  <div>
                    <span className={`speaking-host-status speaking-host-status--${set.status}`}>{STATUS_LABEL[set.status] || set.status}</span>
                    <h3>{set.title}</h3>
                    <p>{set.itemCount} 題 · {set.participantCount} 人加入{set.joinCode ? ` · 代碼 ${formatCode(set.joinCode)}` : ''}</p>
                  </div>
                  <div className="speaking-host-set-card__actions">
                    {set.status === 'draft' ? (
                      <button className="btn btn-outline-primary" type="button" onClick={() => openExisting(set.id)}>繼續編輯</button>
                    ) : (
                      <button className="btn btn-primary" type="button" onClick={() => openResults(set.id)}>查看結果</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {mode === 'edit' ? (
          <section className="speaking-host-panel" aria-label="編輯題組">
            <button className="btn btn-link speaking-host-back" type="button" onClick={() => setMode('list')}>回到題組列表</button>
            <label htmlFor="speaking-set-title">題組名稱</label>
            <input
              id="speaking-set-title"
              className="form-control"
              value={title}
              placeholder="例如：週三口說暖身"
              onChange={(event) => setTitle(event.target.value)}
            />
            <ol className="speaking-host-questions">
              {items.map((item, index) => (
                <li key={item.key}>
                  <div className="speaking-host-question__head">
                    <strong>第 {index + 1} 題</strong>
                    {items.length > 2 ? (
                      <button
                        className="btn btn-link"
                        type="button"
                        onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                      >
                        移除
                      </button>
                    ) : null}
                  </div>
                  <label htmlFor={`speaking-item-${item.key}`}>學生要念的英文</label>
                  <textarea
                    id={`speaking-item-${item.key}`}
                    className="form-control"
                    rows={3}
                    value={item.targetText}
                    placeholder="Write one or two sentences."
                    onChange={(event) => {
                      const next = event.target.value;
                      setItems((current) => current.map((entry) => (
                        entry.key === item.key ? { ...entry, targetText: next } : entry
                      )));
                    }}
                  />
                </li>
              ))}
            </ol>
            <button
              className="btn btn-outline-primary"
              type="button"
              disabled={items.length >= 8}
              onClick={() => setItems((current) => [...current, { key: `n-${Date.now()}`, title: '', targetText: '' }])}
            >
              加一題
            </button>
            <p className="speaking-host-muted">已完成 {readyCount} 題。至少 2 題、每題一句完整英文，才能公布。</p>
            <div className="speaking-host-actions">
              <button className="btn btn-outline-primary" type="button" disabled={saving} onClick={saveDraft}>
                {saving ? '儲存中...' : '儲存草稿'}
              </button>
              <button className="btn btn-primary" type="button" disabled={saving || readyCount < 2} onClick={handlePublish}>
                公布題組
              </button>
            </div>
          </section>
        ) : null}

        {mode === 'published' && published ? (
          <section className="speaking-host-panel speaking-host-publish" aria-label="加入代碼">
            <p className="speaking-host-kicker">題組已公布</p>
            <h2>{published.title}</h2>
            <p>請學生打開口說檢測，輸入這個代碼。</p>
            <p className="speaking-host-code" aria-label={`加入代碼 ${published.joinCode}`}>{formatCode(published.joinCode)}</p>
            <div className="speaking-host-actions">
              <button className="btn btn-primary" type="button" onClick={() => copyCode(published.joinCode)}>
                {copied ? '已複製' : '複製代碼'}
              </button>
              <Link className="btn btn-outline-primary" to={`/practice/speaking-check?code=${published.joinCode}`}>開啟學生頁</Link>
              <button className="btn btn-outline-primary" type="button" onClick={() => openResults(published.id)}>查看結果</button>
            </div>
            <button className="btn btn-link" type="button" disabled={saving} onClick={handleClose}>結束這個題組</button>
          </section>
        ) : null}

        {mode === 'results' && results ? (
          <section className="speaking-host-panel speaking-host-panel--review" aria-label="題組結果">
            <button className="btn btn-link speaking-host-back" type="button" onClick={() => setMode('list')}>回到題組列表</button>
            <div className="speaking-host-results-head">
              <div>
                <h2>{results.set.title}</h2>
                <p>{results.set.joinCode ? `代碼 ${formatCode(results.set.joinCode)}` : '尚未公布'} · {STATUS_LABEL[results.set.status]}</p>
                <p>百分比是自動回饋。錄音可以重聽，你的 1 到 5 分會留下來，之後用來對照自動分數。</p>
              </div>
              <div className="speaking-host-stats">
                <span><strong>{results.summary.participantCount}</strong>人加入</span>
                <span><strong>{results.summary.completedCount}</strong>人完成全部</span>
                <span><strong>{results.summary.ratedCount || 0}</strong>題已評分</span>
              </div>
            </div>
            {results.participants.length === 0 ? (
              <div className="speaking-host-empty">
                <strong>還沒有學生加入</strong>
                <p>把代碼給學生後，作答會出現在這裡。</p>
              </div>
            ) : (
              <div className="speaking-host-results">
                {results.participants.map((participant) => (
                  <article key={participant.id} className="speaking-host-student">
                    <header>
                      <h3>{participant.displayName}</h3>
                      <span>{participant.completedCount}/{results.items.length} 題</span>
                    </header>
                    <ol>
                      {results.items.map((item, index) => {
                        const response = participant.responses[index];
                        return (
                          <li key={item.id}>
                            <strong>第 {item.position} 題</strong>
                            {response ? (
                              <SpeakingHostResponseReview
                                response={response}
                                targetText={item.targetText}
                                onSave={saveRating}
                              />
                            ) : <p>尚未作答</p>}
                          </li>
                        );
                      })}
                    </ol>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
