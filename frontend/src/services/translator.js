import lingva from './lingva';

const processed = new WeakSet();
const originals = new WeakMap();
let observer = null;
let pending = new Set();
let scheduled = false;

function isTranslatable(text) {
  if (!text) return false;
  const t = text.trim();
  if (!t) return false;
  if (/^[\p{P}\p{S}\d\s]+$/u.test(t)) return false;
  return /[A-Za-z]/.test(t);
}

function isNodeSkipped(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  let p = el;
  while (p) {
    try {
      if (p.hasAttribute && p.hasAttribute('data-no-translate')) return true;
      if (p.classList && (p.classList.contains('nav-brand') || p.classList.contains('brand-w') || p.classList.contains('brand-e'))) return true;
    } catch (e) { break; }
    p = p.parentElement;
  }
  return false;
}

function collectFrom(node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  let current;
  while ((current = walker.nextNode())) {
    const text = current.nodeValue;
    if (isTranslatable(text) && !isNodeSkipped(current)) {
      if (!originals.has(current)) originals.set(current, text);
      pending.add(current);
    }
  }
}

function schedule(lang) {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => flush(lang), 50);
}

async function flush(lang) {
  scheduled = false;
  const nodes = Array.from(pending);
  pending.clear();
  if (nodes.length === 0) return;
  const texts = Array.from(new Set(nodes.map(n => originals.get(n) || n.nodeValue))).filter(isTranslatable);
  if (texts.length === 0) return;
  const map = await lingva.translateMany(texts, lang);
  for (const n of nodes) {
    const src = originals.get(n) || n.nodeValue;
    const translated = map[src];
    if (translated && n.nodeValue !== translated) {
      n.nodeValue = translated;
      processed.add(n);
    }
  }
}

function applyAll(lang) {
  collectFrom(document.body);
  schedule(lang);
}

function onMutations(lang, mutations) {
  for (const m of mutations) {
    if (m.type === 'childList') {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 3) {
          const t = node.nodeValue;
          if (isTranslatable(t) && !isNodeSkipped(node)) {
            if (!originals.has(node)) originals.set(node, t);
            pending.add(node);
          }
        } else if (node.nodeType === 1) {
          if (!isNodeSkipped(node)) collectFrom(node);
        }
      });
    } else if (m.type === 'characterData') {
      const n = m.target;
      const t = n.nodeValue;
      if (isTranslatable(t) && !isNodeSkipped(n)) {
        originals.set(n, t);
        pending.add(n);
      }
    }
  }
  schedule(lang);
}

function startObserver(lang) {
  if (observer) observer.disconnect();
  observer = new MutationObserver(onMutations.bind(null, lang));
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function initPageTranslator() {
  const lang = lingva.getLang();
  applyAll(lang);
  startObserver(lang);
  window.addEventListener('languageChanged', (e) => {
    const next = e.detail.lang;
    applyAll(next);
    startObserver(next);
  });
}

export default { initPageTranslator };
