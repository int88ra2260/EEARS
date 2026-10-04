'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', () => resolve(input));
  });
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function normalizeWord(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ms(seconds) {
  const n = Number(seconds);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 1000)) : null;
}

function makeResult(status, warnings = [], extra = {}) {
  return {
    status,
    engine: extra.engine || 'mfa_forced_alignment_v0',
    words: extra.words || [],
    phones: extra.phones || [],
    metrics: extra.metrics || null,
    warnings,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: true,
      windowsHide: true,
      env: { ...process.env, ...(options.env || {}) },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', (error) => resolve({ code: -1, stdout, stderr: error.message }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function safeName(value) {
  return String(value || `attempt-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `attempt-${Date.now()}`;
}

function quoteArg(value) {
  return String(value);
}

function findFiles(root, predicate, out = []) {
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) findFiles(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function parseTextGrid(content) {
  const lines = String(content || '').split(/\r?\n/);
  const tiers = {};
  let tierName = null;
  let interval = null;

  function finishInterval() {
    if (!tierName || !interval || interval.xmin == null || interval.xmax == null || interval.text == null) return;
    if (!tiers[tierName]) tiers[tierName] = [];
    tiers[tierName].push({ ...interval });
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const nameMatch = line.match(/^name\s*=\s*"([^"]+)"/);
    if (nameMatch) {
      finishInterval();
      interval = null;
      tierName = nameMatch[1].toLowerCase();
      continue;
    }
    if (/^intervals\s*\[\d+\]:/.test(line)) {
      finishInterval();
      interval = {};
      continue;
    }
    if (!interval) continue;
    const xminMatch = line.match(/^xmin\s*=\s*([-0-9.]+)/);
    if (xminMatch) {
      interval.xmin = Number(xminMatch[1]);
      continue;
    }
    const xmaxMatch = line.match(/^xmax\s*=\s*([-0-9.]+)/);
    if (xmaxMatch) {
      interval.xmax = Number(xmaxMatch[1]);
      continue;
    }
    const textMatch = line.match(/^text\s*=\s*"(.*)"/);
    if (textMatch) {
      interval.text = textMatch[1];
    }
  }
  finishInterval();
  return tiers;
}

function pickTier(tiers, names) {
  for (const name of names) {
    if (Array.isArray(tiers[name])) return tiers[name];
  }
  const key = Object.keys(tiers).find((candidate) => names.some((name) => candidate.includes(name)));
  return key ? tiers[key] : [];
}

function buildMetrics(words, durationMs) {
  const aligned = words.filter((word) => word.startMs != null && word.endMs != null);
  const gaps = [];
  for (let i = 1; i < aligned.length; i += 1) {
    const gap = aligned[i].startMs - aligned[i - 1].endMs;
    if (Number.isFinite(gap) && gap > 0) gaps.push(gap);
  }
  const longGaps = gaps.filter((gap) => gap >= 300);
  const speechMs = aligned.reduce((sum, word) => sum + Math.max(0, word.endMs - word.startMs), 0);
  const durationMinutes = durationMs ? durationMs / 60000 : null;
  const articulationMinutes = speechMs ? speechMs / 60000 : null;
  return {
    alignedWordCount: aligned.length,
    speechMs: Math.round(speechMs),
    pauseCount: longGaps.length,
    averagePauseDurationMs: longGaps.length ? Math.round(longGaps.reduce((sum, gap) => sum + gap, 0) / longGaps.length) : 0,
    totalPauseMs: Math.round(longGaps.reduce((sum, gap) => sum + gap, 0)),
    speechRateWpm: durationMinutes ? Number((aligned.length / durationMinutes).toFixed(2)) : null,
    articulationRateWpm: articulationMinutes ? Number((aligned.length / articulationMinutes).toFixed(2)) : null,
  };
}

function textGridToAlignment(textGridPath, durationMs) {
  const tiers = parseTextGrid(fs.readFileSync(textGridPath, 'utf8'));
  const wordIntervals = pickTier(tiers, ['words', 'word']);
  const phoneIntervals = pickTier(tiers, ['phones', 'phone']);
  const words = wordIntervals
    .map((item, index) => ({
      index,
      word: normalizeWord(item.text),
      startMs: ms(item.xmin),
      endMs: ms(item.xmax),
      source: 'mfa_textgrid',
      status: 'aligned',
    }))
    .filter((item) => item.word && item.startMs != null && item.endMs != null && item.endMs > item.startMs)
    .map((item) => ({ ...item, durationMs: item.endMs - item.startMs }));

  const phones = phoneIntervals
    .map((item) => {
      const startMs = ms(item.xmin);
      const endMs = ms(item.xmax);
      const wordIndex = words.findIndex((word) => startMs != null && endMs != null && startMs >= word.startMs && endMs <= word.endMs);
      return {
        wordIndex: wordIndex >= 0 ? wordIndex : null,
        phone: String(item.text || '').trim(),
        startMs,
        endMs,
      };
    })
    .filter((item) => item.phone && item.startMs != null && item.endMs != null && item.endMs > item.startMs);

  return makeResult('aligned', [], {
    engine: process.env.SPEAKING_MFA_ENGINE || 'mfa_forced_alignment_v0',
    words,
    phones,
    metrics: buildMetrics(words, durationMs),
  });
}

async function main() {
  if (process.argv.includes('--self-test')) {
    const sample = [
      'File type = "ooTextFile"',
      'Object class = "TextGrid"',
      'item [1]:',
      'class = "IntervalTier"',
      'name = "words"',
      'intervals [1]:',
      'xmin = 0.1',
      'xmax = 0.5',
      'text = "hello"',
      'intervals [2]:',
      'xmin = 0.6',
      'xmax = 1.0',
      'text = "world"',
    ].join('\n');
    const tmp = path.join(os.tmpdir(), `mfa-self-test-${Date.now()}.TextGrid`);
    fs.writeFileSync(tmp, sample);
    emit(textGridToAlignment(tmp, 1200));
    fs.rmSync(tmp, { force: true });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch (error) {
    emit(makeResult('invalid_payload', [error.message]));
    return;
  }

  const audioPath = path.resolve(payload.audioPath || '');
  if (!audioPath || !fs.existsSync(audioPath)) {
    emit(makeResult('audio_missing', [`Audio file not found: ${audioPath}`]));
    return;
  }

  const dictionary = process.env.SPEAKING_MFA_DICTIONARY || process.env.MFA_DICTIONARY;
  const acousticModel = process.env.SPEAKING_MFA_ACOUSTIC_MODEL || process.env.MFA_ACOUSTIC_MODEL;
  if (!dictionary || !acousticModel) {
    emit(makeResult('mfa_unconfigured', ['Set SPEAKING_MFA_DICTIONARY and SPEAKING_MFA_ACOUSTIC_MODEL before enabling MFA alignment.']));
    return;
  }

  const ffmpeg = process.env.SPEAKING_FFMPEG_COMMAND || 'ffmpeg';
  const mfa = process.env.SPEAKING_MFA_COMMAND || 'mfa';
  const root = process.env.SPEAKING_MFA_TEMP_ROOT || path.join(os.tmpdir(), 'eears-speaking-mfa');
  const attemptName = safeName(payload.attemptUid);
  const workDir = path.join(root, attemptName);
  const corpusDir = path.join(workDir, 'corpus');
  const outputDir = path.join(workDir, 'aligned');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(corpusDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const wavPath = path.join(corpusDir, `${attemptName}.wav`);
  const labPath = path.join(corpusDir, `${attemptName}.lab`);
  fs.writeFileSync(labPath, String(payload.targetText || payload.transcript || '').trim(), 'utf8');

  const convert = await run(ffmpeg, ['-y', '-i', quoteArg(audioPath), '-ac', '1', '-ar', '16000', quoteArg(wavPath)]);
  if (convert.code !== 0) {
    emit(makeResult('ffmpeg_error', [convert.stderr || convert.stdout || 'ffmpeg conversion failed.']));
    return;
  }

  const mfaArgs = [
    'align',
    quoteArg(corpusDir),
    quoteArg(dictionary),
    quoteArg(acousticModel),
    quoteArg(outputDir),
    '--clean',
    '--overwrite',
  ];
  const aligned = await run(mfa, mfaArgs, { cwd: workDir });
  if (aligned.code !== 0) {
    emit(makeResult('mfa_error', [aligned.stderr || aligned.stdout || 'mfa align failed.']));
    return;
  }

  const textGrids = findFiles(outputDir, (file) => file.toLowerCase().endsWith('.textgrid'));
  if (!textGrids.length) {
    emit(makeResult('mfa_no_textgrid', ['MFA completed but no TextGrid file was found.']));
    return;
  }
  emit(textGridToAlignment(textGrids[0], payload.durationMs));

  if (process.env.SPEAKING_MFA_KEEP_TEMP !== '1') {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  emit(makeResult('mfa_runner_error', [error.stack || error.message]));
});
