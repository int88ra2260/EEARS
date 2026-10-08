'use strict';

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

const DEFAULT_PORT = 18766;
const DEFAULT_MODEL = 'small.en';
const WORKER_SCRIPT = path.join(__dirname, 'speaking-whisper-worker.py');
const PID_PATH = path.join(os.tmpdir(), 'eears-speaking-whisper-worker.pid');
const LOG_PATH = path.join(os.tmpdir(), 'eears-speaking-whisper-worker.log');

let starting = null;

function workerPort() {
  const port = Number(process.env.SPEAKING_WHISPER_WORKER_PORT || DEFAULT_PORT);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}

function whisperModelName() {
  return String(process.env.SPEAKING_WHISPER_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function transcriptSourceLabel() {
  return `faster-whisper:${whisperModelName()}`;
}

function mfaCommand() {
  return String(process.env.SPEAKING_MFA_COMMAND || '').trim();
}

function condaEnvRoot(command) {
  if (!command || !fs.existsSync(command)) return null;
  const parent = path.dirname(path.resolve(command));
  return path.basename(parent).toLowerCase() === 'scripts' ? path.dirname(parent) : parent;
}

function withCondaLibraryPath(command) {
  const envRoot = condaEnvRoot(command);
  if (!envRoot) return undefined;
  const dirs = [
    path.join(envRoot, 'Library', 'bin'),
    path.join(envRoot, 'Library', 'mingw-w64', 'bin'),
    path.join(envRoot, 'Library', 'usr', 'bin'),
    path.join(envRoot, 'Scripts'),
    envRoot,
  ].filter((dir) => fs.existsSync(dir));
  if (!dirs.length) return undefined;
  const key = Object.keys(process.env).find((name) => name.toLowerCase() === 'path') || 'Path';
  return { [key]: `${dirs.join(path.delimiter)}${path.delimiter}${process.env[key] || ''}` };
}

function pythonExecutable() {
  const configured = String(process.env.SPEAKING_WHISPER_PYTHON || '').trim();
  if (configured && fs.existsSync(configured)) return configured;
  const envRoot = condaEnvRoot(mfaCommand());
  if (!envRoot) return null;
  const candidate = path.join(envRoot, 'python.exe');
  return fs.existsSync(candidate) ? candidate : null;
}

function workerConfigured() {
  if (String(process.env.SPEAKING_WHISPER_WORKER || '1') === '0') return false;
  return Boolean(pythonExecutable() && fs.existsSync(WORKER_SCRIPT));
}

function commandLineOf(pid) {
  return new Promise((resolve) => {
    execFile(
      'powershell',
      ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`],
      { windowsHide: true, timeout: 10000 },
      (error, stdout) => resolve(error ? '' : String(stdout || '')),
    );
  });
}

function taskkill(pid) {
  return new Promise((resolve) => {
    execFile('taskkill', ['/F', '/PID', String(pid)], { windowsHide: true }, () => resolve());
  });
}

async function stopWorkerIfOurs() {
  if (!fs.existsSync(PID_PATH)) return;
  const pid = Number(fs.readFileSync(PID_PATH, 'utf8'));
  if (!pid) return;
  const commandLine = await commandLineOf(pid);
  if (commandLine.includes('speaking-whisper-worker.py')) {
    await taskkill(pid);
  }
  fs.rmSync(PID_PATH, { force: true });
}

function sendJob(job, timeoutMs) {
  const port = workerPort();
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    let buffer = '';
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      socket.write(`${JSON.stringify(job)}\n`);
    });
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (!buffer.includes('\n')) return;
      try {
        finish(null, JSON.parse(buffer.split('\n', 1)[0]));
      } catch (error) {
        finish(error);
      }
    });
    socket.on('timeout', () => finish(new Error('Whisper worker timed out.')));
    socket.on('error', (error) => finish(error));
    socket.on('close', () => {
      if (!settled) finish(new Error('Whisper worker closed the connection.'));
    });
  });
}

function startWorker() {
  const python = pythonExecutable();
  const logFd = fs.openSync(LOG_PATH, 'a');
  const child = spawn(python, [WORKER_SCRIPT], {
    detached: true,
    windowsHide: true,
    stdio: ['ignore', 'ignore', logFd],
    env: {
      ...process.env,
      ...withCondaLibraryPath(mfaCommand()),
      KMP_DUPLICATE_LIB_OK: 'TRUE',
      SPEAKING_WHISPER_MODEL: whisperModelName(),
      SPEAKING_WHISPER_WORKER_PORT: String(workerPort()),
    },
  });
  fs.writeFileSync(PID_PATH, String(child.pid));
  child.unref();
  fs.closeSync(logFd);
}

async function waitUntilReady(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await sendJob({}, 2000);
      if (response && response.ok) return true;
    } catch {
      // The model is still loading, or the process has not bound the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureSpeakingWhisperWorker({ recycle = false } = {}) {
  if (!workerConfigured()) return false;
  if (recycle) {
    starting = null;
    await stopWorkerIfOurs();
  }
  try {
    const ready = await sendJob({}, 2000);
    if (ready && ready.ok) return true;
  } catch {
    // Start a worker below.
  }
  if (!starting) {
    starting = (async () => {
      try {
        startWorker();
        return await waitUntilReady(90000);
      } finally {
        starting = null;
      }
    })();
  }
  return starting;
}

async function transcribeOnce(audioPath, timeoutMs) {
  const response = await sendJob({ audioPath }, timeoutMs);
  if (!response || !response.ok) {
    return {
      text: '',
      source: transcriptSourceLabel(),
      error: response?.error || 'Whisper worker transcription failed.',
    };
  }
  return {
    text: String(response.text || '').trim(),
    source: transcriptSourceLabel(),
    error: null,
  };
}

async function transcribeSpeakingAudio(audioPath, timeoutMs = 60000) {
  if (!workerConfigured() || !audioPath) return { text: '', source: null, error: 'not_configured' };
  const absolutePath = path.resolve(audioPath);
  const limit = Number(timeoutMs) > 0 ? Number(timeoutMs) : 60000;
  try {
    return await transcribeOnce(absolutePath, limit);
  } catch (error) {
    const ready = await ensureSpeakingWhisperWorker();
    if (!ready) return { text: '', source: transcriptSourceLabel(), error: error.message };
    try {
      return await transcribeOnce(absolutePath, limit);
    } catch (retryError) {
      return { text: '', source: transcriptSourceLabel(), error: retryError.message };
    }
  }
}

module.exports = {
  ensureSpeakingWhisperWorker,
  transcribeSpeakingAudio,
  transcriptSourceLabel,
  whisperModelName,
  workerConfigured,
};
