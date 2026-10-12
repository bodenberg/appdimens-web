/**
 * Declarative dimensions — pure compiler (no DOM). Used by the runtime scanner
 * (`dom.ts`), the PostCSS plugin and SSR pre-compilation.
 *
 * Class syntax (one declaration per class; `_` stands for a space):
 *   p:16sdp            fs:14ssp          m:8sdp_16sdp        w:120wdpa
 *   p@landscape:24sdp  p@sw600:32sdp     fs@tv:28ssp         p@tv@sw600:48sdp
 *   gap@portrait@h700:12hdp   --card-gap:12sdp   p:16sdp!   (! = !important)
 *
 * Attribute syntax (any number of declarations):
 *   data-dimen="padding: 8sdp 16sdp; font-size: 14ssp; padding@landscape: 12sdp 24sdp"
 *
 * Conditions (Android qualifiers): `landscape` / `portrait`; `sw600` / `w600` / `h600`
 * (≥ dp, `dp` suffix optional); UI modes `tv`, `car`, `watch`, `desk`, `appliance`, `vr`,
 * `normal`, `fold-open`, `fold-closed`, `fold-half`, `flip-open`, `flip-closed`, `flip-half`;
 * `mw` (multi-window). Rules follow the Android `.screen()` priority: mode + qualifier >
 * mode > qualifier (larger threshold wins) > orientation > default.
 */
import { UiModeType } from './enums';
import { dimenCss, hasDimenLiteral } from './tokens';
import { FLAG_SUFFIXES, VARIANTS } from './strategy';

/** Short property names for classes (any CSS property or `--custom` also works). */
export const PROPERTY_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  p: ['padding'], pt: ['padding-top'], pr: ['padding-right'], pb: ['padding-bottom'], pl: ['padding-left'],
  px: ['padding-inline'], py: ['padding-block'], ps: ['padding-inline-start'], pe: ['padding-inline-end'],
  m: ['margin'], mt: ['margin-top'], mr: ['margin-right'], mb: ['margin-bottom'], ml: ['margin-left'],
  mx: ['margin-inline'], my: ['margin-block'], ms: ['margin-inline-start'], me: ['margin-inline-end'],
  w: ['width'], h: ['height'], size: ['width', 'height'],
  minw: ['min-width'], minh: ['min-height'], maxw: ['max-width'], maxh: ['max-height'],
  fs: ['font-size'], lh: ['line-height'], ls: ['letter-spacing'],
  gap: ['gap'], gapx: ['column-gap'], gapy: ['row-gap'],
  r: ['border-radius'], radius: ['border-radius'], bw: ['border-width'], ow: ['outline-width'],
  basis: ['flex-basis'], indent: ['text-indent'],
});

/** UI-mode condition names → UiModeType. */
export const MODE_CONDITIONS: Readonly<Record<string, UiModeType>> = Object.freeze({
  normal: UiModeType.NORMAL,
  tv: UiModeType.TELEVISION,
  television: UiModeType.TELEVISION,
  car: UiModeType.CAR,
  watch: UiModeType.WATCH,
  desk: UiModeType.DESK,
  appliance: UiModeType.APPLIANCE,
  vr: UiModeType.VR_HEADSET,
  undefined: UiModeType.UNDEFINED,
  'fold-open': UiModeType.FOLD_OPEN,
  'fold-closed': UiModeType.FOLD_CLOSED,
  'fold-half': UiModeType.FOLD_HALF_OPENED,
  'flip-open': UiModeType.FLIP_OPEN,
  'flip-closed': UiModeType.FLIP_CLOSED,
  'flip-half': UiModeType.FLIP_HALF_OPENED,
});

/** Value written to `<html data-ad-mode>` for each UI mode (first matching condition name). */
export function modeAttribute(mode: UiModeType): string {
  for (const [name, m] of Object.entries(MODE_CONDITIONS)) if (m === mode) return name;
  return 'normal';
}

export interface Conditions {
  orientation?: 'landscape' | 'portrait';
  /** Each entry: axis (`sw` / `w` / `h`) ≥ value dp. */
  qualifiers: { axis: 'sw' | 'w' | 'h'; value: number }[];
  mode?: string;
  multiWindow?: boolean;
}

/** One compiled CSS rule plus its cascade order key (Android priority). */
export interface DimenRule {
  readonly css: string;
  readonly order: number;
}

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

const QUALIFIER = /^(sw|w|h)(\d+(?:\.\d+)?)(?:dp)?$/;

/** Parses `['landscape', 'sw600', 'tv']`; `null` if any condition is unknown. */
export function parseConditions(parts: readonly string[]): Conditions | null {
  const c: Conditions = { qualifiers: [] };
  for (const raw of parts) {
    const part = raw.trim().toLowerCase();
    if (!part) continue;
    if (part === 'landscape' || part === 'portrait') {
      c.orientation = part;
      continue;
    }
    if (part === 'mw' || part === 'multi-window') {
      c.multiWindow = true;
      continue;
    }
    const q = QUALIFIER.exec(part);
    if (q) {
      c.qualifiers.push({ axis: q[1] as 'sw' | 'w' | 'h', value: parseFloat(q[2]!) });
      continue;
    }
    if (hasOwn(MODE_CONDITIONS, part)) {
      c.mode = modeAttribute(MODE_CONDITIONS[part]!);
      continue;
    }
    return null;
  }
  return c;
}

/** Cascade order: later wins. Mirrors the Android `.screen()` priorities. */
export function orderOf(c: Conditions): number {
  const hasMode = c.mode !== undefined || c.multiWindow === true;
  const hasQualifier = c.qualifiers.length > 0;
  const rank = hasMode && hasQualifier ? 5 : hasMode ? 4 : hasQualifier ? 3 : c.orientation ? 2 : 1;
  const threshold = c.qualifiers.reduce((sum, q) => sum + q.value, 0);
  return rank * 1e7 + Math.min(threshold, 9e6) + (c.orientation ? 0.5 : 0);
}

/** `@media` condition text for orientation / qualifiers (`''` when none). */
export function mediaOf(c: Conditions): string {
  const parts: string[] = [];
  if (c.orientation) parts.push(`(orientation: ${c.orientation})`);
  for (const q of c.qualifiers) {
    if (q.axis !== 'h') parts.push(`(min-width: ${q.value}px)`);
    if (q.axis !== 'w') parts.push(`(min-height: ${q.value}px)`);
  }
  return parts.join(' and ');
}

/** `:root[data-ad-mode="tv"] ` style prefix for UI-mode / multi-window conditions. */
export function rootPrefix(c: Conditions): string {
  let s = '';
  if (c.mode !== undefined) s += `[data-ad-mode="${c.mode}"]`;
  if (c.multiWindow) s += '[data-ad-multi-window]';
  return s ? `:root${s} ` : '';
}

/** `CSS.escape` (with a spec-compliant fallback for SSR / Node where the DOM API is missing). */
export function cssEscape(ident: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(ident);
  let out = '';
  for (let i = 0; i < ident.length; i++) {
    const ch = ident[i]!;
    const code = ch.charCodeAt(0);
    if (code === 0) out += '\uFFFD';
    else if ((code >= 0x30 && code <= 0x39 && (i === 0 || (i === 1 && ident[0] === '-'))) || code < 0x20 || code === 0x7f) {
      out += `\\${code.toString(16)} `;
    } else if (i === 0 && ch === '-' && ident.length === 1) out += '\\-';
    else if (code >= 0x80 || /[a-zA-Z0-9_-]/.test(ch)) out += ch;
    else out += `\\${ch}`;
  }
  return out;
}

const PROPERTY = /^(?:--[a-zA-Z0-9_-]+|-?[a-z][a-z0-9-]*)$/;

function properties(name: string): readonly string[] | null {
  if (hasOwn(PROPERTY_ALIASES, name)) return PROPERTY_ALIASES[name]!;
  return PROPERTY.test(name) ? [name] : null;
}

function rule(selector: string, c: Conditions, props: readonly string[], value: string, important: boolean): DimenRule {
  const body = props.map((p) => `${p}:${value}${important ? ' !important' : ''}`).join(';');
  const media = mediaOf(c);
  const inner = `${rootPrefix(c)}${selector}{${body}}`;
  return { css: media ? `@media ${media}{${inner}}` : inner, order: orderOf(c) };
}

/** `p@landscape:16sdp` → parts, or `null` when the class is not a dimension class. */
const CLASS = /^(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)((?:@[a-zA-Z0-9.-]+)*):(.+?)(!?)$/;

/**
 * Text that could break out of the declaration (CSS injection through class / attribute text):
 * braces, `;`, comments, `<` (`</style>` in pre-compiled SSR CSS) and a backslash that would
 * escape the rule's closing brace. Ordinary escapes such as `"\201C"` stay allowed.
 */
const UNSAFE_VALUE = /[{};<]|\/\*|\\(?:$|[\s{};])/;

/** Compiles one class name. `null` when it is not a dimension class (other frameworks' classes are ignored). */
export function compileDimenClass(className: string): DimenRule | null {
  const m = CLASS.exec(className);
  if (!m) return null;
  const props = properties(m[1]!);
  if (!props) return null;
  const raw = m[3]!.replace(/_/g, ' ');
  if (UNSAFE_VALUE.test(raw) || !hasDimenLiteral(raw)) return null;
  const conditions = parseConditions(m[2] ? m[2].slice(1).split('@') : []);
  if (!conditions) return null;
  let value: string;
  try {
    value = dimenCss(raw);
  } catch (e) {
    warnOnce(className, e);
    return null;
  }
  return rule(`.${cssEscape(className)}`, conditions, props, value, m[4] === '!');
}

const warnedClasses = new Set<string>();
function warnOnce(key: string, e: unknown): void {
  if (warnedClasses.has(key)) return;
  warnedClasses.add(key);
  console.warn(`webdimens: class "${key}" ignored — ${e instanceof Error ? e.message : String(e)}`);
}

/** Escapes text for a double-quoted CSS string (attribute selector). */
function cssString(text: string): string {
  return text.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\a ').replace(/\r/g, '\\d ').replace(/\f/g, '\\c ');
}

/**
 * Compiles a `data-dimen` attribute value. Declarations without dimension literals are
 * emitted as plain CSS. Throws on malformed input so mistakes surface in development.
 */
export function compileDimenAttribute(text: string, selector?: string): DimenRule[] {
  const sel = selector ?? `[data-dimen="${cssString(text)}"]`;
  const rules: DimenRule[] = [];
  for (const declaration of text.split(';')) {
    if (!declaration.trim()) continue;
    const i = declaration.indexOf(':');
    if (i < 0) throw new SyntaxError(`webdimens: missing ":" in data-dimen declaration "${declaration.trim()}"`);
    let key = declaration.slice(0, i).trim();
    let value = declaration.slice(i + 1).trim();
    const important = /!important$|!$/.test(value);
    value = value.replace(/\s*!(important)?$/, '');
    if (!value) throw new SyntaxError(`webdimens: empty value in data-dimen declaration "${declaration.trim()}"`);
    if (UNSAFE_VALUE.test(value)) throw new SyntaxError(`webdimens: unsafe characters in data-dimen value "${value}"`);
    const [name, ...conds] = key.split('@');
    key = name!.trim();
    const props = properties(key);
    if (!props) throw new SyntaxError(`webdimens: unknown property "${key}" in data-dimen`);
    const conditions = parseConditions(conds);
    if (!conditions) throw new SyntaxError(`webdimens: unknown condition in "${declaration.trim()}"`);
    rules.push(rule(sel, conditions, props, dimenCss(value), important));
  }
  return rules;
}

/** Sorts rules into cascade order (Android priority) and joins them. */
export function joinRules(rules: Iterable<DimenRule>): string {
  return [...rules].sort((a, b) => a.order - b.order).map((r) => r.css).join('\n');
}

/**
 * Pre-compiles dimension classes / `data-dimen` values to CSS (SSR, static sites, build tools):
 * `dimenClassesToCss(['p:16sdp', 'fs@tv:28ssp'], ['padding: 8sdp'])`.
 */
export function dimenClassesToCss(classNames: Iterable<string>, attributeValues: Iterable<string> = []): string {
  const rules: DimenRule[] = [];
  for (const cls of new Set(classNames)) {
    const r = compileDimenClass(cls);
    if (r) rules.push(r);
  }
  for (const text of new Set(attributeValues)) rules.push(...compileDimenAttribute(text));
  return joinRules(rules);
}

// ─────────────────────────────────────────────────────────────────────────────
// Modifier classes — switch flags / strategy for a whole subtree by redirecting
// the CSS custom properties (no per-element JavaScript):
//   .ad-a  → aspect ratio     .ad-i → ignore multi-window     .ad-ia → both
//   .ad-power / .ad-fluid / … → unprefixed tokens (--sdp, --ssp…) use that strategy
// ─────────────────────────────────────────────────────────────────────────────

/** Token families without flags: `sdp`, `sdpPh`, …, `ssp`, `sem`, … */
const FAMILIES: readonly string[] = [
  ...VARIANTS.map((v) => `${v.axis}dp${v.token}`),
  ...VARIANTS.filter((v) => v.token === '').flatMap((v) => [`${v.axis}sp`, `${v.axis}em`]),
];

/** CSS for the flag modifier classes (`.ad-a`, `.ad-i`, `.ad-ia`) and the given strategy classes. */
export function modifierCss(strategies: readonly { id: string; prefix: string }[]): string {
  let out = '';
  for (const s of strategies) {
    if (!s.prefix) continue;
    let body = '';
    for (const f of FAMILIES) for (const flag of FLAG_SUFFIXES) body += `--${f}${flag}:var(--${s.prefix}${f}${flag});`;
    out += `.ad-${s.id},:root:root.ad-${s.id}{${body}}\n`;
  }
  let a = '';
  let i = '';
  let ia = '';
  for (const f of FAMILIES) {
    a += `--${f}:var(--${f}a);--${f}i:var(--${f}ia);`;
    i += `--${f}:var(--${f}i);--${f}a:var(--${f}ia);`;
    ia += `--${f}:var(--${f}ia);--${f}a:var(--${f}ia);--${f}i:var(--${f}ia);`;
  }
  // `:root:root.ad-x` beats the runtime's `:root:root{…}` token sheet when the class is on <html>.
  return `${out}.ad-a,:root:root.ad-a{${a}}\n.ad-i,:root:root.ad-i{${i}}\n.ad-ia,:root:root.ad-ia{${ia}}\n`;
}
