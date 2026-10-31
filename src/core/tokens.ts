/**
 * Unit tokens as strings — write `"16sdp"`, `"14sspa"`, `"8hdpLw"`, `"10pwsdp"` instead of px.
 *
 *   dimen('16sdp')                         // → 19.2 (CSS px for the current window)
 *   dimenCss('8sdp 16sdp')                 // → "calc(8 * var(--sdp)) calc(16 * var(--sdp))"
 *   dimens({ padding: '8sdp 16sdp', fontSize: '14ssp' })   // style object, responsive CSS
 *   dimensPx({ width: '120wdp', fontSize: '14ssp' })       // style object, numbers (px)
 *
 * Token grammar (same as the Android names): `<prefix><s|h|w><dp|sp|em><Ph|Lh|Pw|Lw>?<a|i|ia>?<Px>?`.
 */
import { DpQualifier } from './enums';
import { ensurePrefix } from './defs';
import { S, sync } from './runtime';
import { VARIANTS } from './strategy';

/** Strategy name prefixes (Android prefix map) → strategy id / module. */
export const STRATEGY_PREFIXES: Readonly<Record<string, string>> = Object.freeze({
  '': 'scaled',
  p: 'percent',
  pw: 'power',
  f: 'fluid',
  a: 'auto',
  dg: 'diagonal',
  fl: 'fill',
  ft: 'fit',
  i: 'interpolated',
  log: 'logarithmic',
  pr: 'perimeter',
  d: 'density',
});

const PREFIXES_LONGEST_FIRST = Object.keys(STRATEGY_PREFIXES).sort((a, b) => b.length - a.length);
const TAIL = /^([shw])(dp|sp|em)(Ph|Lh|Pw|Lw)?(ia|a|i)?(Px)?$/;
const INVERTERS: Record<string, string> = { s: 'PhLhPwLw', h: 'LwPw', w: 'LhPh' };

export interface ParsedToken {
  /** Full token name, e.g. `pwhdpLwa`. */
  readonly name: string;
  readonly prefix: string;
  /** Strategy id (`scaled`, `power`, …). */
  readonly strategy: string;
  readonly axis: 's' | 'h' | 'w';
  readonly kind: 'dp' | 'sp' | 'em';
  readonly inverter: '' | 'Ph' | 'Lh' | 'Pw' | 'Lw';
  readonly flags: '' | 'a' | 'i' | 'ia';
  /** Device-pixel variant (JS only). */
  readonly px: boolean;
  /** Slot in the strategy factor table. */
  readonly slot: number;
  /** Published as a CSS custom property (`var(--name)`). */
  readonly css: boolean;
}

const parsed = new Map<string, ParsedToken | null>();

/** Parses a token name (`sdpa`, `pwhspPx`, …). Returns `null` when it is not a dimension token. */
export function parseToken(name: string): ParsedToken | null {
  let hit = parsed.get(name);
  if (hit !== undefined) return hit;
  hit = null;
  for (const prefix of PREFIXES_LONGEST_FIRST) {
    if (!name.startsWith(prefix)) continue;
    const m = TAIL.exec(name.slice(prefix.length));
    if (!m) continue;
    const axis = m[1] as 's' | 'h' | 'w';
    const inverter = (m[3] ?? '') as ParsedToken['inverter'];
    if (inverter && !INVERTERS[axis]!.includes(inverter)) continue;
    const kind = m[2] as ParsedToken['kind'];
    const flags = (m[4] ?? '') as ParsedToken['flags'];
    const px = m[5] === 'Px';
    const v = VARIANTS.findIndex((x) => x.axis === axis && x.token === inverter);
    const slot = v * 4 + (flags === 'a' ? 1 : flags === 'i' ? 2 : flags === 'ia' ? 3 : 0);
    hit = Object.freeze({
      name,
      prefix,
      strategy: STRATEGY_PREFIXES[prefix]!,
      axis,
      kind,
      inverter,
      flags,
      px,
      slot,
      css: !px && (kind === 'dp' || inverter === ''),
    });
    break;
  }
  parsed.set(name, hit);
  return hit;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom strategy literals: `16cdp` / `14csp` (default strategy) and `16cdp-brand` / `14csp-brand`.
// CSS compilation is pure string work; JS resolution needs `webdimens/custom`, which installs
// the resolver on import (keeps the core free of the custom engine).
// ─────────────────────────────────────────────────────────────────────────────

type CustomResolver = (value: number, kind: 'dp' | 'sp', id: string | null) => number;
let customResolver: CustomResolver | null = null;
let customCssHook: (() => void) | null = null;

/** Installed by `webdimens/custom`. @internal */
export function setCustomLiteralResolver(resolver: CustomResolver | null, onCss: (() => void) | null = null): void {
  customResolver = resolver;
  customCssHook = onCss;
}

const CUSTOM_VALUE = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(cdp|csp)(?:-([A-Za-z0-9_-]+))?$/;

/** `16cdp-brand` → `{ value: 16, kind: 'dp', id: 'brand' }`; `14csp` → default strategy (`id: null`). */
export function parseCustomLiteral(literal: string): { value: number; kind: 'dp' | 'sp'; id: string | null } | null {
  const m = CUSTOM_VALUE.exec(literal.trim());
  if (!m) return null;
  return { value: parseFloat(m[1]!), kind: m[2] === 'csp' ? 'sp' : 'dp', id: m[3] ?? null };
}

function customToCss(c: { value: number; kind: 'dp' | 'sp'; id: string | null }): string {
  customCssHook?.();
  const name = `--c${c.kind}${c.id ? `-${c.id}` : ''}`;
  return `calc(${c.value} * var(${name}))`;
}

function resolveCustom(c: { value: number; kind: 'dp' | 'sp'; id: string | null }, literal: string): number {
  if (!customResolver) {
    throw new TypeError(`webdimens: "${literal}" is a custom-strategy literal; import 'webdimens/custom' (and define the strategy) first.`);
  }
  return customResolver(c.value, c.kind, c.id);
}

const isLiteral = (lit: string): boolean => parseDimenLiteral(lit) !== null || parseCustomLiteral(lit) !== null;

/** `16sdp`, `-0.5hdpLwa`, `.75ssp` → [number, token]. */
const VALUE = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-zA-Z]+)$/;

/** Splits `"16sdp"` into `{ value: 16, token }`, or `null` when it is not a dimension literal. */
export function parseDimenLiteral(literal: string): { value: number; token: ParsedToken } | null {
  const m = VALUE.exec(literal.trim());
  if (!m) return null;
  const token = parseToken(m[2]!);
  return token ? { value: parseFloat(m[1]!), token } : null;
}

function resolveToken(value: number, t: ParsedToken): number {
  // Every strategy is known to the core: its table is registered on first use.
  const table = ensurePrefix(t.prefix)!;
  if (S.dirty) sync();
  let out = value * table[t.slot]!;
  if (t.kind === 'sp') out *= S.fs;
  return t.px ? out * S.dpr : out;
}

/**
 * Resolves one literal to a number of CSS px (device px for `…Px` tokens):
 * `dimen('16sdp')`, `dimen('14sspa')`, `dimen('2sdpPx')`. Numbers and `"12px"` pass through.
 */
export function dimen(input: string | number): number {
  if (typeof input === 'number') return input;
  const lit = parseDimenLiteral(input);
  if (lit) return resolveToken(lit.value, lit.token);
  const custom = parseCustomLiteral(input);
  if (custom) return resolveCustom(custom, input);
  const n = parseFloat(input);
  if (Number.isFinite(n) && /^\s*-?[\d.]+(px)?\s*$/.test(input)) return n;
  throw new TypeError(`webdimens: cannot resolve "${input}" (expected e.g. "16sdp", "14ssp", "12px")`);
}

/** CSS expression for one literal: `16sdp` → `calc(16 * var(--sdp))`; non-tokens are returned unchanged. */
export function literalToCss(literal: string): string {
  const custom = parseCustomLiteral(literal);
  if (custom) return customToCss(custom);
  const lit = parseDimenLiteral(literal);
  if (!lit) return literal;
  if (!lit.token.css) {
    throw new TypeError(
      `webdimens: "${lit.token.name}" has no CSS token (Px and sp/em inverter variants are JS-only); use a dp token or dimen().`,
    );
  }
  ensurePrefix(lit.token.prefix); // publishes var(--<token>) for this strategy
  return `calc(${lit.value} * var(--${lit.token.name}))`;
}

const LITERAL = String.raw`(-?(?:\d+(?:\.\d*)?|\.\d+)[a-zA-Z]+(?:-[A-Za-z0-9_-]+)?)`;
/** Literal boundaries inside a value: start, whitespace, `,` `(` `)` `/` `*`. */
const VALUE_LITERAL = new RegExp(String.raw`(^|[\s,(/*])${LITERAL}(?=$|[\s,)/*])`, 'g');
/** Inside stylesheet text a literal may also follow `:` and precede `;` `!` `}`. */
const TEXT_LITERAL = new RegExp(String.raw`(^|[\s,(/*:])${LITERAL}(?=$|[\s,)/*;!}])`, 'g');
/** `url(...)` and quoted strings are never rewritten (file names like `16sdp.png`). */
const OPAQUE = /(url\([^)]*\)|"[^"]*"|'[^']*')/i;

function mapLiterals(text: string, pattern: RegExp, map: (literal: string) => string | null): string {
  const parts = text.split(OPAQUE);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i]!.replace(pattern, (all, lead: string, lit: string) => {
      const out = map(lit);
      return out === null ? all : lead + out;
    });
  }
  return parts.join('');
}

/** Replaces every dimension literal in a CSS value: `"8sdp 16sdp"` → two `calc()` terms. Throws on JS-only tokens. */
export function dimenCss(value: string): string {
  return mapLiterals(value, VALUE_LITERAL, (lit) => (isLiteral(lit) ? literalToCss(lit) : null));
}

/** `true` when the string contains at least one dimension literal (never throws). */
export function hasDimenLiteral(value: string): boolean {
  let found = false;
  mapLiterals(value, VALUE_LITERAL, (lit) => {
    if (isLiteral(lit)) found = true;
    return null;
  });
  return found;
}

type StyleInput = Record<string, string | number | null | undefined>;

/**
 * Style object with dimension literals compiled to responsive CSS (`calc(… var(--sdp))`):
 * no re-render needed when the viewport changes, SSR-safe.
 * `<div style={dimens({ padding: '8sdp 16sdp', fontSize: '14ssp' })} />`
 */
export function dimens<T extends StyleInput>(style: T): { [K in keyof T]: T[K] extends string ? string : T[K] } {
  const out: StyleInput = {};
  for (const key in style) {
    const v = style[key];
    out[key] = typeof v === 'string' ? dimenCss(v) : v;
  }
  return out as { [K in keyof T]: T[K] extends string ? string : T[K] };
}

/**
 * Style object resolved to px for the current snapshot (single literals become numbers,
 * multi-value strings become `"12.8px 25.6px"`). Re-render on change (e.g. `useDimens()`).
 */
export function dimensPx<T extends StyleInput>(style: T): { [K in keyof T]: string | number } {
  const out: Record<string, string | number> = {};
  for (const key in style) {
    const v = style[key];
    if (typeof v !== 'string') {
      if (v != null) out[key] = v;
      continue;
    }
    const single = parseDimenLiteral(v);
    if (single) {
      out[key] = resolveToken(single.value, single.token);
      continue;
    }
    const singleCustom = parseCustomLiteral(v);
    if (singleCustom) {
      out[key] = resolveCustom(singleCustom, v);
      continue;
    }
    out[key] = mapLiterals(v, VALUE_LITERAL, (lit) => {
      const p = parseDimenLiteral(lit);
      if (p) return `${Math.round(resolveToken(p.value, p.token) * 1e4) / 1e4}px`;
      const c = parseCustomLiteral(lit);
      return c ? `${Math.round(resolveCustom(c, lit) * 1e4) / 1e4}px` : null;
    });
  }
  return out as { [K in keyof T]: string | number };
}

/** Axis qualifier of a parsed token (for generic resolvers). */
export function tokenQualifier(t: ParsedToken): DpQualifier {
  return t.axis === 'h' ? DpQualifier.HEIGHT : t.axis === 'w' ? DpQualifier.WIDTH : DpQualifier.SMALL_WIDTH;
}

/**
 * Compiles every dimension literal in a whole stylesheet text
 * (`.card{padding:8sdp 16sdp}` → `calc()` terms). Used for `<style data-webdimens>` blocks.
 */
export function compileCssText(css: string): string {
  return mapLiterals(css, TEXT_LITERAL, (lit) => {
    const c = parseCustomLiteral(lit);
    if (c) return customToCss(c);
    const p = parseDimenLiteral(lit);
    if (!p) return null;
    if (!p.token.css) {
      console.warn(`webdimens: "${p.token.name}" is JS-only and was left unchanged in <style data-webdimens>.`);
      return null;
    }
    return literalToCss(lit);
  });
}
