import localTranslations from './translations.json';

const BASE = process.env.REACT_APP_LINGVA_URL || 'https://translate.plausibility.cloud';

const mem = new Map();
let failureCount = 0;
const FAILURE_THRESHOLD = 3;
let lastFailureTime = 0;
const RETRY_COOLDOWN = 60000; // 1 minute cooldown after failures

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

function getLocal(source, target, text) {
  if (source === 'auto' && target === 'en') return text; // Assuming source is en
  if (localTranslations[target] && localTranslations[target][text]) {
    return localTranslations[target][text];
  }
  return null;
}

async function translate(text, target, source = 'auto') {
  if (!text) return '';
  if (source === target) return text;
  
  // 1. Check local JSON dictionary
  const local = getLocal(source, target, text);
  if (local) return local;

  // 2. Check cache
  const cached = getCached(source, target, text);
  if (cached) return cached;

  // 3. Circuit breaker check
  const now = Date.now();
  if (failureCount >= FAILURE_THRESHOLD) {
    if (now - lastFailureTime < RETRY_COOLDOWN) {
      // Still in cooldown, return original text immediately
      return text;
    } else {
      // Reset after cooldown
      failureCount = 0;
    }
  }

  // 4. API Call
  try {
    // Add timeout to fetch to avoid long hangs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const url = `${BASE}/api/v1/${source}/${target}/${encodeURIComponent(text)}`;
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    const j = await r.json();
    const t = j.translation || text;
    
    // Success: Cache it and reset failures
    const key = k(source, target, text);
    mem.set(key, t);
    try { localStorage.setItem(`translation:${key}`, t); } catch (e) { void e; }
    failureCount = 0;
    
    return t;
  } catch (err) {
    // Failure
    failureCount++;
    lastFailureTime = Date.now();
    console.warn(`Translation failed for "${text}" (${source}->${target}):`, err.message);
    return text;
  }
}

async function translateMany(texts = [], target, source = 'auto') {
  const out = {};
  // Optimize: Check all local/cached first to avoid unnecessary promises
  const toFetch = [];
  
  texts.forEach(txt => {
    if (source === target) {
      out[txt] = txt;
      return;
    }
    const local = getLocal(source, target, txt);
    if (local) {
      out[txt] = local;
      return;
    }
    const cached = getCached(source, target, txt);
    if (cached) {
      out[txt] = cached;
      return;
    }
    toFetch.push(txt);
  });

  if (toFetch.length === 0) return out;

  // Batching strategy to reduce API calls
  const BATCH_SIZE = 20;
  const batches = [];
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    batches.push(toFetch.slice(i, i + BATCH_SIZE));
  }

  const fetchApi = async (text) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); 
    try {
      const url = `${BASE}/api/v1/${source}/${target}/${encodeURIComponent(text)}`;
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return j.translation || text;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  };

  await Promise.all(batches.map(async (batch) => {
    if (batch.length === 0) return;
    
    // If single item, use standard translate to avoid complexity
    if (batch.length === 1) {
      out[batch[0]] = await translate(batch[0], target, source);
      return;
    }

    // Circuit breaker check
    const now = Date.now();
    if (failureCount >= FAILURE_THRESHOLD && now - lastFailureTime < RETRY_COOLDOWN) {
       batch.forEach(t => out[t] = t);
       return;
    }

    try {
      const joined = batch.join('\n\n');
      let translatedJoined;
      
      try {
        translatedJoined = await fetchApi(joined);
        failureCount = 0;
      } catch (err) {
        failureCount++;
        lastFailureTime = Date.now();
        console.warn('Batch fetch failed, falling back to individual:', err.message);
        throw err; // Trigger fallback
      }

      const split = translatedJoined.split('\n\n');
      if (split.length === batch.length) {
        batch.forEach((txt, i) => {
          const t = split[i];
          out[txt] = t;
          const key = k(source, target, txt);
          mem.set(key, t);
          try { localStorage.setItem(`translation:${key}`, t); } catch (e) { void e; }
        });
      } else {
        console.warn(`Batch mismatch (sent ${batch.length}, got ${split.length}), falling back to individual`);
        throw new Error('Batch mismatch');
      }
    } catch (e) {
      // Fallback to individual requests
      await Promise.all(batch.map(async (txt) => {
        out[txt] = await translate(txt, target, source);
      }));
    }
  }));
  
  return out;
}

export default { getLang, setLang, translate, translateMany };
