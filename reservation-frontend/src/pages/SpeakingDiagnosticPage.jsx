import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Microphone, Stop, ChartBar, Waveform } from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import { fetchSpeakingTasks, submitSpeakingAttempt } from '../services/speakingDiagnosticApi';
import { READ_ALOUD_TASKS } from '../data/speakingDiagnostic/readAloudTasks';
import './SpeakingDiagnosticPage.css';

function getClientSessionId() {
  const key = 'eears-speaking-diagnostic-session';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 32) : `sd${Date.now()}`;
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return `sd${Date.now()}`;
  }
}

function wordsOf(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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
      audioAnalysis: {
        frameMs,
        silenceThreshold: 0.018,
        method: 'browser_rms_v0',
      },
    };
  } finally {
    await audioContext.close().catch(() => {});
  }
}

function formatMs(ms) {
  if (!ms) return '0.0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return `${Math.round(n)}%`;
}

function formatNumber(value, unit = '') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return `${Number.isInteger(n) ? n : n.toFixed(1)}${unit}`;
}

function buildLocalWordResults(targetText, transcript) {
  const target = wordsOf(targetText);
  const response = wordsOf(transcript);
  const counts = new Map();
  response.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return target.map((word, index) => {
    const count = counts.get(word) || 0;
    if (count > 0) {
      counts.set(word, count - 1);
      return { index, word, status: 'matched' };
    }
    return { index, word, status: response.length ? 'missing' : 'unknown' };
  });
}

function ScoreDial({ value, label = 'Overall' }) {
  const display = formatPercent(value);
  return (
    <div className="speaking-score-dial" aria-label={`${label} ${display}`}>
      <span>{display}</span>
      <small>{label}</small>
    </div>
  );
}

function MetricBar({ label, value, detail }) {
  const n = Number(value);
  const width = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  return (
    <div className="speaking-metric-bar">
      <div className="speaking-metric-bar__head">
        <span>{label}</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div className="speaking-metric-bar__track">
        <span style={{ width: `${width}%` }} />
      </div>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export default function SpeakingDiagnosticPage() {
  const [tasks, setTasks] = useState(READ_ALOUD_TASKS.map((task) => ({ ...task, taskKey: task.id })));
  const [selectedTaskKey, setSelectedTaskKey] = useState('ra-a2-campus-library');
  const [studentId, setStudentId] = useState('');
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [durationMs, setDurationMs] = useState(null);
  const [clientFeatures, setClientFeatures] = useState(null);
  const [speechRecognitionAvailable, setSpeechRecognitionAvailable] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const speechShouldListenRef = useRef(false);
  const speechFinalTranscriptRef = useRef('');
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);

  useEffect(() => {
    setSpeechRecognitionAvailable(Boolean(getSpeechRecognitionConstructor()));
    return () => {
      speechShouldListenRef.current = false;
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // The browser may already have stopped recognition.
        }
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSpeakingTasks({}, { signal: controller.signal })
      .then((data) => {
        if (Array.isArray(data.tasks) && data.tasks.length) {
          setTasks(data.tasks);
          setSelectedTaskKey(data.tasks[0].taskKey);
        }
      })
      .catch(() => {
        // Local task bank remains available before migrations are applied.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const selectedTask = useMemo(
    () => tasks.find((task) => (task.taskKey || task.id) === selectedTaskKey) || tasks[0],
    [selectedTaskKey, tasks],
  );

  const transcriptWordCount = useMemo(() => wordsOf(transcript).length, [transcript]);
  const wordResults = useMemo(() => (
    result?.wordResults?.length
      ? result.wordResults
      : buildLocalWordResults(selectedTask?.targetText, transcript)
  ), [result, selectedTask?.targetText, transcript]);
  const presentationScores = result?.presentationScores || result?.automatedScores?.presentationScores || {};
  const overallPercent = presentationScores.overallPercent;

  const startSpeechRecognition = () => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setSpeechStatus('unsupported');
      setSpeechError('This browser does not support Web Speech API. You can still type the transcript manually.');
      return;
    }

    speechShouldListenRef.current = true;
    speechFinalTranscriptRef.current = '';
    setInterimTranscript('');
    setSpeechError('');

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setSpeechStatus('listening');
    };

    recognition.onresult = (event) => {
      let finalText = speechFinalTranscriptRef.current;
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i]?.[0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalText = `${finalText} ${text}`.trim();
        } else {
          interimText = `${interimText} ${text}`.trim();
        }
      }

      speechFinalTranscriptRef.current = finalText;
      setInterimTranscript(interimText);
      setTranscript(`${finalText} ${interimText}`.trim());
    };

    recognition.onerror = (event) => {
      const message = event?.error === 'not-allowed'
        ? 'Speech recognition permission was blocked. Audio recording may still work.'
        : `Speech recognition stopped: ${event?.error || 'unknown error'}`;
      setSpeechError(message);
      setSpeechStatus('error');
    };

    recognition.onend = () => {
      if (speechShouldListenRef.current) {
        window.setTimeout(() => {
          if (!speechShouldListenRef.current) return;
          try {
            recognition.start();
          } catch {
            setSpeechStatus('error');
          }
        }, 250);
        return;
      }
      setSpeechStatus(speechFinalTranscriptRef.current ? 'ready' : 'idle');
    };

    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setSpeechStatus('error');
      setSpeechError(err?.message || 'Unable to start browser speech recognition.');
    }
  };

  const stopSpeechRecognition = () => {
    speechShouldListenRef.current = false;
    setInterimTranscript('');
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // The browser may already have stopped recognition.
      }
    }
  };

  const startRecording = async () => {
    setError('');
    setSpeechError('');
    setSpeechStatus('idle');
    setTranscript('');
    setInterimTranscript('');
    setResult(null);
    setAudioBlob(null);
    setClientFeatures(null);
    setDurationMs(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorderOptions = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const nextBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const nextDurationMs = Date.now() - (startedAtRef.current || Date.now());
        stream.getTracks().forEach((track) => track.stop());
        setAudioBlob(nextBlob);
        setAudioUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return URL.createObjectURL(nextBlob);
        });
        setDurationMs(nextDurationMs);
        const features = await analyzeAudioBlob(nextBlob, nextDurationMs).catch(() => ({}));
        setClientFeatures(features);
      };
      const now = Date.now();
      startedAtRef.current = now;
      setRecording(true);
      recorder.start();
      startSpeechRecognition();
    } catch (err) {
      setError(err?.message || '無法啟動麥克風，請確認瀏覽器權限。');
    }
  };

  const stopRecording = () => {
    stopSpeechRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleSubmit = async () => {
    if (!audioBlob || !selectedTask) return;
    setSubmitting(true);
    setError('');
    try {
      const spokenWordEstimate = transcriptWordCount || selectedTask.targetWords || wordsOf(selectedTask.targetText).length;
      const data = await submitSpeakingAttempt({
        taskKey: selectedTask.taskKey || selectedTask.id,
        studentId,
        clientSessionId: getClientSessionId(),
        audioBlob,
        audioFileName: `${selectedTask.taskKey || selectedTask.id}.webm`,
        durationMs,
        transcript,
        clientFeatures: {
          ...(clientFeatures || {}),
          spokenWordEstimate,
          browserUserAgent: navigator.userAgent,
        },
      });
      setResult(data);
    } catch (err) {
      setError(err.message || '送出失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  const breadcrumbs = [
    { label: '首頁', path: '/' },
    { label: '學習資源', path: '/learning-resources' },
    { label: '口說診斷' },
  ];

  return (
    <div className="speaking-diagnostic-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="EEARS Speaking Diagnostic"
        lead="先從 read-aloud 任務收集可觀測的 fluency、completion 與錄音 evidence；此工具目前作為診斷與研究資料收集，不是正式 CEFR 檢定。"
      />

      <main className="container pb-5">
        <section className="speaking-tool">
          <div className="speaking-tool__sidebar">
            <label className="form-label fw-semibold" htmlFor="speaking-student-id">學號（選填）</label>
            <input
              id="speaking-student-id"
              className="form-control"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="例如 412345678"
              inputMode="numeric"
            />

            <div className="speaking-task-list" aria-label="Read aloud tasks">
              {tasks.map((task) => {
                const key = task.taskKey || task.id;
                const active = key === selectedTaskKey;
                return (
                  <button
                    className={`speaking-task-option${active ? ' speaking-task-option--active' : ''}`}
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedTaskKey(key);
                      setResult(null);
                      setTranscript('');
                      setInterimTranscript('');
                      setSpeechError('');
                      setSpeechStatus('idle');
                    }}
                  >
                    <span className="speaking-task-option__level">{task.level}</span>
                    <span>
                      <strong>{task.title}</strong>
                      <small>{task.focusTags?.slice(0, 2).join(' / ')}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="speaking-tool__main">
            <div className="speaking-practice-stage">
              <div className="speaking-stage-score">
                <ScoreDial value={overallPercent} label={result ? 'Score' : 'Ready'} />
              </div>
              <div className="speaking-stage-meta">
                <span>{selectedTask?.level}</span>
                <span>{selectedTask?.estimatedSeconds || 15}s target</span>
                <span>{selectedTask?.targetWords || wordsOf(selectedTask?.targetText).length} words</span>
              </div>
              <div className="speaking-stage-center">
                <h2>{selectedTask?.title}</h2>
                <button
                  className={`speaking-mic-button${recording ? ' speaking-mic-button--recording' : ''}`}
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  aria-label={recording ? 'Stop recording' : 'Start recording'}
                >
                  {recording ? <Stop size={38} weight="fill" /> : <Microphone size={46} />}
                </button>
                <div className="speaking-stage-status">
                  {recording ? 'Recording your line' : durationMs ? `Recorded ${formatMs(durationMs)}` : 'Click the microphone and read the line'}
                </div>
                <div className={`speaking-speech-status speaking-speech-status--${speechStatus}`}>
                  {speechRecognitionAvailable
                    ? `Browser transcript: ${speechStatus === 'listening' ? 'listening' : speechStatus === 'ready' ? 'ready' : speechStatus === 'error' ? 'needs manual check' : 'standby'}`
                    : 'Browser transcript unavailable'}
                </div>
              </div>
              <div className="speaking-line-strip" aria-label="Read aloud line">
                {wordResults.map((item) => (
                  <span
                    key={`${item.index}-${item.word}`}
                    className={`speaking-word speaking-word--${item.status}`}
                  >
                    {item.word}
                  </span>
                ))}
              </div>
              <div className="speaking-stage-footer">
                <span><Waveform size={18} /> {clientFeatures?.pauseCount ?? 0} pauses</span>
                <span>{durationMs ? formatMs(durationMs) : '0.0s'} / {selectedTask?.estimatedSeconds || 15}.0s</span>
                <span><ChartBar size={18} /> {result ? formatPercent(presentationScores.completionPercent) : 'completion pending'}</span>
              </div>
            </div>

            {audioUrl ? (
              <audio className="speaking-audio" controls src={audioUrl}>
                <track kind="captions" />
              </audio>
            ) : null}

            <label className="form-label fw-semibold mt-3" htmlFor="speaking-transcript">
              Transcript（Web Speech API 會自動填入，也可人工修正）
            </label>
            <textarea
              id="speaking-transcript"
              className="form-control"
              rows={3}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Click the microphone and read the line. The browser transcript will appear here when supported."
            />
            {interimTranscript ? (
              <div className="speaking-live-transcript">
                Listening: {interimTranscript}
              </div>
            ) : null}
            {speechError ? (
              <div className="speaking-speech-note">{speechError}</div>
            ) : null}

            {clientFeatures ? (
              <div className="speaking-evidence-grid" aria-label="Browser audio evidence">
                <div><strong>{clientFeatures.pauseCount ?? 0}</strong><span>pauses</span></div>
                <div><strong>{formatMs(clientFeatures.averagePauseDurationMs)}</strong><span>avg pause</span></div>
                <div><strong>{formatMs(clientFeatures.totalPauseMs)}</strong><span>total pause</span></div>
                <div><strong>{transcriptWordCount || '-'}</strong><span>transcript words</span></div>
              </div>
            ) : null}

            {error ? <div className="alert alert-danger mt-3">{error}</div> : null}

            <div className="speaking-submit-row">
              <button
                className="btn btn-success"
                type="button"
                disabled={!audioBlob || submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Submitting...' : 'Submit attempt'}
              </button>
              <span className="text-muted">錄音會儲存為研究與教學診斷 evidence。</span>
            </div>

            {result ? (
              <section className="speaking-result" aria-label="Automated evidence result">
                <div className="speaking-result__header">
                  <div>
                    <h3>Attempt result</h3>
                    <p>完成度來自 transcript 對 target line 的比對；fluency 目前是診斷 proxy，尚未校準為正式 CEFR 分數。</p>
                  </div>
                  <ScoreDial value={overallPercent} label="Overall" />
                </div>
                <div className="speaking-metric-grid">
                  <MetricBar
                    label="Completion"
                    value={presentationScores.completionPercent}
                    detail="target words covered"
                  />
                  <MetricBar
                    label="Fluency"
                    value={presentationScores.fluencyPercent}
                    detail="speech rate + pauses"
                  />
                  <MetricBar
                    label="Pace"
                    value={presentationScores.pacePercent}
                    detail={`${formatNumber(result.features?.speechRateWpm)} WPM`}
                  />
                  <MetricBar
                    label="Pause control"
                    value={presentationScores.pauseControlPercent}
                    detail={`${result.features?.pauseCount ?? 0} pauses, avg ${formatMs(result.features?.averagePauseDurationMs)}`}
                  />
                </div>
                <div className="speaking-evidence-grid">
                  <div><strong>{formatNumber(result.features?.speechRateWpm)}</strong><span>speech WPM</span></div>
                  <div><strong>{formatNumber(result.features?.articulationRateWpm)}</strong><span>articulation WPM</span></div>
                  <div><strong>{formatPercent(presentationScores.similarityPercent)}</strong><span>line similarity</span></div>
                  <div><strong>{formatNumber(result.automatedScores?.fluencyProxy)}</strong><span>fluency proxy</span></div>
                </div>
                <p className="text-muted mb-0">{result.automatedScores?.scoreCaution}</p>
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

