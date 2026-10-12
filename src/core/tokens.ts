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
import { S, sync, tableForPrefix } from './runtime';
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
  const table = tableForPrefix(t.prefix);
  if (!table) {
    throw new Error(
      `webdimens: "${t.name}" needs the ${t.strategy} strategy — import 'webdimens/${t.strategy}' (or any of its functions) first.`,
    );
  }
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
  const n = parseFloat(input);
  if (Number.isFinite(n) && /^\s*-?[\d.]+(px)?\s*$/.test(input)) return n;
  throw new TypeError(`webdimens: cannot resolve "${input}" (expected e.g. "16sdp", "14ssp", "12px")`);
}

/** CSS expression for one literal: `16sdp` → `calc(16 * var(--sdp))`; non-tokens are returned unchanged. */
export function literalToCss(literal: string): string {
  const lit = parseDimenLiteral(literal);
  if (!lit) return literal;
  if (!lit.token.css) {
    throw new TypeError(
      `webdimens: "${lit.token.name}" has no CSS token (Px and sp/em inverter variants are JS-only); use a dp token or dimen().`,
    );
  }
  return `calc(${lit.value} * var(--${lit.token.name}))`;
}

/** Replaces every dimension literal in a CSS value: `"8sdp 16sdp"` → two `calc()` terms. */
export function dimenCss(value: string): string {
  return value.replace(/(^|[\s,(/])(-?(?:\d+(?:\.\d*)?|\.\d+)[a-zA-Z]+)(?=$|[\s,)/])/g, (all, lead: string, lit: string) =>
    parseDimenLiteral(lit) ? lead + literalToCss(lit) : all,
  );
}

/** `true` when the string contains at least one dimension literal. */
export function hasDimenLiteral(value: string): boolean {
  return dimenCss(value) !== value;
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
    out[key] = v.replace(/(^|[\s,(/])(-?(?:\d+(?:\.\d*)?|\.\d+)[a-zA-Z]+)(?=$|[\s,)/])/g, (all, lead: string, lit: string) => {
      const p = parseDimenLiteral(lit);
      return p ? `${lead}${Math.round(resolveToken(p.value, p.token) * 1e4) / 1e4}px` : all;
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
  return css.replace(/(^|[\s,(/:])(-?(?:\d+(?:\.\d*)?|\.\d+)[a-zA-Z]+)(?=$|[\s,)/;!}])/g, (all, lead: string, lit: string) => {
    const p = parseDimenLiteral(lit);
    return p && p.token.css ? lead + literalToCss(lit) : all;
  });
}
