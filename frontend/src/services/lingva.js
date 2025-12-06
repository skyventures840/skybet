const BASE = process.env.REACT_APP_LINGVA_URL || 'https://lingva.ml';

const mem = new Map();

function getLang() {
  const v = localStorage.getItem('lang');
  return v || 'en';
}

function setLang(lang) {
  localStorage.setItem('lang', lang);
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

function k(source, target, text) {
  return `${source}:${target}:${text}`;
}

function getCached(source, target, text) {
  const key = k(source, target, text);
  if (mem.has(key)) return mem.get(key);
  const v = localStorage.getItem(`translation:${key}`);
  if (v) {
    mem.set(key, v);
    return v;
  }
  return null;
}

async function translate(text, target, source = 'auto') {
  if (!text) return '';
  const cached = getCached(source, target, text);
  if (cached) return cached;
  try {
    const url = `${BASE}/api/v1/${source}/${target}/${encodeURIComponent(text)}`;
    const r = await fetch(url);
    const j = await r.json();
    const t = j.translation || text;
    const key = k(source, target, text);
    mem.set(key, t);
    try { localStorage.setItem(`translation:${key}`, t); } catch (e) { void e; }
    return t;
  } catch (_) {
    return text;
  }
}

async function translateMany(texts = [], target, source = 'auto') {
  const out = {};
  await Promise.all(texts.map(async (txt) => {
    out[txt] = await translate(txt, target, source);
  }));
  return out;
}

export default { getLang, setLang, translate, translateMany };
