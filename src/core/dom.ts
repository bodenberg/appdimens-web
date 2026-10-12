/**
 * Declarative runtime: finds dimension classes (`p:16sdp`, `fs@tv:28ssp`) and `data-dimen`
 * attributes, compiles each unique string ONCE into a stylesheet, and keeps `<html>`
 * condition attributes in sync. Resizing never touches these rules — they reference the
 * CSS custom properties the runtime already updates — so the per-resize cost is zero.
 */
import {
  compileDimenAttribute,
  compileDimenClass,
  joinRules,
  modeAttribute,
  modifierCss,
  type DimenRule,
} from './declarative';
import type { DimenMetrics } from './metrics';
import { getMetrics, onRegister, registeredStrategies, subscribe } from './runtime';
import { compileCssText } from './tokens';

const SHEET_ID = 'webdimens-declarative';
const seenClasses = new Set<string>();
const seenAttributes = new Set<string>();
const rules: DimenRule[] = [];
let observer: MutationObserver | null = null;
let offMetrics: (() => void) | null = null;
let offRegister: (() => void) | null = null;
let sheet: CSSStyleSheet | null = null;
let styleEl: HTMLStyleElement | null = null;
let frame = 0;
let dirty = false;
let nonce: string | undefined;
let pending: Element[] = [];
/** Elements whose class / data-dimen changed: only the element itself needs a look. */
let changed: Element[] = [];

const hasDom = (): boolean => typeof document !== 'undefined' && typeof window !== 'undefined';

/** Marks `<html>` with the current UI mode / orientation / multi-window state. */
function syncRootAttributes(m: DimenMetrics): void {
  const root = document.documentElement;
  const mode = modeAttribute(m.uiModeType);
  if (root.getAttribute('data-ad-mode') !== mode) root.setAttribute('data-ad-mode', mode);
  const orientation = m.isLandscape ? 'landscape' : 'portrait';
  if (root.getAttribute('data-ad-orientation') !== orientation) root.setAttribute('data-ad-orientation', orientation);
  root.toggleAttribute('data-ad-multi-window', m.isInMultiWindowMode);
}

function visit(el: Element): void {
  const list = el.classList;
  for (let i = 0; i < list.length; i++) {
    const cls = list[i]!;
    // Fast reject: dimension classes always contain ':' — skip everything else without parsing.
    if (cls.indexOf(':') < 0 || seenClasses.has(cls)) continue;
    seenClasses.add(cls);
    let r: DimenRule | null = null;
    try {
      r = compileDimenClass(cls);
    } catch (e) {
      console.error(e); // one bad class must never stop the rest of the scan
    }
    if (r) {
      rules.push(r);
      dirty = true;
    }
  }
  const attr = el.getAttribute('data-dimen');
  if (attr !== null && !seenAttributes.has(attr)) {
    seenAttributes.add(attr);
    try {
      rules.push(...compileDimenAttribute(attr));
      dirty = true;
    } catch (e) {
      console.error(e);
    }
  }
}

const compiledStyles = new WeakSet<Element>();
const styleObservers = new Set<MutationObserver>();

function recompile(el: Element): void {
  const text = el.textContent ?? '';
  const next = compileCssText(text);
  if (next !== text) el.textContent = next; // idempotent: the rewrite contains no literals
}

/**
 * `<style data-webdimens>` blocks: units compiled in place, and again whenever a framework
 * edits the block (own small observer, so the document observer never watches text nodes).
 */
function compileStyle(el: Element): void {
  if (compiledStyles.has(el)) return;
  compiledStyles.add(el);
  recompile(el);
  if (typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(() => recompile(el));
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    styleObservers.add(mo);
  }
}

function scan(root: ParentNode): void {
  if (root instanceof Element) {
    visit(root);
    if (root.tagName === 'STYLE' && root.hasAttribute('data-webdimens')) compileStyle(root);
  }
  const styles = root.querySelectorAll('style[data-webdimens]');
  for (let i = 0; i < styles.length; i++) compileStyle(styles[i]!);
  const nodes = root.querySelectorAll('[class*=":"],[data-dimen]');
  for (let i = 0; i < nodes.length; i++) visit(nodes[i]!);
}

function process(): void {
  frame = 0;
  const added = pending;
  const touched = changed;
  pending = [];
  changed = [];
  for (const el of added) if (el.isConnected) scan(el);
  for (const el of touched) visit(el);
  write();
}

function schedule(): void {
  if (frame) return;
  frame = (window.requestAnimationFrame ?? ((cb: () => void) => window.setTimeout(cb, 16)))(process) as unknown as number;
}

function write(): void {
  if (!dirty) return;
  dirty = false;
  const text = `${modifierCss(registeredStrategies())}${joinRules(rules)}`;
  const doc = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] };
  if (!styleEl && typeof CSSStyleSheet !== 'undefined' && Array.isArray(doc.adoptedStyleSheets)) {
    try {
      if (!sheet) {
        sheet = new CSSStyleSheet();
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
      }
      sheet.replaceSync(text);
      return;
    } catch {
      sheet = null;
    }
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = SHEET_ID;
    if (nonce) styleEl.nonce = nonce;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = text;
}

/**
 * Starts the declarative runtime (called by `install()` unless `declarative: false`).
 * Idempotent. Returns a function that stops it.
 */
export function startDeclarative(options: { cssNonce?: string } = {}): () => void {
  if (!hasDom()) return stopDeclarative;
  nonce = options.cssNonce;
  if (observer) return stopDeclarative;
  syncRootAttributes(getMetrics());
  offMetrics = subscribe(syncRootAttributes);
  offRegister = onRegister(() => {
    dirty = true;
    schedule();
  });
  dirty = true;
  scan(document.documentElement);
  write();
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') {
          changed.push(r.target as Element);
        } else {
          r.addedNodes.forEach((n) => {
            if (n.nodeType === 1) pending.push(n as Element);
          });
        }
      }
      if (pending.length || changed.length) schedule();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'data-dimen'],
    });
  }
  return stopDeclarative;
}

/** Synchronously compiles anything added since the last frame (tests, before measuring layout). */
export function flushDeclarative(): void {
  if (!hasDom() || !observer) return;
  const records = observer.takeRecords();
  for (const r of records) {
    if (r.type === 'attributes') changed.push(r.target as Element);
    else r.addedNodes.forEach((n) => n.nodeType === 1 && pending.push(n as Element));
  }
  if (frame) (window.cancelAnimationFrame ?? clearTimeout)(frame);
  process();
}

/** Stops observing and removes the generated stylesheet and root attributes. */
export function stopDeclarative(): void {
  observer?.disconnect();
  observer = null;
  styleObservers.forEach((mo) => mo.disconnect());
  styleObservers.clear();
  offMetrics?.();
  offMetrics = null;
  offRegister?.();
  offRegister = null;
  if (!hasDom()) return;
  if (frame) (window.cancelAnimationFrame ?? clearTimeout)(frame);
  frame = 0;
  pending = [];
  changed = [];
  seenClasses.clear();
  seenAttributes.clear();
  rules.length = 0;
  const doc = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] };
  if (sheet && doc.adoptedStyleSheets) doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
  sheet = null;
  styleEl?.remove();
  styleEl = null;
  const root = document.documentElement;
  root.removeAttribute('data-ad-mode');
  root.removeAttribute('data-ad-orientation');
  root.removeAttribute('data-ad-multi-window');
}
