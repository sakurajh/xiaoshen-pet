let voices = [];
let selectedVoice = null;
let audioContext = null;

function refreshVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  voices = window.speechSynthesis.getVoices();
  selectedVoice = voices.find((v) => /^zh[-_]CN/i.test(v.lang) && /(xiaoxiao|huihui|yaoyao|tingting|female|女)/i.test(v.name))
    || voices.find((v) => /^zh[-_]CN/i.test(v.lang))
    || voices.find((v) => /^zh/i.test(v.lang))
    || null;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}

export function speechSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function speak(text, { enabled = true, volume = 0.9 } = {}) {
  if (!enabled || !speechSupported()) return false;
  const content = String(text || '')
    .replace(/`/g, '')
    .replace(/[*#_>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  if (!content) return false;
  try {
    window.speechSynthesis.cancel();
    if (!selectedVoice) refreshVoices();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.03;
    utterance.pitch = 1.12;
    utterance.volume = Math.min(1, Math.max(0, volume));
    if (selectedVoice) utterance.voice = selectedVoice;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  if (!speechSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* noop */ }
}

export function playChime(kind = 'focus', volume = 0.9) {
  try {
    audioContext = audioContext || new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
    const notes = kind === 'break' ? [523.25, 659.25, 783.99] : [659.25, 783.99, 1046.5];
    const now = audioContext.currentTime;
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.11 * Math.min(1, volume), now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.42);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.45);
    });
    return true;
  } catch {
    return false;
  }
}
