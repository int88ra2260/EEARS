'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 120000;

function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function roundMs(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function buildBaselineAlignment({ targetText, durationMs }) {
  const words = tokenize(targetText);
  const safeDurationMs = clampNumber(durationMs, { min: 300, max: 10 * 60 * 1000 }) || Math.max(1200, words.length * 420);
  if (!words.length) {
    return {
      status: 'no_target_words',
      engine: 'baseline_timing_alignment_v0',
      words: [],
      phones: [],
      metrics: null,
      warnings: ['No target words were available for alignment.'],
    };
  }

  const leadingSilenceMs = Math.min(450, Math.round(safeDurationMs * 0.08));
  const trailingSilenceMs = Math.min(450, Math.round(safeDurationMs * 0.08));
  const usableMs = Math.max(words.length * 120, safeDurationMs - leadingSilenceMs - trailingSilenceMs);
  const gapMs = words.length > 1 ? Math.min(90, Math.max(25, Math.round(usableMs * 0.06 / (words.length - 1)))) : 0;
  const totalGapMs = gapMs * Math.max(0, words.length - 1);
  const speechMs = Math.max(words.length * 90, usableMs - totalGapMs);
  const wordMs = speechMs / words.length;

  let cursor = leadingSilenceMs;
  const alignedWords = words.map((word, index) => {
    const startMs = roundMs(cursor);
    const endMs = roundMs(index === words.length - 1 ? safeDurationMs - trailingSilenceMs : cursor + wordMs);
    cursor = endMs + gapMs;
    return {
      index,
      word,
      startMs,
      endMs,
      durationMs: Math.max(0, endMs - startMs),
      confidence: 0.35,
      source: 'duration_split',
      status: 'aligned',
    };
  });

  return {
    status: 'baseline',
    engine: 'baseline_timing_alignment_v0',
    words: alignedWords,
    phones: [],
    metrics: buildAlignmentMetrics(alignedWords, safeDurationMs),
    warnings: [
      'Baseline alignment estimates word timing from known target text and recording duration. Configure SPEAKING_ALIGNMENT_COMMAND for MFA or another real forced aligner.',
    ],
  };
}

function buildAlignmentMetrics(words, durationMs) {
  const alignedWords = (words || []).filter((word) => word && word.startMs != null && word.endMs != null);
  const gaps = [];
  for (let i = 1; i < alignedWords.length; i += 1) {
    const gapMs = alignedWords[i].startMs - alignedWords[i - 1].endMs;
    if (Number.isFinite(gapMs) && gapMs > 0) gaps.push(gapMs);
  }
  const longGaps = gaps.filter((gapMs) => gapMs >= 300);
  const speechMs = alignedWords.reduce((sum, word) => sum + Math.max(0, word.endMs - word.startMs), 0);
  const durationMinutes = durationMs ? durationMs / 60000 : null;
  const articulationMinutes = speechMs ? speechMs / 60000 : null;
  return {
    alignedWordCount: alignedWords.length,
    speechMs: roundMs(speechMs),
    pauseCount: longGaps.length,
    averagePauseDurationMs: longGaps.length
      ? roundMs(longGaps.reduce((sum, gapMs) => sum + gapMs, 0) / longGaps.length)
      : 0,
    totalPauseMs: roundMs(longGaps.reduce((sum, gapMs) => sum + gapMs, 0)),
    speechRateWpm: durationMinutes ? Number((alignedWords.length / durationMinutes).toFixed(2)) : null,
    articulationRateWpm: articulationMinutes ? Number((alignedWords.length / articulationMinutes).toFixed(2)) : null,
  };
}

function normalizeExternalAlignment(raw, fallbackDurationMs) {
  const parsed = raw && typeof raw === 'object' ? raw : {};
  const words = Array.isArray(parsed.words) ? parsed.words : [];
  const normalizedWords = words.map((word, index) => {
    const startMs = roundMs(word.startMs != null ? word.startMs : Number(word.start) * 1000);
    const endMs = roundMs(word.endMs != null ? word.endMs : Number(word.end) * 1000);
    return {
      index: Number.isInteger(word.index) ? word.index : index,
      word: normalizeText(word.word || word.label || ''),
      startMs,
      endMs,
      durationMs: startMs != null && endMs != null ? Math.max(0, endMs - startMs) : null,
      confidence: clampNumber(word.confidence, { min: 0, max: 1 }),
      source: word.source || parsed.engine || 'external_forced_alignment',
      status: word.status || 'aligned',
    };
  }).filter((word) => word.word);

  return {
    status: parsed.status || 'aligned',
    engine: parsed.engine || 'external_forced_alignment',
    words: normalizedWords,
    phones: Array.isArray(parsed.phones) ? parsed.phones : [],
    metrics: parsed.metrics || buildAlignmentMetrics(normalizedWords, fallbackDurationMs),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}

function runExternalAligner(payload, timeoutMs) {
  const command = String(process.env.SPEAKING_ALIGNMENT_COMMAND || '').trim();
  if (!command) return Promise.resolve(null);

  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({
        status: 'external_timeout',
        engine: 'external_forced_alignment',
        words: [],
        phones: [],
        metrics: null,
        warnings: [`Forced aligner timed out after ${timeoutMs}ms.`],
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        status: 'external_error',
        engine: 'external_forced_alignment',
        words: [],
        phones: [],
        metrics: null,
        warnings: [error.message],
      });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          status: 'external_error',
          engine: 'external_forced_alignment',
          words: [],
          phones: [],
          metrics: null,
          warnings: [stderr.trim() || `Forced aligner exited with code ${code}.`],
        });
        return;
      }
      try {
        resolve(normalizeExternalAlignment(JSON.parse(stdout), payload.durationMs));
      } catch (error) {
        resolve({
          status: 'external_parse_error',
          engine: 'external_forced_alignment',
          words: [],
          phones: [],
          metrics: null,
          warnings: [error.message, stdout.slice(0, 500)],
        });
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function alignSpeakingAttempt({ audioPath, targetText, transcript, durationMs, attemptUid }) {
  const absoluteAudioPath = path.resolve(audioPath);
  const timeoutMs = clampNumber(process.env.SPEAKING_ALIGNMENT_TIMEOUT_MS, { min: 1000, max: 120000 }) || DEFAULT_TIMEOUT_MS;
  const payload = {
    attemptUid,
    audioPath: absoluteAudioPath,
    targetText,
    transcript,
    durationMs,
  };

  if (!fs.existsSync(absoluteAudioPath)) {
    return {
      status: 'audio_missing',
      engine: 'none',
      words: [],
      phones: [],
      metrics: null,
      warnings: [`Audio file not found: ${absoluteAudioPath}`],
    };
  }

  const external = await runExternalAligner(payload, timeoutMs);
  if (external) return external;
  return buildBaselineAlignment({ targetText, durationMs });
}

module.exports = {
  alignSpeakingAttempt,
  buildAlignmentMetrics,
  buildBaselineAlignment,
  normalizeExternalAlignment,
};
