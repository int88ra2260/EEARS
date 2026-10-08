import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Microphone, Stop, ChartBar, Waveform } from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { createSpeakingAdaptiveSession, fetchNextSpeakingTask, fetchSpeakingTasks, submitSpeakingAttempt } from '../services/speakingDiagnosticApi';
import { saveSpeakingPortfolioAttempt } from '../services/speakingPortfolioStore';
import { englishTableFollowUp, englishTablePhraseTips } from '../utils/englishTableFollowUp';
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

const NUMBER_WORDS_0_TO_59 = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
  'twenty one', 'twenty two', 'twenty three', 'twenty four', 'twenty five',
  'twenty six', 'twenty seven', 'twenty eight', 'twenty nine', 'thirty',
  'thirty one', 'thirty two', 'thirty three', 'thirty four', 'thirty five',
  'thirty six', 'thirty seven', 'thirty eight', 'thirty nine', 'forty',
  'forty one', 'forty two', 'forty three', 'forty four', 'forty five',
  'forty six', 'forty seven', 'forty eight', 'forty nine', 'fifty',
  'fifty one', 'fifty two', 'fifty three', 'fifty four', 'fifty five',
  'fifty six', 'fifty seven', 'fifty eight', 'fifty nine',
];

function numberToSpeechWords(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n >= NUMBER_WORDS_0_TO_59.length) return String(value);
  return NUMBER_WORDS_0_TO_59[n];
}

function normalizeSpokenNumbers(value) {
  return String(value || '')
    .replace(/\b(\d{1,2})[:：](\d{2})\b/g, (_, hour, minute) => {
      const hourWords = numberToSpeechWords(Number(hour));
      const minuteNumber = Number(minute);
      if (minute === '00') return `${hourWords} o clock`;
      if (minuteNumber > 0 && minuteNumber < 10) return `${hourWords} oh ${numberToSpeechWords(minuteNumber)}`;
      return `${hourWords} ${numberToSpeechWords(minuteNumber)}`;
    })
    .replace(/\b([0-5]?\d)\b/g, (_, number) => numberToSpeechWords(Number(number)))
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(twenty|thirty|forty|fifty)\b/g, '$1 $2');
}

function wordsOf(text) {
  return normalizeSpokenNumbers(text)
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

const SPEECH_BLOCKED_MESSAGE = '瀏覽器沒有開放語音辨識。錄音仍可送出，伺服器會依錄音產生逐字稿。';

function microphoneErrorMessage(error) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return '手機必須用 https 開啟這個頁面才能錄音。目前的網址不是安全連線，瀏覽器會直接拒絕麥克風。';
  }
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '手機拒絕了麥克風。請用 Safari 或 Chrome 開啟這個 https 頁面並允許麥克風。從 Line 或其他 App 內建瀏覽器開啟時，通常無法錄音。';
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
  if (!ms) return '0.0 秒';
  return `${(ms / 1000).toFixed(1)} 秒`;
}

function formatPercent(value) {
  if (value == null || value === '') return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return `${Math.round(n)}%`;
}

function readAloudPieces(targetText, wordResults) {
  const text = String(targetText || '');
  const pieces = [];
  const pattern = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g;
  let last = 0;
  let wordIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) {
      pieces.push({ kind: 'text', text: text.slice(last, match.index), key: `gap-${last}` });
    }
    pieces.push({
      kind: 'word',
      text: match[0],
      status: wordResults?.[wordIndex]?.status || 'unknown',
      key: `word-${wordIndex}`,
    });
    wordIndex += 1;
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ kind: 'text', text: text.slice(last), key: `gap-${last}` });
  return pieces;
}

function ScoreDial({ value, label = '總分' }) {
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

const TASK_TYPE_ORDER = ['read_aloud', 'picture_description', 'campus_short_answer', 'opinion_response'];
const TASK_LEVELS = ['A2', 'B1', 'B2'];

function englishTableTopic(task) {
  const title = String(task?.title || '');
  const match = title.match(/:\s*(.+?)\s+Q\d+/i);
  return match ? match[1].trim() : '其他';
}

function TaskChoice({ task, active, disabled, onSelect }) {
  const key = task.taskKey || task.id;
  return (
    <button
      className={`speaking-task-option${active ? ' speaking-task-option--active' : ''}`}
      type="button"
      disabled={disabled}
      onClick={() => onSelect(task, key)}
    >
      <span className="speaking-task-option__level">{task.level}</span>
      <span>
        <strong>{task.title}</strong>
        <small>{TASK_TYPE_LABELS[task.taskType] || task.taskType}</small>
      </span>
    </button>
  );
}

function TaskGroup({ label, tasks, selectedTaskKey, disabled, onSelect }) {
  if (!tasks.length) return null;
  return (
    <details className="speaking-task-group speaking-task-group--nested">
      <summary>{label} · {tasks.length}</summary>
      <div className="speaking-task-list">
        {tasks.map((task) => {
          const key = task.taskKey || task.id;
          return (
            <TaskChoice
              key={key}
              task={task}
              active={key === selectedTaskKey}
              disabled={disabled}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </details>
  );
}

const TASK_TYPE_LABELS = {
  read_aloud: '朗讀',
  picture_description: '圖片描述',
  campus_short_answer: '校園短答',
  opinion_response: '意見表達',
};

const PICTURE_TASK_IMAGES = {
  'pd-a2-campus-cafe': '/speaking-diagnostic/pd-a2-campus-cafe.jpg',
  'pd-a2-rainy-campus': '/speaking-diagnostic/pd-a2-rainy-campus.jpg',
  'pd-b1-group-project-room': '/speaking-diagnostic/pd-b1-group-project-room.jpg',
  'pd-b2-sustainable-campus-poster': '/speaking-diagnostic/pd-b2-sustainable-campus-poster.jpg',
};

function pictureForTask(task) {
  return PICTURE_TASK_IMAGES[task?.taskKey] || PICTURE_TASK_IMAGES[task?.id] || '';
}

function getTaskInstruction(task) {
  if (!task) return '按下麥克風開始作答。';
  if (task.taskType === 'read_aloud') return '請清楚朗讀下面這幾句，並把句尾念出來。';
  if (task.taskType === 'picture_description') return '請描述你看到的情境，並補充一個細節。';
  if (task.taskType === 'campus_short_answer') return '請用完整句子回答這個校園情境。';
  return '請說明你的看法，並給一個理由。';
}

function EnglishTableNextLine({ transcript, prompt }) {
  const followUp = englishTableFollowUp(transcript, prompt);
  const item = englishTablePhraseTips(transcript, prompt)[0];

  return (
    <div className="speaking-next-line">
      <p className="speaking-next-line__lead">{followUp.cue}</p>
      {followUp.say ? (
        <div className="speaking-next-line__phrase">
          {item ? <span>{item.scenarioTitleZh}</span> : null}
          <strong>{followUp.say}</strong>
          {item ? (
            <Link to={`/guides/activity-phrasebook/english-table#${item.id}`}>
              其他說法
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getResultMessage(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '已收到你的錄音。';
  if (n >= 82) return '大部分的字都念到了。下一題可能會更有挑戰。';
  if (n >= 65) return '多數的字有念到。請再看標成沒聽到的字。';
  if (n >= 45) return '還有一些字沒有被聽到。請對著句子再念一次。';
  return '很多字沒有被聽到。請對著句子再清楚念一次。';
}

function getAdaptiveLabel(session) {
  if (!session) return '一般練習';
  if (session.status === 'completed') return '測驗完成';
  return `第 ${(session.progress?.completedCount || 0) + 1} 題`;
}

function normalizeActivityPhase(value, source) {
  const phase = String(value || '').trim().toLowerCase();
  if (phase === 'post' || phase === 'review' || phase === 'post_activity') return 'post_activity';
  if (phase === 'pre' || phase === 'warmup' || phase === 'pre_activity') return 'pre_activity';
  return source === 'english-table' ? 'pre_activity' : 'diagnostic';
}

function activityPhaseCopy(phase) {
  if (phase === 'post_activity') {
    return {
      title: 'English Table Speaking Review',
      lead: '活動後再答一次。系統會留下你說的第一句，給 Leader 當開場，不是分數。',
      label: '活動後複習',
      context: '請填學號，Leader 才對得到你。現場討論的勾選仍在活動結束後另外做。',
      statusDone: '已完成活動後複習',
    };
  }
  if (phase === 'pre_activity') {
    return {
      title: 'English Table Speaking Warm-up',
      lead: '先練當天題目。錄完會看到系統聽到的句子，並給你一句現場可以接的話。',
      label: '會前練習',
      context: '請填學號。Leader 只會看到你這組的第一句，用來開場，不是分數。',
      statusDone: '已完成會前練習',
    };
  }
  return {
    title: 'EEARS Speaking Diagnostic',
    lead: '完成幾題口說任務，系統會依你的表現安排下一題並給出練習回饋。',
    label: '口說診斷',
    context: '',
    statusDone: '已完成本題',
  };
}

export default function SpeakingDiagnosticPage() {
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedTaskKey = queryParams.get('taskKey') || '';
  const sourceContext = queryParams.get('source') || '';
  const activityPhase = normalizeActivityPhase(queryParams.get('phase'), sourceContext);
  const activityDate = queryParams.get('date') || '';
  const activityQuestionNumber = queryParams.get('question') || '';
  const pageCopy = activityPhaseCopy(activityPhase);
  const [tasks, setTasks] = useState(SPEAKING_TASKS.map((task) => ({ ...task, taskKey: task.id })));
  const [selectedTaskKey, setSelectedTaskKey] = useState(requestedTaskKey || 'ra-a2-campus-library');
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
  const [, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [portfolioSaved, setPortfolioSaved] = useState(false);
  const [error, setError] = useState('');
  const practiceStageRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const speechShouldListenRef = useRef(false);
  const speechFinalTranscriptRef = useRef('');
  const transcriptRef = useRef('');
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
          const requested = requestedTaskKey && data.tasks.some((task) => task.taskKey === requestedTaskKey)
            ? requestedTaskKey
            : data.tasks[0].taskKey;
          if (requestedTaskKey && requested !== requestedTaskKey) {
            setError('找不到這題 English Table 練習，請稍後再試或改選其他題目。');
          }
          setSelectedTaskKey(requested);
        }
      })
      .catch(() => {
        // Local task bank remains available before migrations are applied.
        if (requestedTaskKey) setError('暫時無法載入 English Table 練習題，請確認後端服務與題庫同步狀態。');
      });
    return () => controller.abort();
  }, [requestedTaskKey]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const selectedTask = useMemo(
    () => tasks.find((task) => (task.taskKey || task.id) === selectedTaskKey) || tasks[0],
    [selectedTaskKey, tasks],
  );
  const isEnglishTableTask = selectedTask?.linkedActivity === 'English Table' || sourceContext === 'english-table';
  const selectedIsEnglishTableQuestion = selectedTask?.linkedActivity === 'English Table';
  const showAdaptiveControls = !isEnglishTableTask;

  const isReadAloud = selectedTask?.taskType === 'read_aloud';
  const readAloudLine = useMemo(
    () => (isReadAloud ? readAloudPieces(selectedTask?.targetText, result?.wordResults) : []),
    [isReadAloud, result, selectedTask?.targetText],
  );
  const showEndingLegend = readAloudLine.some((piece) => piece.status === 'ending');
  const presentationScores = result?.presentationScores || result?.automatedScores?.presentationScores || {};
  const overallPercent = presentationScores.completionPercent;
  const resultTaskType = result?.task?.taskType || selectedTask?.taskType;
  const resultIsReadAloud = resultTaskType === 'read_aloud';
  const taskInstruction = getTaskInstruction(selectedTask);
  const pictureSrc = pictureForTask(selectedTask);
  const adaptiveCompletedCount = adaptiveSession?.progress?.completedCount || 0;

  const startSpeechRecognition = () => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setSpeechStatus('unsupported');
      setSpeechError('此瀏覽器不支援自動逐字稿，仍會儲存錄音。伺服器會依錄音產生逐字稿。');
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
      const nextTranscript = `${finalText} ${interimText}`.trim();
      transcriptRef.current = nextTranscript;
      setInterimTranscript(interimText);
      setTranscript(nextTranscript);
    };

    recognition.onerror = (event) => {
      const blocked = event?.error === 'not-allowed' || event?.error === 'service-not-allowed';
      setSpeechError(blocked ? SPEECH_BLOCKED_MESSAGE : '語音辨識已停止，錄音仍可送出。');
      setSpeechStatus('error');
      speechShouldListenRef.current = false;
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
    } catch {
      speechShouldListenRef.current = false;
      setSpeechStatus('error');
      setSpeechError(SPEECH_BLOCKED_MESSAGE);
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

  async function submitAttempt({
    blob = audioBlob,
    duration = durationMs,
    features = clientFeatures,
    transcriptText = transcriptRef.current || transcript,
  } = {}) {
    if (!blob || !selectedTask) return;
    setSubmitting(true);
    setError('');
    try {
      const nextTranscript = transcriptText || '';
      const nextTranscriptWordCount = wordsOf(nextTranscript).length;
      const spokenWordEstimate = nextTranscriptWordCount || 0;
      const data = await submitSpeakingAttempt({
        taskKey: selectedTask.taskKey || selectedTask.id,
        studentId,
        clientSessionId: getClientSessionId(),
        adaptiveSessionUid: adaptiveSession?.sessionUid,
        audioBlob: blob,
        audioFileName: `${selectedTask.taskKey || selectedTask.id}.webm`,
        durationMs: duration,
        transcript: nextTranscript,
        clientFeatures: {
          ...(features || {}),
          spokenWordEstimate,
          browserUserAgent: navigator.userAgent,
          context: {
            source: sourceContext || (isEnglishTableTask ? 'english-table' : 'diagnostic'),
            activityPhase,
            linkedActivity: selectedTask.linkedActivity || null,
            activityDate: activityDate || null,
            activityQuestionNumber: activityQuestionNumber || null,
            requestedTaskKey: requestedTaskKey || null,
            pagePath: `${location.pathname}${location.search}`,
          },
        },
      });
      setResult(data);
      const scores = data.presentationScores || data.automatedScores?.presentationScores || {};
      saveSpeakingPortfolioAttempt({
        attemptUid: data.attemptUid,
        taskKey: selectedTask.taskKey || selectedTask.id,
        title: selectedTask.title,
        source: selectedIsEnglishTableQuestion ? 'English Table' : 'Speaking Diagnostic',
        activityPhase,
        submittedAt: new Date().toISOString(),
        overallPercent: scores.completionPercent,
        completionPercent: scores.completionPercent,
        fluencyPercent: scores.fluencyPercent,
        vocabularyPercent: scores.vocabularyPercent,
        taskAchievementPercent: scores.taskAchievementPercent,
        ideaDevelopmentPercent: scores.ideaDevelopmentPercent,
        transcriptWordCount: data.features?.transcriptWordCount,
        speechRateWpm: data.features?.speechRateWpm,
        advice: getResultMessage(scores.completionPercent),
        href: `${location.pathname}${location.search}`,
      });
      setPortfolioSaved(true);
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
        previousOverallPercent: data.presentationScores?.completionPercent || data.automatedScores?.presentationScores?.completionPercent,
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
  }

  const startRecording = async () => {
    setError('');
    setSpeechError('');
    setSpeechStatus('idle');
    setTranscript('');
    transcriptRef.current = '';
    speechFinalTranscriptRef.current = '';
    setInterimTranscript('');
    setResult(null);
    setPortfolioSaved(false);
    setAudioBlob(null);
    setClientFeatures(null);
    setDurationMs(null);
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
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        await submitAttempt({
          blob: nextBlob,
          duration: nextDurationMs,
          features,
          transcriptText: transcriptRef.current || speechFinalTranscriptRef.current,
        });
      };
      const now = Date.now();
      startedAtRef.current = now;
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

  const clearAttemptState = () => {
    setResult(null);
    setPortfolioSaved(false);
    setTranscript('');
    transcriptRef.current = '';
    speechFinalTranscriptRef.current = '';
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
    practiceStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const retrySameTask = () => {
    clearAttemptState();
    practiceStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const handleSubmit = () => submitAttempt();

  const breadcrumbs = [
    { label: '首頁', path: '/' },
    { label: '學習資源', path: '/learning-resources' },
    { label: '口說診斷' },
  ];

  return (
    <div className="speaking-diagnostic-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={isEnglishTableTask ? pageCopy.title : '口說診斷'}
        lead={isEnglishTableTask ? pageCopy.lead : '完成幾題口說任務，系統會依你的表現安排下一題並給出練習回饋。'}
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

            {showAdaptiveControls ? (
              <div className="speaking-adaptive-card">
                <div>
                  <strong>{adaptiveSession ? getAdaptiveLabel(adaptiveSession) : '適應性測驗'}</strong>
                  <span>{adaptiveSession ? `${adaptiveCompletedCount}/${adaptiveSession.maxTasks} 題 · 目前估計 ${adaptiveSession.currentLevel}` : '依作答結果安排下一題'}</span>
                </div>
                <button
                  className="btn btn-outline-primary btn-sm"
                  type="button"
                  disabled={adaptiveStarting || recording || submitting}
                  onClick={handleStartAdaptiveSession}
                >
                  {adaptiveStarting ? '啟動中...' : adaptiveSession ? '重新開始' : '開始'}
                </button>
              </div>
            ) : null}

            {isEnglishTableTask ? (
              <div className="speaking-context-card">
                <strong>{pageCopy.label}</strong>
                <span>{pageCopy.context}</span>
              </div>
            ) : null}

            <details className="speaking-task-picker">
              <summary>自行選題練習</summary>
              {TASK_LEVELS.map((level) => {
                const levelTasks = tasks.filter((task) => task.level === level);
                if (!levelTasks.length) return null;
                const coreTasks = levelTasks.filter((task) => task.linkedActivity !== 'English Table');
                const tableTasks = levelTasks.filter((task) => task.linkedActivity === 'English Table');
                const topics = [...new Set(tableTasks.map(englishTableTopic))];
                return (
                  <details key={level} className="speaking-task-group">
                    <summary>{level}</summary>
                    {TASK_TYPE_ORDER.map((type) => (
                      <TaskGroup
                        key={type}
                        label={TASK_TYPE_LABELS[type] || type}
                        tasks={coreTasks.filter((task) => task.taskType === type)}
                        selectedTaskKey={selectedTaskKey}
                        disabled={recording || submitting}
                        onSelect={(task, key) => {
                          selectTaskForNextAttempt({ ...task, taskKey: key });
                          setNextTaskRecommendation(null);
                        }}
                      />
                    ))}
                    {tableTasks.length ? (
                      <details className="speaking-task-group speaking-task-group--nested">
                        <summary>English Table · {tableTasks.length}</summary>
                        {topics.map((topic) => (
                          <TaskGroup
                            key={topic}
                            label={topic}
                            tasks={tableTasks.filter((task) => englishTableTopic(task) === topic)}
                            selectedTaskKey={selectedTaskKey}
                            disabled={recording || submitting}
                            onSelect={(task, key) => {
                              selectTaskForNextAttempt({ ...task, taskKey: key });
                              setNextTaskRecommendation(null);
                            }}
                          />
                        ))}
                      </details>
                    ) : null}
                  </details>
                );
              })}
            </details>
          </div>

          <div className="speaking-tool__main">
              <div className="speaking-practice-stage" ref={practiceStageRef}>
              <div className="speaking-stage-meta">
                <span>{selectedTask?.level}</span>
                <span>{TASK_TYPE_LABELS[selectedTask?.taskType] || selectedTask?.taskType}</span>
                {selectedTask?.linkedActivity ? <span>{selectedTask.linkedActivity}</span> : null}
                {isEnglishTableTask ? <span>{pageCopy.label}</span> : null}
                <span>建議 {selectedTask?.estimatedSeconds || 15} 秒</span>
              </div>
              <div className="speaking-stage-center">
                <h2>{selectedTask?.title}</h2>
                <p className="speaking-stage-instruction">{taskInstruction}</p>
                {pictureSrc ? (
                  <img className="speaking-picture" src={pictureSrc} alt="" />
                ) : null}
                <button
                  className={`speaking-mic-button${recording ? ' speaking-mic-button--recording' : ''}`}
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={submitting}
                  aria-label={recording ? '停止錄音' : '開始錄音'}
                >
                  {recording ? <Stop size={38} weight="fill" /> : <Microphone size={46} />}
                </button>
                <div className="speaking-stage-status">
                  {recording
                    ? '正在錄音，完成後再按一次停止'
                    : submitting
                      ? '正在聽寫並計算回饋'
                      : result
                        ? pageCopy.statusDone
                        : durationMs
                          ? `已錄音 ${formatMs(durationMs)}`
                          : '按下麥克風開始'}
                </div>
                {speechError ? (
                  <div className="speaking-speech-status speaking-speech-status--unsupported">
                    {speechError}
                  </div>
                ) : speechRecognitionAvailable ? null : (
                  <div className="speaking-speech-status speaking-speech-status--unsupported">
                    此瀏覽器不支援自動逐字稿，伺服器會依錄音產生逐字稿
                  </div>
                )}
              </div>
              {isReadAloud ? (
                <div className="speaking-line-strip" aria-label="朗讀句子">
                  {readAloudLine.map((piece) => (
                    piece.kind === 'word' ? (
                      <span key={piece.key} className={`speaking-word speaking-word--${piece.status}`}>
                        {piece.text}
                      </span>
                    ) : (
                      <span key={piece.key}>{piece.text}</span>
                    )
                  ))}
                  {result ? (
                    <div className="speaking-word-legend">
                      <span><i className="speaking-word-legend__swatch speaking-word-legend__swatch--matched" aria-hidden="true" />有聽到</span>
                      <span><i className="speaking-word-legend__swatch speaking-word-legend__swatch--missing" aria-hidden="true" />沒聽到</span>
                      {showEndingLegend ? (
                        <span><i className="speaking-word-legend__swatch speaking-word-legend__swatch--ending" aria-hidden="true" />字尾不清楚</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="speaking-open-prompt" aria-label="Speaking prompt">
                  <span>{TASK_TYPE_LABELS[selectedTask?.taskType] || '口說題'}</span>
                  <p>{selectedTask?.prompt}</p>
                  {selectedTask?.targetVocabulary?.length ? (
                    <div className="speaking-vocabulary-chips" aria-label="Suggested vocabulary">
                      {selectedTask.targetVocabulary.slice(0, 8).map((word) => (
                        <span key={word}>{word}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
              <div className="speaking-stage-footer">
                <span><Waveform size={18} /> {recording ? '錄音中' : submitting ? '分析中' : result ? '已完成' : audioBlob ? '已錄音' : '尚未錄音'}</span>
                <span>{durationMs ? formatMs(durationMs) : '0.0 秒'} / {selectedTask?.estimatedSeconds || 15} 秒</span>
                <span><ChartBar size={18} /> {result ? formatPercent(overallPercent) : submitting ? '分析中' : '等待作答'}</span>
              </div>
            </div>

            <details className="speaking-review-panel">
              <summary>錄音回放</summary>
              {audioUrl ? (
                <audio className="speaking-audio" controls src={audioUrl}>
                  <track kind="captions" />
                </audio>
              ) : (
                <p className="speaking-review-panel__empty">錄音完成後可以在這裡回放。</p>
              )}
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
              <span className="text-muted">
                {recording
                  ? '停止錄音後會自動送出。'
                  : submitting
                    ? '請留在此頁，聽寫完成後會出現回饋。'
                    : result
                      ? (selectedIsEnglishTableQuestion ? '本題已記下。現場會用你最後一次的回答。' : '本題已完成分析。')
                      : audioBlob
                        ? '錄音已完成。若沒有自動送出，可重新送出。'
                        : '按下麥克風開始，停止後會自動送出。'}
              </span>
              {audioBlob && !result && !submitting ? (
                <button
                  className="btn btn-outline-success"
                  type="button"
                  onClick={handleSubmit}
                >
                  重新送出
                </button>
              ) : null}
              {portfolioSaved && !selectedIsEnglishTableQuestion ? (
                <Link className="btn btn-outline-primary" to="/student/speaking-portfolio">
                  查看口說紀錄
                </Link>
              ) : null}
            </div>

            {result ? (
              <section className="speaking-result" aria-label="本題回饋">
                {selectedIsEnglishTableQuestion ? (
                  <>
                    <div className="speaking-result__header">
                      <div>
                        <h3>本題回饋</h3>
                        <p>現場會用你最後一次的回答。</p>
                      </div>
                    </div>
                    <div className="speaking-heard">
                      <span>系統聽到</span>
                      <p>{String(result.transcript || '').trim() || '沒有辨識到英文。'}</p>
                    </div>
                    <EnglishTableNextLine transcript={result.transcript} prompt={selectedTask?.prompt || ''} />
                    <div className="speaking-next-task">
                      <div>
                        <strong>同一題</strong>
                        <span>現場會看你最後一次的回答</span>
                      </div>
                      <button className="btn btn-primary" type="button" onClick={retrySameTask}>
                        再答一次
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="speaking-result__header">
                      <div>
                        <h3>本題回饋</h3>
                        <p>{getResultMessage(overallPercent)}</p>
                      </div>
                      <ScoreDial value={overallPercent} label="總分" />
                    </div>
                    <div className="speaking-heard">
                      <span>系統聽到</span>
                      <p>{String(result.transcript || '').trim() || '沒有辨識到英文，所以和內容有關的分數是空的。'}</p>
                      {result.features?.weakEndings?.length ? (
                        <p className="speaking-heard__note">
                          這些字的字尾 s 幾乎沒有聲音，所以沒有算成念對：{result.features.weakEndings.join('、')}
                        </p>
                      ) : null}
                    </div>
                    {nextTaskRecommendation?.task ? (
                      <div className="speaking-next-task">
                        <div>
                          <strong>{adaptiveSession?.status === 'completed' ? '測驗已完成' : '下一題'}</strong>
                          <span>{nextTaskRecommendation.task.level} · {nextTaskRecommendation.task.title}</span>
                        </div>
                        <button
                          className="btn btn-primary"
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
                    <div className="speaking-metric-grid">
                      <MetricBar
                        label="完成度"
                        value={presentationScores.completionPercent}
                        detail={resultIsReadAloud ? '有聽到的目標字' : '長度，並依題目用字下修'}
                      />
                    </div>
                    <p className="text-muted mb-0">此回饋用於練習診斷，不是正式檢定分數。</p>
                  </>
                )}
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

