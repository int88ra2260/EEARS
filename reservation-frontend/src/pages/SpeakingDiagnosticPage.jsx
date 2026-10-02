import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);

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

  const startRecording = async () => {
    setError('');
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
    } catch (err) {
      setError(err?.message || '無法啟動麥克風，請確認瀏覽器權限。');
    }
  };

  const stopRecording = () => {
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
            <div className="speaking-prompt">
              <div className="speaking-prompt__meta">
                <span>{selectedTask?.level}</span>
                <span>{selectedTask?.estimatedSeconds || 15}s target</span>
                <span>{selectedTask?.targetWords || wordsOf(selectedTask?.targetText).length} words</span>
              </div>
              <h2>{selectedTask?.title}</h2>
              <p>{selectedTask?.targetText}</p>
            </div>

            <div className="speaking-recorder">
              <div className="speaking-recorder__controls">
                {!recording ? (
                  <button className="btn btn-primary" type="button" onClick={startRecording}>
                    Start recording
                  </button>
                ) : (
                  <button className="btn btn-danger" type="button" onClick={stopRecording}>
                    Stop
                  </button>
                )}
                <span className="text-muted">
                  {recording ? 'Recording...' : durationMs ? `Recorded ${formatMs(durationMs)}` : 'Ready'}
                </span>
              </div>

              {audioUrl ? (
                <audio className="speaking-audio" controls src={audioUrl}>
                  <track kind="captions" />
                </audio>
              ) : null}
            </div>

            <label className="form-label fw-semibold mt-3" htmlFor="speaking-transcript">
              Transcript（選填，未接 ASR 前可貼上人工或瀏覽器轉錄）
            </label>
            <textarea
              id="speaking-transcript"
              className="form-control"
              rows={3}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Paste or type what the student said. Word completion and similarity use this field for now."
            />

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
                <h3>Evidence summary</h3>
                <div className="speaking-evidence-grid">
                  <div><strong>{result.features?.speechRateWpm ?? '-'}</strong><span>speech WPM</span></div>
                  <div><strong>{result.features?.articulationRateWpm ?? '-'}</strong><span>articulation WPM</span></div>
                  <div><strong>{result.features?.completionRate ?? '-'}</strong><span>completion</span></div>
                  <div><strong>{result.automatedScores?.fluencyProxy ?? '-'}</strong><span>fluency proxy</span></div>
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

