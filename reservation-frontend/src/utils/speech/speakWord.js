/**
 * 瀏覽器 speechSynthesis 封裝；未來可替換為 audioUrl。
 */

export const LISTENING_LADDER_TEST_WORD = 'hello';

let voicesReady = false;

function primeSpeechSynthesis() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

function waitForVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.reject(new Error('SPEECH_NOT_SUPPORTED'));
  }
  primeSpeechSynthesis();
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    voicesReady = true;
    return Promise.resolve(voices);
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      const fallback = window.speechSynthesis.getVoices();
      if (fallback.length > 0) {
        voicesReady = true;
        resolve(fallback);
        return;
      }
      reject(new Error('SPEECH_VOICES_TIMEOUT'));
    }, 4000);
    function onVoices() {
      const loaded = window.speechSynthesis.getVoices();
      if (loaded.length > 0) {
        clearTimeout(timeout);
        window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
        voicesReady = true;
        resolve(loaded);
      }
    }
    window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    primeSpeechSynthesis();
  });
}

function pickEnglishVoice(voices) {
  return (
    voices.find((v) => v.lang === 'en-US')
    || voices.find((v) => v.lang.startsWith('en'))
    || voices[0]
  );
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @param {string} text
 * @param {{ lang?: string, rate?: number }} [options]
 * @returns {Promise<void>}
 */
export async function speakWord(text, { lang = 'en-US', rate = 0.9 } = {}) {
  if (!text || typeof text !== 'string') {
    return Promise.reject(new Error('SPEECH_EMPTY_TEXT'));
  }
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.reject(new Error('SPEECH_NOT_SUPPORTED'));
  }

  const voices = voicesReady
    ? window.speechSynthesis.getVoices()
    : await waitForVoices();

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  await delay(100);

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = lang;
    utterance.rate = rate;
    const voice = pickEnglishVoice(voices.length ? voices : window.speechSynthesis.getVoices());
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      reject(new Error(event.error || 'SPEECH_PLAYBACK_FAILED'));
    };

    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume();
  });
}

/** 準備開始前的測試播放 */
export function speakTestSample() {
  return speakWord(LISTENING_LADDER_TEST_WORD);
}

export function preloadSpeechVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  return waitForVoices().catch(() => []);
}

export function cancelSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && Boolean(window.speechSynthesis);
}
