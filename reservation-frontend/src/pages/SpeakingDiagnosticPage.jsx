import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Microphone, Stop, ChartBar, Waveform } from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import { createSpeakingAdaptiveSession, fetchNextSpeakingTask, fetchSpeakingTasks, submitSpeakingAttempt } from '../services/speakingDiagnosticApi';
import { SPEAKING_TASKS } from '../data/speakingDiagnostic/readAloudTasks';
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

const TASK_TYPE_LABELS = {
  read_aloud: '朗讀',
  picture_description: '圖片描述',
  campus_short_answer: '校園短答',
  opinion_response: '意見表達',
};

function getTaskInstruction(task) {
  if (!task) return '按下麥克風開始作答。';
  if (task.taskType === 'read_aloud') return '請清楚朗讀下方句子。';
  if (task.taskType === 'picture_description') return '請描述你看到的情境，並補充一個細節。';
  if (task.taskType === 'campus_short_answer') return '請用完整句子回答這個校園情境。';
  return '請說明你的看法，並給一個理由。';
}

function getResultMessage(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '已收到你的錄音。';
  if (n >= 82) return '表現穩定，下一題可能會更有挑戰。';
  if (n >= 65) return '完成度不錯，請繼續保持清楚和穩定的語速。';
  if (n >= 45) return '已完成作答，下一題會協助確認你的程度。';
  return '建議放慢速度、說完整一些，再繼續下一題。';
}

function getAdaptiveLabel(session) {
  if (!session) return '一般練習';
  if (session.status === 'completed') return '測驗完成';
  return `第 ${(session.progress?.completedCount || 0) + 1} 題`;
}

export default function SpeakingDiagnosticPage() {
  const [tasks, setTasks] = useState(SPEAKING_TASKS.map((task) => ({ ...task, taskKey: task.id })));
  const [selectedTaskKey, setSelectedTaskKey] = useState('ra-a2-campus-library');
  const [studentId, setStudentId] = useState('');
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [durationMs, setDurationMs] = useState(null);
  const [clientFeatures, setClientFeatures] = useState(null);
  const [completedTaskKeys, setCompletedTaskKeys] = useState([]);
  const [nextTaskRecommendation, setNextTaskRecommendation] = useState(null);
  const [adaptiveSession, setAdaptiveSession] = useState(null);
  const [adaptiveStarting, setAdaptiveStarting] = useState(false);
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

  const isReadAloud = selectedTask?.taskType === 'read_aloud';
  const transcriptWordCount = useMemo(() => wordsOf(transcript).length, [transcript]);
  const wordResults = useMemo(() => {
    if (!isReadAloud) return [];
    return result?.wordResults?.length
      ? result.wordResults
      : buildLocalWordResults(selectedTask?.targetText, transcript);
  }, [isReadAloud, result, selectedTask?.targetText, transcript]);
  const alignment = result?.alignment || result?.features?.alignment || null;
  const presentationScores = result?.presentationScores || result?.automatedScores?.presentationScores || {};
  const overallPercent = presentationScores.overallPercent;
  const resultTaskType = result?.task?.taskType || selectedTask?.taskType;
  const resultIsReadAloud = resultTaskType === 'read_aloud';
  const taskInstruction = getTaskInstruction(selectedTask);
  const adaptiveCompletedCount = adaptiveSession?.progress?.completedCount || 0;

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

  const clearAttemptState = () => {
    setResult(null);
    setTranscript('');
    setInterimTranscript('');
    setSpeechError('');
    setSpeechStatus('idle');
    setAudioBlob(null);
    setAudioUrl((oldUrl) => {
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      return '';
    });
    setClientFeatures(null);
    setDurationMs(null);
  };

  const selectTaskForNextAttempt = (task) => {
    if (!task?.taskKey) return;
    setSelectedTaskKey(task.taskKey);
    clearAttemptState();
  };

  const handleStartAdaptiveSession = async () => {
    setAdaptiveStarting(true);
    setError('');
    try {
      const data = await createSpeakingAdaptiveSession({
        clientSessionId: getClientSessionId(),
        studentId,
        initialLevel: selectedTask?.level || 'B1',
      });
      setAdaptiveSession(data);
      setCompletedTaskKeys(data.completedTaskKeys || []);
      setNextTaskRecommendation(data.nextTask ? { task: data.nextTask, decision: data.decision } : null);
      if (data.nextTask) selectTaskForNextAttempt(data.nextTask);
    } catch (err) {
      setError(err.message || '無法開始適應性測驗。');
    } finally {
      setAdaptiveStarting(false);
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob || !selectedTask) return;
    setSubmitting(true);
    setError('');
    try {
      const spokenWordEstimate = transcriptWordCount || (isReadAloud ? selectedTask.targetWords || wordsOf(selectedTask.targetText).length : 0);
      const data = await submitSpeakingAttempt({
        taskKey: selectedTask.taskKey || selectedTask.id,
        studentId,
        clientSessionId: getClientSessionId(),
        adaptiveSessionUid: adaptiveSession?.sessionUid,
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
      const completed = Array.from(new Set([...completedTaskKeys, selectedTask.taskKey || selectedTask.id]));
      setCompletedTaskKeys(completed);
      if (data.adaptiveSession) {
        setAdaptiveSession(data.adaptiveSession);
        setCompletedTaskKeys(data.adaptiveSession.completedTaskKeys || completed);
        setNextTaskRecommendation(data.adaptiveSession.nextTask ? { task: data.adaptiveSession.nextTask, decision: data.adaptiveSession.decision } : null);
        return;
      }
      fetchNextSpeakingTask({
        currentLevel: selectedTask.level,
        previousOverallPercent: data.presentationScores?.overallPercent || data.automatedScores?.presentationScores?.overallPercent,
        completedTaskKeys: completed.join(','),
        taskType: selectedTask.taskType,
      })
        .then((recommendation) => setNextTaskRecommendation(recommendation))
        .catch(() => setNextTaskRecommendation(null));
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
        lead="完成幾題口說任務，系統會依你的表現安排下一題並給出練習回饋。"
      />

      <main className="container pb-5">
        <section className="speaking-tool">
          <div className="speaking-tool__sidebar">
            <div className="speaking-side-section">
              <label className="form-label fw-semibold" htmlFor="speaking-student-id">學號（選填）</label>
              <input
                id="speaking-student-id"
                className="form-control"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder="例如 412345678"
                inputMode="numeric"
              />
            </div>

            <div className="speaking-adaptive-card">
              <div>
                <strong>{adaptiveSession ? getAdaptiveLabel(adaptiveSession) : '適應性測驗'}</strong>
                <span>{adaptiveSession ? `${adaptiveCompletedCount}/${adaptiveSession.maxTasks} 題 · 目前估計 ${adaptiveSession.currentLevel}` : '依作答結果安排下一題'}</span>
              </div>
              <button
                className="btn btn-outline-primary btn-sm"
                type="button"
                disabled={adaptiveStarting || recording}
                onClick={handleStartAdaptiveSession}
              >
                {adaptiveStarting ? '啟動中...' : adaptiveSession ? '重新開始' : '開始'}
              </button>
            </div>

            <details className="speaking-task-picker">
              <summary>自行選題練習</summary>
              <div className="speaking-task-list" aria-label="Speaking diagnostic tasks">
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
                        setNextTaskRecommendation(null);
                      }}
                    >
                      <span className="speaking-task-option__level">{task.level}</span>
                      <span>
                        <strong>{task.title}</strong>
                        <small>{TASK_TYPE_LABELS[task.taskType] || task.taskType}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </details>
          </div>

          <div className="speaking-tool__main">
            <div className="speaking-practice-stage">
              <div className="speaking-stage-score">
                <ScoreDial value={overallPercent} label={result ? 'Score' : 'Ready'} />
              </div>
              <div className="speaking-stage-meta">
                <span>{selectedTask?.level}</span>
                <span>{TASK_TYPE_LABELS[selectedTask?.taskType] || selectedTask?.taskType}</span>
                <span>{selectedTask?.estimatedSeconds || 15}s target</span>
              </div>
              <div className="speaking-stage-center">
                <h2>{selectedTask?.title}</h2>
                <p className="speaking-stage-instruction">{taskInstruction}</p>
                <button
                  className={`speaking-mic-button${recording ? ' speaking-mic-button--recording' : ''}`}
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  aria-label={recording ? 'Stop recording' : 'Start recording'}
                >
                  {recording ? <Stop size={38} weight="fill" /> : <Microphone size={46} />}
                </button>
                <div className="speaking-stage-status">
                  {recording ? '正在錄音，完成後再按一次停止' : durationMs ? `已錄音 ${formatMs(durationMs)}` : '按下麥克風開始'}
                </div>
                {speechRecognitionAvailable ? null : (
                  <div className="speaking-speech-status speaking-speech-status--unsupported">
                    此瀏覽器不支援自動逐字稿，可手動補上
                  </div>
                )}
              </div>
              {isReadAloud ? (
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
              ) : (
                <div className="speaking-open-prompt" aria-label="Speaking prompt">
                  <span>{TASK_TYPE_LABELS[selectedTask?.taskType] || 'Speaking task'}</span>
                  <p>{selectedTask?.prompt}</p>
                </div>
              )}
              <div className="speaking-stage-footer">
                <span><Waveform size={18} /> {recording ? 'Recording' : audioBlob ? 'Ready to submit' : 'Not recorded'}</span>
                <span>{durationMs ? formatMs(durationMs) : '0.0s'} / {selectedTask?.estimatedSeconds || 15}.0s</span>
                <span><ChartBar size={18} /> {result ? formatPercent(overallPercent) : 'Score pending'}</span>
              </div>
            </div>

            <details className="speaking-review-panel" open={Boolean(audioUrl && !result)}>
              <summary>檢查錄音與逐字稿</summary>
              {audioUrl ? (
                <audio className="speaking-audio" controls src={audioUrl}>
                  <track kind="captions" />
                </audio>
              ) : (
                <p className="speaking-review-panel__empty">錄音完成後可以在這裡回放。</p>
              )}

              <label className="form-label fw-semibold mt-3" htmlFor="speaking-transcript">
                逐字稿（可修正）
              </label>
              <textarea
                id="speaking-transcript"
                className="form-control"
                rows={3}
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder={isReadAloud ? '錄音時請朗讀句子，逐字稿會自動填入。' : '錄音時請回答題目，逐字稿會自動填入。'}
              />
              {interimTranscript ? (
                <div className="speaking-live-transcript">
                  正在辨識：{interimTranscript}
                </div>
              ) : null}
              {speechError ? (
                <div className="speaking-speech-note">{speechError}</div>
              ) : null}
            </details>

            {adaptiveSession ? (
              <div className="speaking-adaptive-progress">
                <div>
                  <strong>{adaptiveSession.status === 'completed' ? '適應性測驗完成' : '適應性測驗進行中'}</strong>
                  <span>目前估計：{adaptiveSession.currentLevel}</span>
                </div>
                <div>
                  <strong>{adaptiveSession.progress?.completedCount || 0}/{adaptiveSession.maxTasks}</strong>
                  <span>{adaptiveSession.status === 'completed' ? '已完成' : '題目進度'}</span>
                </div>
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
                {submitting ? '送出中...' : adaptiveSession ? '送出並取得下一題' : '送出作答'}
              </button>
              <span className="text-muted">{audioBlob ? '確認逐字稿後即可送出。' : '先完成錄音，再送出作答。'}</span>
            </div>

            {result ? (
              <section className="speaking-result" aria-label="Speaking result">
                <div className="speaking-result__header">
                  <div>
                    <h3>本題回饋</h3>
                    <p>{getResultMessage(overallPercent)}</p>
                  </div>
                  <ScoreDial value={overallPercent} label="Overall" />
                </div>
                <div className="speaking-metric-grid">
                  <MetricBar
                    label="完成度"
                    value={presentationScores.completionPercent}
                    detail={resultIsReadAloud ? '目標文字覆蓋' : '回答長度'}
                  />
                  <MetricBar
                    label="流暢度"
                    value={presentationScores.fluencyPercent}
                    detail="語速與停頓"
                  />
                  <MetricBar
                    label="語速"
                    value={presentationScores.pacePercent}
                    detail={`${formatNumber(result.features?.speechRateWpm)} WPM`}
                  />
                </div>
                <details className="speaking-diagnostics-panel">
                  <summary>查看詳細診斷</summary>
                  <div className="speaking-evidence-grid">
                    <div><strong>{formatPercent(presentationScores.pauseControlPercent)}</strong><span>停頓控制</span></div>
                    <div><strong>{formatNumber(result.features?.speechRateWpm)}</strong><span>speech WPM</span></div>
                    <div><strong>{resultIsReadAloud ? formatPercent(presentationScores.similarityPercent) : formatPercent(presentationScores.vocabularyPercent)}</strong><span>{resultIsReadAloud ? '相似度' : '字彙'}</span></div>
                    <div><strong>{result.features?.transcriptWordCount ?? 0}</strong><span>逐字稿字數</span></div>
                  </div>
                  {!resultIsReadAloud ? (
                    <div className="speaking-evidence-grid speaking-evidence-grid--compact">
                      <div><strong>{formatPercent(presentationScores.grammarPercent)}</strong><span>語法表現</span></div>
                      <div><strong>{formatPercent(presentationScores.coherencePercent)}</strong><span>組織連貫</span></div>
                      <div><strong>{formatNumber(result.features?.transcriptEvidence?.lexicalDiversity)}</strong><span>用字變化</span></div>
                      <div><strong>{result.features?.transcriptEvidence?.repetitionCount ?? 0}</strong><span>重複次數</span></div>
                    </div>
                  ) : null}
                  {alignment && alignment.status !== 'not_applicable' ? (
                    <div className="speaking-alignment-panel">
                      <div className="speaking-alignment-panel__head">
                        <div>
                          <h4>朗讀對齊資料</h4>
                          <p>{alignment.status}</p>
                        </div>
                        <span>{alignment.metrics?.alignedWordCount ?? alignment.words?.length ?? 0} words</span>
                      </div>
                      {alignment.words?.length ? (
                        <div className="speaking-alignment-words">
                          {alignment.words.slice(0, 14).map((item) => (
                            <span key={`${item.index}-${item.word}-${item.startMs}`}>
                              <strong>{item.word}</strong>
                              <small>{formatMs(item.startMs)}-{formatMs(item.endMs)}</small>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </details>
                {nextTaskRecommendation?.task ? (
                  <div className="speaking-next-task">
                    <div>
                      <strong>{adaptiveSession?.status === 'completed' ? '測驗已完成' : '下一題'}</strong>
                      <span>{nextTaskRecommendation.task.level} · {nextTaskRecommendation.task.title}</span>
                    </div>
                    <button
                      className="btn btn-outline-primary"
                      type="button"
                      onClick={() => {
                        selectTaskForNextAttempt(nextTaskRecommendation.task);
                        setNextTaskRecommendation(null);
                      }}
                    >
                      開始下一題
                    </button>
                  </div>
                ) : null}
                <p className="text-muted mb-0">此回饋用於練習診斷，不是正式檢定分數。</p>
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

