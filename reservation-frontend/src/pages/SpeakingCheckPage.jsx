import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Microphone, Stop } from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import {
  fetchSpeakingCheckSession,
  joinSpeakingCheck,
  submitSpeakingCheckResponse,
} from '../services/speakingCheckApi';
import { buildNextSentencePractice } from '../utils/speakingCheckFeedback';
import './SpeakingCheckPage.css';

const SESSION_KEY = 'eears-speaking-check-participant';

function getClientSessionId() {
  const key = 'eears-speaking-check-session';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 32) : `sc${Date.now()}`;
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return `sc${Date.now()}`;
  }
}

function readSavedParticipant() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || '';
  } catch {
    return '';
  }
}

function saveParticipant(uid) {
  try {
    if (uid) sessionStorage.setItem(SESSION_KEY, uid);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function microphoneErrorMessage(error) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return '手機必須用 https 開啟這個頁面才能錄音。目前的網址不是安全連線，瀏覽器會直接拒絕麥克風。';
  }
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '手機拒絕了麥克風。請用 Safari 或 Chrome 開啟這個頁面並允許麥克風。從 Line 內建瀏覽器開啟時，通常無法錄音。';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return '找不到麥克風。請確認沒有其他 App 正在使用麥克風。';
  }
  return '無法啟動麥克風，請確認瀏覽器權限。';
}

function pickAudioRecorderOptions() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : undefined;
}

async function analyzeAudioBlob(blob, durationMs) {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!blob || !durationMs || !AudioContextCtor) return {};
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContextCtor();
  try {
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const frameMs = 50;
    const frameSize = Math.max(1, Math.floor(sampleRate * (frameMs / 1000)));
    const silentFrames = [];
    for (let start = 0; start < channel.length; start += frameSize) {
      let sum = 0;
      const end = Math.min(channel.length, start + frameSize);
      for (let i = start; i < end; i += 1) sum += channel[i] * channel[i];
      const rms = Math.sqrt(sum / Math.max(1, end - start));
      silentFrames.push(rms < 0.018);
    }
    const pauses = [];
    let runStart = null;
    silentFrames.forEach((silent, index) => {
      if (silent && runStart == null) runStart = index;
      if ((!silent || index === silentFrames.length - 1) && runStart != null) {
        const runEnd = silent ? index + 1 : index;
        const pauseMs = (runEnd - runStart) * frameMs;
        if (pauseMs >= 300) pauses.push(pauseMs);
        runStart = null;
      }
    });
    const totalPauseMs = pauses.reduce((sum, ms) => sum + ms, 0);
    return {
      pauseCount: pauses.length,
      longPauseCount: pauses.filter((ms) => ms >= 1000).length,
      totalPauseMs,
      averagePauseDurationMs: pauses.length ? Math.round(totalPauseMs / pauses.length) : 0,
    };
  } finally {
    await audioContext.close().catch(() => {});
  }
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return `${Math.round(n)}%`;
}

function Metric({ label, value }) {
  const n = Number(value);
  const width = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  return (
    <div className="speaking-check-metric">
      <div className="speaking-check-metric__head">
        <span>{label}</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div className="speaking-check-metric__track" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function SpeakingCheckPage() {
  const location = useLocation();
  const prefilledCode = useMemo(() => new URLSearchParams(location.search).get('code') || '', [location.search]);
  const [joinCode, setJoinCode] = useState(prefilledCode);
  const [displayName, setDisplayName] = useState('');
  const [session, setSession] = useState(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [joining, setJoining] = useState(false);
  const mediaRecorderRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const speechShouldListenRef = useRef(false);
  const transcriptRef = useRef('');
  const speechFinalTranscriptRef = useRef('');
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);
  const audioUrlRef = useRef('');

  const items = session?.items || [];
  const current = items[itemIndex] || null;
  const finished = Boolean(session && items.length > 0 && itemIndex >= items.length);
  const practice = useMemo(
    () => (result && current ? buildNextSentencePractice(current.targetText, result.wordResults) : null),
    [current, result],
  );

  useEffect(() => () => {
    speechShouldListenRef.current = false;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  useEffect(() => {
    const saved = readSavedParticipant();
    if (!saved) return undefined;
    let cancelled = false;
    fetchSpeakingCheckSession(saved)
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        const nextIndex = (data.items || []).findIndex((item) => !item.answered);
        setItemIndex(nextIndex === -1 ? (data.items || []).length : nextIndex);
      })
      .catch(() => saveParticipant(''));
    return () => {
      cancelled = true;
    };
  }, []);

  const replaceAudioUrl = (nextUrl) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    setJoining(true);
    setError('');
    try {
      const data = await joinSpeakingCheck({
        joinCode,
        displayName,
        clientSessionId: getClientSessionId(),
      });
      saveParticipant(data.participantUid);
      setSession(data);
      const nextIndex = (data.items || []).findIndex((item) => !item.answered);
      setItemIndex(nextIndex === -1 ? (data.items || []).length : nextIndex);
    } catch (err) {
      setError(err.message || '無法加入');
    } finally {
      setJoining(false);
    }
  };

  const startSpeechRecognition = () => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;
    speechShouldListenRef.current = true;
    speechFinalTranscriptRef.current = '';
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = speechFinalTranscriptRef.current;
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i]?.[0]?.transcript || '';
        if (event.results[i].isFinal) finalText = `${finalText} ${text}`.trim();
        else interimText = `${interimText} ${text}`.trim();
      }
      speechFinalTranscriptRef.current = finalText;
      transcriptRef.current = `${finalText} ${interimText}`.trim();
    };
    recognition.onerror = () => {
      speechShouldListenRef.current = false;
    };
    recognition.onend = () => {
      if (!speechShouldListenRef.current) return;
      window.setTimeout(() => {
        if (!speechShouldListenRef.current) return;
        try {
          recognition.start();
        } catch {
          speechShouldListenRef.current = false;
        }
      }, 250);
    };
    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      speechShouldListenRef.current = false;
    }
  };

  const stopSpeechRecognition = () => {
    speechShouldListenRef.current = false;
    try {
      speechRecognitionRef.current?.stop();
    } catch {
      // The browser may already have stopped recognition.
    }
  };

  const submitCurrent = async ({ duration, features }) => {
    if (!session || !current) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await submitSpeakingCheckResponse(session.participantUid, {
        itemId: current.id,
        transcript: transcriptRef.current || '',
        durationMs: duration,
        clientFeatures: features || {},
      });
      setResult(data);
      setSession((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          items: previous.items.map((item) => (item.id === current.id ? { ...item, answered: true } : item)),
        };
      });
    } catch (err) {
      setError(err.message || '送出失敗，請再試一次');
    } finally {
      setSubmitting(false);
    }
  };

  const startRecording = async () => {
    setError('');
    setResult(null);
    transcriptRef.current = '';
    speechFinalTranscriptRef.current = '';
    chunksRef.current = [];
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('這個瀏覽器不支援錄音。請改用 Safari 或 Chrome。');
      return;
    }
    if (window.isSecureContext === false) {
      setError(microphoneErrorMessage());
      return;
    }
    let stream;
    try {
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
      startSpeechRecognition();
      stream = await streamPromise;
      const recorder = new MediaRecorder(stream, pickAudioRecorderOptions());
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const nextBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const nextDurationMs = Date.now() - (startedAtRef.current || Date.now());
        stream.getTracks().forEach((track) => track.stop());
        replaceAudioUrl(URL.createObjectURL(nextBlob));
        const features = await analyzeAudioBlob(nextBlob, nextDurationMs).catch(() => ({}));
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        await submitCurrent({ duration: nextDurationMs, features });
      };
      startedAtRef.current = Date.now();
      setRecording(true);
      recorder.start();
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      stopSpeechRecognition();
      setRecording(false);
      setError(microphoneErrorMessage(err));
    }
  };

  const stopRecording = () => {
    stopSpeechRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const goNext = () => {
    setResult(null);
    replaceAudioUrl('');
    setItemIndex((index) => index + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const leave = () => {
    saveParticipant('');
    setSession(null);
    setItemIndex(0);
    setResult(null);
    setJoinCode('');
    setDisplayName('');
  };

  return (
    <div className="speaking-check-page">
      <PageHeader
        breadcrumbs={[
          { label: '首頁', path: '/' },
          { label: '學習資源', path: '/learning-resources' },
          { label: '口說檢測' },
        ]}
        title={session ? session.set.title : '口說檢測'}
        lead={session ? '依序念完這一組題目。這是練習回饋，不是正式檢定。' : '輸入老師公布的代碼，加入這一組口說題。'}
      />
      <main className="container pb-5">
        {!session ? (
          <form className="speaking-check-card speaking-check-join" onSubmit={handleJoin}>
            <label htmlFor="speaking-join-code">加入代碼</label>
            <input
              id="speaking-join-code"
              className="speaking-check-code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={joinCode}
              placeholder="例如 482913"
              onChange={(event) => setJoinCode(event.target.value)}
            />
            <label htmlFor="speaking-display-name">你的名字</label>
            <input
              id="speaking-display-name"
              className="form-control"
              value={displayName}
              placeholder="老師要看得出是誰"
              onChange={(event) => setDisplayName(event.target.value)}
            />
            {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
            <button className="btn btn-primary" type="submit" disabled={joining || !displayName.trim()}>
              {joining ? '加入中...' : '加入題組'}
            </button>
            <Link to="/practice/speaking-host/login">我是老師</Link>
          </form>
        ) : null}

        {session && !finished && current ? (
          <section className="speaking-check-card" aria-label="口說題目">
            <div className="speaking-check-progress" aria-label={`第 ${itemIndex + 1} 題，共 ${items.length} 題`}>
              {items.map((item, index) => (
                <span
                  key={item.id}
                  className={index === itemIndex ? 'is-current' : item.answered ? 'is-done' : ''}
                />
              ))}
            </div>
            <p className="speaking-check-kicker">第 {itemIndex + 1} 題，共 {items.length} 題 · {session.displayName}</p>
            <p className="speaking-check-passage" data-testid="speaking-check-passage">{current.targetText}</p>
            <p className="speaking-check-hint">用平常說話的速度念完即可。</p>
            <button
              className={`speaking-check-mic${recording ? ' speaking-check-mic--recording' : ''}`}
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={submitting || Boolean(result) || session.set.status !== 'published'}
              aria-label={recording ? '停止錄音' : '開始錄音'}
            >
              {recording ? <Stop size={36} weight="fill" /> : <Microphone size={42} />}
            </button>
            <p className="speaking-check-status" aria-live="polite">
              {session.set.status !== 'published'
                ? '這個題組已結束'
                : recording
                  ? '正在錄音，念完再按一次停止'
                  : submitting
                    ? '正在聽寫，請留在此頁'
                    : '按下麥克風開始'}
            </p>
            {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
            {result && practice ? (
              <div className="speaking-check-inline-result" data-testid="speaking-check-result">
                <div className="speaking-check-metrics">
                  <Metric label="流暢度" value={result.fluencyPercent} />
                  <Metric label="完成度" value={result.completionPercent} />
                  <Metric label="可懂度" value={result.pronunciationPercent} />
                </div>
                <div className="speaking-check-next">
                  <span>下一句可以這樣練</span>
                  <p className="speaking-check-next__sentence">{practice.sentence}</p>
                  <p>{practice.advice}</p>
                </div>
                {audioUrl ? <audio className="speaking-check-audio" controls src={audioUrl}><track kind="captions" /></audio> : null}
                <button className="btn btn-primary" type="button" onClick={goNext}>
                  {itemIndex + 1 >= items.length ? '完成這一組' : '下一題'}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {finished ? (
          <section className="speaking-check-card speaking-check-done" aria-label="完成">
            <p className="speaking-check-kicker">{session.displayName}</p>
            <h2>這一組做完了</h2>
            <p>共 {items.length} 題。老師可以在題組後台看到你的流暢度、完成度與可懂度。</p>
            <button className="btn btn-outline-primary" type="button" onClick={leave}>離開</button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
