/**
 * Custom scaling strategies — platform-free engine (port of Android `library-custom`).
 *
 * A strategy is a plain configuration object (the same JSON shape on every AppDimens
 * platform, see `custom-strategy.schema.json`) that turns a window into one factor:
 *
 *   ratio  = axis(window) / axis(reference)
 *   factor = clamp(curve(ratio) × multiplier × AR, minFactor, maxFactor)
 *   dp     = formula(clampValue(base × factor, minValue, maxValue))
 *
 * Nothing here touches the DOM, so the module also runs in workers / SSR / React Native.
 */

/** Screen measure a strategy scales against. */
import { CURVE_VARIABLES, FORMULA_VARIABLES, ScalingExpression, expressionVariables } from './expression';

export type ScalingAxis = 'smallestWidth' | 'width' | 'height' | 'min' | 'max' | 'diagonal' | 'perimeter';

/** Device family matched by rules. */
export type DeviceClass = 'phone' | 'tablet' | 'desktop' | 'tv' | 'watch' | 'car' | 'vr';

export const SCALING_AXES: readonly ScalingAxis[] = Object.freeze([
  'smallestWidth', 'width', 'height', 'min', 'max', 'diagonal', 'perimeter',
]);
export const DEVICE_CLASSES: readonly DeviceClass[] = Object.freeze([
  'phone', 'tablet', 'desktop', 'tv', 'watch', 'car', 'vr',
]);

/** `sw` (dp) from which a normal window counts as a tablet. */
export const TABLET_MIN_SMALLEST_WIDTH_DP = 600;
/** Default aspect-ratio sensitivity — same constant as the built-in strategies (0.08 / 30). */
export const CUSTOM_SENSITIVITY_DEFAULT = 0.08 / 30;
const REFERENCE_ASPECT_RATIO = 1.78;
export const CUSTOM_FORMAT_VERSION = 1;

/** Immutable, platform-free description of the window a value is resolved for. */
export interface ScreenSnapshot {
  readonly widthDp: number;
  readonly heightDp: number;
  readonly smallestWidthDp: number;
  readonly density: number;
  readonly fontScale: number;
  readonly isLandscape: boolean;
  readonly isMultiWindow: boolean;
  readonly device: DeviceClass;
}

/** Builds a snapshot, filling the same defaults as the Kotlin reference. */
export function screenSnapshot(init: {
  widthDp: number;
  heightDp: number;
  smallestWidthDp?: number;
  density?: number;
  fontScale?: number;
  isLandscape?: boolean;
  isMultiWindow?: boolean;
  device?: DeviceClass;
}): ScreenSnapshot {
  const sw = init.smallestWidthDp ?? Math.min(init.widthDp, init.heightDp);
  return Object.freeze({
    widthDp: init.widthDp,
    heightDp: init.heightDp,
    smallestWidthDp: sw,
    density: init.density ?? 1,
    fontScale: init.fontScale ?? 1,
    isLandscape: init.isLandscape ?? init.widthDp > init.heightDp,
    isMultiWindow: init.isMultiWindow ?? false,
    device: init.device ?? (sw >= TABLET_MIN_SMALLEST_WIDTH_DP ? 'tablet' : 'phone'),
  });
}

/** Pure user formula `(ratio, screen) → factor`; runs once per window snapshot. */
export type CurveFunction = (ratio: number, screen: ScreenSnapshot) => number;
/** Pure per-value hook `(base, scaled, screen) → dp`, applied after the value bounds. */
export type ValueTransform = (base: number, scaled: number, screen: ScreenSnapshot) => number;

/**
 * What a code formula can read, with the **same names as the text formulas**, so the editor
 * autocompletes them and typos are type errors. Values are dp (CSS px on the web); flags are
 * booleans. Every member is a plain property, so destructuring works:
 * `({ base, sw, pow }) => base * pow(sw / 360, 0.8)`.
 */
export interface ScreenScope {
  /** The full window snapshot. */
  readonly screen: ScreenSnapshot;
  /** Smallest width. */
  readonly sw: number;
  readonly width: number;
  readonly height: number;
  readonly shortSide: number;
  readonly longSide: number;
  /** `sqrt(shortSide² + longSide²)`. */
  readonly diagonal: number;
  /** `shortSide + longSide`. */
  readonly perimeter: number;
  /** `longSide / shortSide`. */
  readonly aspectRatio: number;
  readonly density: number;
  readonly fontScale: number;
  /** `sw / 300` — the ratio `sdp` uses (`base * ratio` = `sdp`). */
  readonly ratio: number;
  readonly device: DeviceClass;
  readonly landscape: boolean;
  readonly portrait: boolean;
  readonly multiWindow: boolean;
  readonly phone: boolean;
  readonly tablet: boolean;
  readonly desktop: boolean;
  readonly tv: boolean;
  readonly watch: boolean;
  readonly car: boolean;
  readonly vr: boolean;
  readonly pow: (x: number, exponent: number) => number;
  readonly sqrt: (x: number) => number;
  /** Natural logarithm. */
  readonly ln: (x: number) => number;
  readonly log10: (x: number) => number;
  readonly exp: (x: number) => number;
  readonly abs: (x: number) => number;
  /** Half up: `floor(x + 0.5)`, like the text language. */
  readonly round: (x: number) => number;
  readonly min: (...values: number[]) => number;
  readonly max: (...values: number[]) => number;
  readonly clamp: (x: number, min: number, max: number) => number;
  readonly lerp: (a: number, b: number, t: number) => number;
  readonly smoothstep: (edge0: number, edge1: number, x: number) => number;
}

/** {@link ScreenScope} plus `base`, the value being scaled (the `16` in `cdp(16, hud)`). */
export interface FormulaScope extends ScreenScope {
  readonly base: number;
}

const SCOPE_MATH = Object.freeze({
  pow: Math.pow,
  sqrt: Math.sqrt,
  ln: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  abs: Math.abs,
  round: (x: number): number => Math.floor(x + 0.5),
  min: Math.min,
  max: Math.max,
  clamp: (x: number, min: number, max: number): number => Math.max(min, Math.min(max, x)),
  lerp: (a: number, b: number, t: number): number => a + (b - a) * t,
  smoothstep: (edge0: number, edge1: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  },
});

const scopes = new WeakMap<ScreenSnapshot, ScreenScope>();

/** The (memoized, frozen) scope code formulas read for `screen`. */
export function screenScope(screen: ScreenSnapshot): ScreenScope {
  let s = scopes.get(screen);
  if (!s) {
    const short = Math.min(screen.widthDp, screen.heightDp);
    const long = Math.max(screen.widthDp, screen.heightDp);
    const d = screen.device;
    s = Object.freeze({
      screen,
      sw: screen.smallestWidthDp,
      width: screen.widthDp,
      height: screen.heightDp,
      shortSide: short,
      longSide: long,
      diagonal: Math.sqrt(short * short + long * long),
      perimeter: short + long,
      aspectRatio: short > 0 ? long / short : 1,
      density: screen.density,
      fontScale: screen.fontScale,
      ratio: screen.smallestWidthDp / 300, // default reference smallest side, as in `sdp`
      device: d,
      landscape: screen.isLandscape,
      portrait: !screen.isLandscape,
      multiWindow: screen.isMultiWindow,
      phone: d === 'phone',
      tablet: d === 'tablet',
      desktop: d === 'desktop',
      tv: d === 'tv',
      watch: d === 'watch',
      car: d === 'car',
      vr: d === 'vr',
      ...SCOPE_MATH,
    });
    scopes.set(screen, s);
  }
  return s;
}

/** {@link screenScope} plus `base` (the screen part is shared per window, only `base` is new). */
export function formulaScope(screen: ScreenSnapshot, base: number): FormulaScope {
  return Object.create(screenScope(screen), { base: { value: base, enumerable: true } }) as FormulaScope;
}

export type CurveSpec =
  | 'linear' | 'power' | 'logarithmic' | 'interpolated' | 'constant'
  | { type: 'linear' }
  | { type: 'power'; exponent?: number }
  | { type: 'logarithmic'; k?: number }
  | { type: 'interpolated'; t?: number }
  | { type: 'constant'; factor?: number }
  | { type: 'breakpoints'; points: ReadonlyArray<{ at: number; factor: number }> }
  /** Free-form formula as text (JSON-serializable) — see `expression.ts`. */
  | { type: 'expression'; expression: string }
  | { type: 'custom'; fn: CurveFunction };

export interface RangeSpec {
  min?: number;
  max?: number;
}

export type FontScaleSpec = 'follow' | 'ignore' | { max: number };

/** Fields shared by a strategy and a rule's `set`. Omitted fields keep the current value. */
export interface ScalingPatchSpec {
  reference?: { width?: number; height?: number };
  axis?: ScalingAxis;
  curve?: CurveSpec;
  multiplier?: number;
  /** Bounds for the **factor**. `null` (root only) clears inherited bounds. */
  clamp?: RangeSpec | null;
  /** Bounds for the resulting dp (magnitude). `null` (root only) clears inherited bounds. */
  valueClamp?: RangeSpec | null;
  aspectRatio?: boolean | { enabled?: boolean; sensitivity?: number };
  sensitivity?: number;
  fontScale?: FontScaleSpec;
  ignoreMultiWindow?: boolean;
  /** Code-only per-value hook (not JSON). */
  transform?: ValueTransform;
  /**
   * Per-value formula as text (JSON-serializable), e.g. `"max(scaled, base)"` or
   * `"base * pow(sw / 360, 0.7) + 2"`. `null` (root only) clears an inherited formula.
   */
  formula?: string | null;
}

/** `min <= value < max` ranges; every field set must match. */
export interface ScreenConditionSpec {
  device?: DeviceClass | readonly DeviceClass[];
  orientation?: 'portrait' | 'landscape';
  smallestWidth?: RangeSpec;
  width?: RangeSpec;
  height?: RangeSpec;
  aspectRatio?: RangeSpec;
  multiWindow?: boolean;
}

export interface ScalingRuleSpec {
  name?: string;
  when?: ScreenConditionSpec;
  set: ScalingPatchSpec;
}

/** One strategy as written in code or JSON. */
export interface ScalingStrategySpec extends ScalingPatchSpec {
  id: string;
  /** Another strategy of the same document, a registered strategy, a built-in or a preset. */
  extends?: string;
  rules?: readonly ScalingRuleSpec[];
}

export interface ScalingStrategiesDocument {
  $schema?: string;
  version?: number;
  default?: string;
  strategies: readonly ScalingStrategySpec[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalized (validated) model
// ─────────────────────────────────────────────────────────────────────────────

export type Curve =
  | { readonly type: 'linear' }
  | { readonly type: 'power'; readonly exponent: number }
  | { readonly type: 'logarithmic'; readonly k: number }
  | { readonly type: 'interpolated'; readonly t: number }
  | { readonly type: 'constant'; readonly factor: number }
  | { readonly type: 'breakpoints'; readonly points: ReadonlyArray<{ readonly at: number; readonly factor: number }> }
  | { readonly type: 'expression'; readonly expression: ScalingExpression }
  | { readonly type: 'custom'; readonly fn: CurveFunction };

export type FontScalePolicy = { readonly type: 'follow' } | { readonly type: 'ignore' } | { readonly type: 'clamp'; readonly max: number };

export interface ScalingPatch {
  readonly reference?: { readonly width: number; readonly height: number };
  readonly axis?: ScalingAxis;
  readonly curve?: Curve;
  readonly multiplier?: number;
  readonly minFactor?: number;
  readonly maxFactor?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly aspectRatio?: boolean;
  readonly sensitivity?: number;
  readonly fontScale?: FontScalePolicy;
  readonly ignoreMultiWindow?: boolean;
  readonly transform?: ValueTransform;
  readonly formula?: ScalingExpression;
}

export interface ScreenCondition {
  readonly devices?: ReadonlySet<DeviceClass>;
  readonly orientation?: 'portrait' | 'landscape';
  readonly minSmallestWidth?: number;
  readonly maxSmallestWidth?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly minHeight?: number;
  readonly maxHeight?: number;
  readonly minAspectRatio?: number;
  readonly maxAspectRatio?: number;
  readonly multiWindow?: boolean;
}

export interface ScalingRule {
  readonly condition: ScreenCondition;
  readonly patch: ScalingPatch;
  readonly name?: string;
}

export interface ScalingConfig {
  readonly reference: { readonly width: number; readonly height: number };
  readonly axis: ScalingAxis;
  readonly curve: Curve;
  readonly multiplier: number;
  readonly minFactor?: number;
  readonly maxFactor?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly aspectRatio: boolean;
  readonly sensitivity?: number;
  readonly fontScale: FontScalePolicy;
  readonly ignoreMultiWindow: boolean;
  readonly transform?: ValueTransform;
  /** Per-value text formula; takes the place of `transform`. */
  readonly formula?: ScalingExpression;
  readonly rules: readonly ScalingRule[];
}

export const DEFAULT_CONFIG: ScalingConfig = Object.freeze({
  reference: Object.freeze({ width: 300, height: 533 }),
  axis: 'smallestWidth',
  curve: Object.freeze({ type: 'linear' }),
  multiplier: 1,
  aspectRatio: false,
  fontScale: Object.freeze({ type: 'follow' }),
  ignoreMultiWindow: false,
  rules: Object.freeze([]) as readonly ScalingRule[],
}) as ScalingConfig;

/** Applies `patch` (omitted fields keep their value). */
export function applyPatch(config: ScalingConfig, patch: ScalingPatch): ScalingConfig {
  const out: { -readonly [K in keyof ScalingConfig]: ScalingConfig[K] } = { ...config };
  for (const key of Object.keys(patch) as (keyof ScalingPatch)[]) {
    const v = patch[key];
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  // A formula and a code transform are alternatives: setting one replaces the other.
  if (patch.formula !== undefined) delete out.transform;
  else if (patch.transform !== undefined) delete out.formula;
  return out;
}

/** True when the formula is `base × (screen-only E)`: a pure screen factor, no per-value work. */
export function isProportionalFormula(formula: ScalingExpression | undefined): boolean {
  return formula !== undefined && formula.baseCoefficient !== null;
}

/**
 * True when some path depends on the value itself (bounds / transform / formula). A proportional
 * formula (`base * E`, see {@link isProportionalFormula}) is screen-only, so it does not count.
 */
export function isValueDependent(config: ScalingConfig): boolean {
  const dependent = (p: ScalingPatch): boolean =>
    p.minValue !== undefined || p.maxValue !== undefined || p.transform !== undefined ||
    (p.formula !== undefined && !isProportionalFormula(p.formula));
  return dependent(config) || config.rules.some((r) => dependent(r.patch));
}

/** Cross-field checks for a declared config (the base and each rule on top of it). */
export function validateConfig(config: ScalingConfig): ScalingConfig {
  const check = (c: ScalingConfig, where: string): void => {
    if (c.minFactor !== undefined && c.maxFactor !== undefined && c.minFactor > c.maxFactor) {
      throw new RangeError(`${where}: minFactor must be <= maxFactor`);
    }
    // Value bounds clamp the magnitude, so they must not be negative.
    if (c.minValue !== undefined && c.minValue < 0) throw new RangeError(`${where}: minValue must be >= 0`);
    if (c.maxValue !== undefined && c.maxValue < 0) throw new RangeError(`${where}: maxValue must be >= 0`);
    if (c.minValue !== undefined && c.maxValue !== undefined && c.minValue > c.maxValue) {
      throw new RangeError(`${where}: minValue must be <= maxValue`);
    }
  };
  check(config, 'strategy');
  config.rules.forEach((r, i) => check(applyPatch(config, r.patch), `rules[${i}]`));
  return config;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────────────────────

export function readAxis(screen: ScreenSnapshot, axis: ScalingAxis): number {
  const min = Math.min(screen.widthDp, screen.heightDp);
  const max = Math.max(screen.widthDp, screen.heightDp);
  switch (axis) {
    case 'smallestWidth': return screen.smallestWidthDp;
    case 'width': return screen.widthDp;
    case 'height': return screen.heightDp;
    case 'min': return min;
    case 'max': return max;
    case 'diagonal': return Math.sqrt(min * min + max * max);
    case 'perimeter': return min + max;
  }
}

export function readReference(ref: { width: number; height: number }, axis: ScalingAxis): number {
  switch (axis) {
    case 'smallestWidth':
    case 'min': return Math.min(ref.width, ref.height);
    case 'width': return ref.width;
    case 'height': return ref.height;
    case 'max': return Math.max(ref.width, ref.height);
    case 'diagonal': return Math.sqrt(ref.width * ref.width + ref.height * ref.height);
    case 'perimeter': return ref.width + ref.height;
  }
}

function aspectRatioOf(s: ScreenSnapshot): number {
  const min = Math.min(s.widthDp, s.heightDp);
  return min > 0 ? Math.max(s.widthDp, s.heightDp) / min : 1;
}

function inRange(v: number, min: number | undefined, max: number | undefined): boolean {
  return (min === undefined || v >= min) && (max === undefined || v < max);
}

export function conditionMatches(c: ScreenCondition, s: ScreenSnapshot): boolean {
  if (c.devices && !c.devices.has(s.device)) return false;
  if (c.orientation === 'landscape' && !s.isLandscape) return false;
  if (c.orientation === 'portrait' && s.isLandscape) return false;
  if (!inRange(s.smallestWidthDp, c.minSmallestWidth, c.maxSmallestWidth)) return false;
  if (!inRange(s.widthDp, c.minWidth, c.maxWidth)) return false;
  if (!inRange(s.heightDp, c.minHeight, c.maxHeight)) return false;
  if (!inRange(aspectRatioOf(s), c.minAspectRatio, c.maxAspectRatio)) return false;
  if (c.multiWindow !== undefined && s.isMultiWindow !== c.multiWindow) return false;
  return true;
}

export function evaluateCurve(
  curve: Curve, ratio: number, axisDp: number, screen: ScreenSnapshot,
  refDp = NaN, reference: { readonly width: number; readonly height: number } = DEFAULT_CONFIG.reference,
): number {
  switch (curve.type) {
    case 'expression': return curve.expression.evaluate(expressionVariables(screen, ratio, axisDp, refDp, reference));
    case 'linear': return ratio;
    case 'power': return ratio > 0 ? Math.pow(ratio, curve.exponent) : 0;
    case 'logarithmic': return ratio > 0 ? 1 + curve.k * Math.log(ratio) : 1;
    case 'interpolated': return 1 + (ratio - 1) * curve.t;
    case 'constant': return curve.factor;
    case 'custom': return curve.fn(ratio, screen);
    case 'breakpoints': {
      const pts = curve.points;
      if (axisDp <= pts[0]!.at) return pts[0]!.factor;
      for (let i = 1; i < pts.length; i++) {
        const b = pts[i]!;
        if (axisDp <= b.at) {
          const a = pts[i - 1]!;
          const span = b.at - a.at;
          return span <= 0 ? b.factor : a.factor + (b.factor - a.factor) * ((axisDp - a.at) / span);
        }
      }
      return pts[pts.length - 1]!.factor;
    }
  }
}

/** Everything a strategy needs for one window: the screen-only factor plus value-dependent parts. */
export class ResolvedScaling {
  /**
   * `E` of a proportional formula (`base * E`), evaluated once for this window with the same
   * variables the formula sees; NaN when there is none. `scale(base)` is then `base * E`.
   */
  private readonly formulaCoefficient: number;
  private readonly proportional: boolean;

  constructor(
    readonly screen: ScreenSnapshot,
    readonly config: ScalingConfig,
    readonly factor: number,
    readonly appliedRules: readonly string[],
    readonly axisDp: number,
    readonly referenceDp: number,
    readonly curveFactor: number,
    readonly aspectRatioMultiplier: number,
    /**
     * True when `ignoreMultiWindow` applies to this multi-window screen: the value stays unscaled
     * (only value bounds apply); formulas and transforms are skipped.
     */
    readonly multiWindowIgnored = false,
  ) {
    const e = multiWindowIgnored ? undefined : config.formula?.baseCoefficient;
    this.proportional = !!e;
    this.formulaCoefficient = e
      ? e.evaluate(expressionVariables(screen, referenceDp > 0 ? axisDp / referenceDp : 1, axisDp, referenceDp, config.reference))
      : NaN;
  }

  /**
   * What one dp becomes when the strategy does not depend on the value: `factor`, or `E` of a
   * proportional formula (`base * E`). Published as `--cdp-<id>`.
   */
  get valueFactor(): number {
    return this.proportional ? this.formulaCoefficient : this.factor;
  }

  /** `base` dp → scaled dp. */
  scale(base: number): number {
    // `base * E` evaluated per value gives the same double (IEEE multiplication is commutative).
    if (this.proportional) return base * this.formulaCoefficient;
    let out = base * this.factor;
    const { minValue: min, maxValue: max } = this.config;
    if ((min !== undefined || max !== undefined) && out !== 0) {
      // Bounds apply to the magnitude so negative offsets mirror positive ones; 0 stays 0.
      let magnitude = Math.abs(out);
      if (min !== undefined && magnitude < min) magnitude = min;
      if (max !== undefined && magnitude > max) magnitude = max;
      out = out < 0 ? -magnitude : magnitude;
    }
    if (this.multiWindowIgnored) return out;
    if (this.config.formula) {
      const ratio = this.referenceDp > 0 ? this.axisDp / this.referenceDp : 1;
      out = this.config.formula.evaluate(
        expressionVariables(this.screen, ratio, this.axisDp, this.referenceDp, this.config.reference, base, out, this.factor),
      );
    } else if (this.config.transform) out = this.config.transform(base, out, this.screen);
    return out;
  }

  /** Effective font scale under the strategy policy. */
  effectiveFontScale(): number {
    const p = this.config.fontScale;
    const s = this.screen.fontScale;
    return p.type === 'follow' ? s : p.type === 'ignore' ? 1 : Math.min(s, p.max);
  }

  /** Text size, dp-equivalent after the effective font scale (`csp` in CSS px). */
  scaleSpDp(base: number): number {
    return this.scale(base) * this.effectiveFontScale();
  }

  /** Text size in sp units: the platform multiplies by its own font scale afterwards. */
  scaleSpUnits(base: number): number {
    const s = this.screen.fontScale;
    return s > 0 ? this.scale(base) * (this.effectiveFontScale() / s) : this.scale(base);
  }

  /** Human-readable breakdown for logs / debug overlays. */
  explain(strategyId: string): string {
    const c = this.config;
    let out = `[${strategyId}] ${this.screen.device} ${c.axis}=${fmt(this.axisDp)}dp / ref ${fmt(this.referenceDp)} = ${fmt(this.axisDp / this.referenceDp)}`;
    out += ` -> ${curveName(c.curve)} = ${fmt(this.curveFactor)}`;
    if (c.multiplier !== 1) out += ` x ${fmt(c.multiplier)}`;
    if (c.aspectRatio) out += ` x AR ${fmt(this.aspectRatioMultiplier)}`;
    if (c.minFactor !== undefined || c.maxFactor !== undefined) {
      out += ` clamp[${c.minFactor !== undefined ? fmt(c.minFactor) : '-'}, ${c.maxFactor !== undefined ? fmt(c.maxFactor) : '-'}]`;
    }
    out += ` => factor ${fmt(this.factor)}`;
    if (this.multiWindowIgnored) out += ' (multi-window ignored)';
    else if (c.formula) out += ` then Formula(${c.formula.source})`;
    else if (c.transform) out += ' then transform';
    if (this.appliedRules.length) out += ` rules=[${this.appliedRules.join(', ')}]`;
    return out;
  }
}

function fmt(v: number): string {
  return String(Math.round(v * 1e4) / 1e4);
}

function curveName(c: Curve): string {
  switch (c.type) {
    case 'linear': return 'linear';
    case 'power': return `power(${c.exponent})`;
    case 'logarithmic': return `logarithmic(${c.k})`;
    case 'interpolated': return `interpolated(${c.t})`;
    case 'constant': return `constant(${c.factor})`;
    case 'breakpoints': return `breakpoints(${c.points.length})`;
    case 'expression': return `expression(${c.expression.source})`;
    case 'custom': return 'custom';
  }
}

/** Pure resolution of `config` for `screen` (rules applied in declaration order). */
export function resolveScaling(base: ScalingConfig, screen: ScreenSnapshot): ResolvedScaling {
  let cfg = base;
  const applied: string[] = [];
  base.rules.forEach((rule, i) => {
    if (conditionMatches(rule.condition, screen)) {
      cfg = applyPatch(cfg, rule.patch);
      applied.push(rule.name ?? `#${i}`);
    }
  });
  const axisDp = readAxis(screen, cfg.axis);
  const refDp = readReference(cfg.reference, cfg.axis);
  if (cfg.ignoreMultiWindow && screen.isMultiWindow) {
    return new ResolvedScaling(screen, cfg, 1, applied, axisDp, refDp, 1, 1, true);
  }
  const ratio = refDp > 0 ? axisDp / refDp : 1;
  const curveFactor = evaluateCurve(cfg.curve, ratio, axisDp, screen, refDp, cfg.reference);
  let factor = curveFactor * cfg.multiplier;
  let arMul = 1;
  if (cfg.aspectRatio) {
    const k = cfg.sensitivity ?? CUSTOM_SENSITIVITY_DEFAULT;
    arMul = 1 + k * Math.log(aspectRatioOf(screen) / REFERENCE_ASPECT_RATIO);
    factor *= arMul;
  }
  if (cfg.minFactor !== undefined && factor < cfg.minFactor) factor = cfg.minFactor;
  if (cfg.maxFactor !== undefined && factor > cfg.maxFactor) factor = cfg.maxFactor;
  if (!Number.isFinite(factor)) throw new RangeError(`custom strategy produced a non-finite factor (${factor})`);
  return new ResolvedScaling(screen, cfg, factor, applied, axisDp, refDp, curveFactor, arMul);
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec ↔ config
// ─────────────────────────────────────────────────────────────────────────────

function num(v: unknown, path: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${path} must be a finite number`);
  return v;
}

function req(v: unknown, path: string): number {
  const n = num(v, path);
  if (n === undefined) throw new TypeError(`${path} is required`);
  return n;
}

function readCurve(v: unknown, path: string): Curve {
  if (typeof v === 'string') return readCurve({ type: v }, path);
  if (!v || typeof v !== 'object') throw new TypeError(`${path} must be an object or string`);
  const o = v as Record<string, unknown>;
  switch (o.type) {
    case 'linear': return { type: 'linear' };
    case 'power': return { type: 'power', exponent: num(o.exponent, `${path}.exponent`) ?? 0.75 };
    case 'logarithmic': return { type: 'logarithmic', k: num(o.k, `${path}.k`) ?? 0.4 };
    case 'interpolated': return { type: 'interpolated', t: num(o.t, `${path}.t`) ?? 0.5 };
    case 'constant': return { type: 'constant', factor: num(o.factor, `${path}.factor`) ?? 1 };
    case 'expression':
      if (typeof o.expression !== 'string') throw new TypeError(`${path}.expression is required`);
      return { type: 'expression', expression: parseAt(o.expression, CURVE_VARIABLES, `${path}.expression`) };
    case 'custom':
      if (typeof o.fn !== 'function') throw new TypeError(`${path}.fn must be a function`);
      return { type: 'custom', fn: o.fn as CurveFunction };
    case 'breakpoints': {
      if (!Array.isArray(o.points) || o.points.length === 0) throw new TypeError(`${path}.points must be a non-empty array`);
      const points = o.points.map((p: unknown, i: number) => {
        const q = (p ?? {}) as Record<string, unknown>;
        const at = req(q.at, `${path}.points[${i}].at`);
        if (at < 0) throw new RangeError(`${path}.points[${i}].at must be >= 0`);
        return Object.freeze({ at, factor: req(q.factor, `${path}.points[${i}].factor`) });
      });
      points.sort((a, b) => a.at - b.at);
      return { type: 'breakpoints', points: Object.freeze(points) };
    }
    default:
      throw new TypeError(`${path}.type '${String(o.type)}' is not one of linear, power, logarithmic, interpolated, constant, breakpoints, expression`);
  }
}

function parseAt(source: string, allowed: readonly string[], path: string): ScalingExpression {
  try {
    return ScalingExpression.parse(source, allowed);
  } catch (e) {
    throw new SyntaxError(`${path}: ${(e as Error).message}`);
  }
}

function readFontScale(v: unknown, path: string): FontScalePolicy {
  if (v === 'follow') return { type: 'follow' };
  if (v === 'ignore') return { type: 'ignore' };
  if (v && typeof v === 'object') {
    const max = req((v as Record<string, unknown>).max, `${path}.max`);
    if (max <= 0) throw new RangeError(`${path}.max must be > 0`);
    return { type: 'clamp', max };
  }
  throw new TypeError(`${path} must be "follow", "ignore" or {"max": n}`);
}

function readDevice(v: unknown, path: string): DeviceClass {
  if (typeof v !== 'string' || !(DEVICE_CLASSES as readonly string[]).includes(v)) {
    throw new TypeError(`${path}: Unknown device '${String(v)}'. Expected one of ${DEVICE_CLASSES.join(', ')}`);
  }
  return v as DeviceClass;
}

/** A present (non-null) value must be an object; `null` / absent → undefined. */
function obj<T>(v: T | null | undefined, path: string): T | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) throw new TypeError(`${path} must be an object`);
  return v;
}

/** A present (non-null) value must be a boolean; `null` / absent → undefined. */
function bool(v: unknown, path: string): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new TypeError(`${path} must be a boolean`);
  return v;
}

/** Validates a patch-shaped spec (strategy root or rule `set`). */
export function readPatch(o: ScalingPatchSpec, path: string): ScalingPatch {
  const out: { -readonly [K in keyof ScalingPatch]: ScalingPatch[K] } = {};
  if (o.reference) {
    const width = num(o.reference.width, `${path}.reference.width`) ?? 300;
    const height = num(o.reference.height, `${path}.reference.height`) ?? 533;
    if (width <= 0 || height <= 0) throw new RangeError(`${path}.reference must be > 0`);
    out.reference = Object.freeze({ width, height });
  }
  if (o.axis !== undefined) {
    if (!SCALING_AXES.includes(o.axis)) throw new TypeError(`${path}.axis: Unknown axis '${String(o.axis)}'. Expected one of ${SCALING_AXES.join(', ')}`);
    out.axis = o.axis;
  }
  if (o.curve !== undefined) out.curve = readCurve(o.curve, `${path}.curve`);
  if (o.multiplier !== undefined) out.multiplier = num(o.multiplier, `${path}.multiplier`);
  const clamp = obj(o.clamp, `${path}.clamp`);
  if (clamp) {
    out.minFactor = num(clamp.min, `${path}.clamp.min`);
    out.maxFactor = num(clamp.max, `${path}.clamp.max`);
  }
  const valueClamp = obj(o.valueClamp, `${path}.valueClamp`);
  if (valueClamp) {
    out.minValue = num(valueClamp.min, `${path}.valueClamp.min`);
    out.maxValue = num(valueClamp.max, `${path}.valueClamp.max`);
  }
  const ar = o.aspectRatio;
  if (ar !== undefined) {
    if (typeof ar === 'boolean') out.aspectRatio = ar;
    else if (ar && typeof ar === 'object') {
      out.aspectRatio = bool(ar.enabled, `${path}.aspectRatio.enabled`) ?? true;
      out.sensitivity = num(ar.sensitivity, `${path}.aspectRatio.sensitivity`);
    } else throw new TypeError(`${path}.aspectRatio must be a boolean or object`);
  }
  if (o.sensitivity !== undefined && out.sensitivity === undefined) out.sensitivity = num(o.sensitivity, `${path}.sensitivity`);
  if (o.fontScale !== undefined) out.fontScale = readFontScale(o.fontScale, `${path}.fontScale`);
  out.ignoreMultiWindow = bool(o.ignoreMultiWindow, `${path}.ignoreMultiWindow`);
  if (o.transform !== undefined) {
    if (typeof o.transform !== 'function') throw new TypeError(`${path}.transform must be a function`);
    out.transform = o.transform;
  }
  if (o.formula !== undefined && o.formula !== null) {
    if (typeof o.formula !== 'string') throw new TypeError(`${path}.formula must be a string`);
    out.formula = parseAt(o.formula, FORMULA_VARIABLES, `${path}.formula`);
  }
  for (const k of Object.keys(out) as (keyof ScalingPatch)[]) if (out[k] === undefined) delete out[k];
  return Object.freeze(out);
}

function readRange(r: RangeSpec | undefined, path: string): [number | undefined, number | undefined] {
  if (r === undefined || r === null) return [undefined, undefined];
  if (typeof r !== 'object' || Array.isArray(r)) throw new TypeError(`${path} must be an object with min/max`);
  return [num(r.min, `${path}.min`), num(r.max, `${path}.max`)];
}

export function readCondition(o: ScreenConditionSpec | undefined, path: string): ScreenCondition {
  if (!o) return Object.freeze({});
  const out: { -readonly [K in keyof ScreenCondition]: ScreenCondition[K] } = {};
  if (o.device !== undefined) {
    const list = typeof o.device === 'string' ? [o.device] : o.device;
    if (!Array.isArray(list)) throw new TypeError(`${path}.device must be a string or array`);
    out.devices = new Set(list.map((d, i) => readDevice(d, `${path}.device[${i}]`)));
  }
  if (o.orientation !== undefined) {
    if (o.orientation !== 'portrait' && o.orientation !== 'landscape') {
      throw new TypeError(`${path}.orientation '${String(o.orientation)}' must be portrait or landscape`);
    }
    out.orientation = o.orientation;
  }
  [out.minSmallestWidth, out.maxSmallestWidth] = readRange(o.smallestWidth, `${path}.smallestWidth`);
  [out.minWidth, out.maxWidth] = readRange(o.width, `${path}.width`);
  [out.minHeight, out.maxHeight] = readRange(o.height, `${path}.height`);
  [out.minAspectRatio, out.maxAspectRatio] = readRange(o.aspectRatio, `${path}.aspectRatio`);
  out.multiWindow = bool(o.multiWindow, `${path}.multiWindow`);
  for (const k of Object.keys(out) as (keyof ScreenCondition)[]) if (out[k] === undefined) delete out[k];
  return Object.freeze(out);
}

/** Builds a validated config from `spec` on top of `parent` (parent rules first). */
export function configFromSpec(spec: ScalingPatchSpec & { rules?: readonly ScalingRuleSpec[] }, parent: ScalingConfig, path: string): ScalingConfig {
  let cfg = applyPatch(parent, readPatch(spec, path));
  if (spec.clamp === null) cfg = { ...cfg, minFactor: undefined, maxFactor: undefined };
  if (spec.valueClamp === null) cfg = { ...cfg, minValue: undefined, maxValue: undefined };
  if (spec.formula === null) cfg = { ...cfg, formula: undefined };
  const rules = (spec.rules ?? []).map((r, i) => {
    if (!r || typeof r !== 'object') throw new TypeError(`${path}.rules[${i}] must be an object`);
    const set = obj(r.set, `${path}.rules[${i}].set`);
    if (!set) throw new TypeError(`${path}.rules[${i}].set is required`);
    return Object.freeze({
      condition: readCondition(obj(r.when, `${path}.rules[${i}].when`), `${path}.rules[${i}].when`),
      patch: readPatch(set, `${path}.rules[${i}].set`),
      ...(r.name !== undefined ? { name: r.name } : {}),
    }) as ScalingRule;
  });
  return validateConfig(Object.freeze({ ...cfg, rules: Object.freeze([...parent.rules, ...rules]) }));
}

function curveToSpec(c: Curve): CurveSpec {
  switch (c.type) {
    case 'linear': return { type: 'linear' };
    case 'power': return { type: 'power', exponent: c.exponent };
    case 'logarithmic': return { type: 'logarithmic', k: c.k };
    case 'interpolated': return { type: 'interpolated', t: c.t };
    case 'constant': return { type: 'constant', factor: c.factor };
    case 'breakpoints': return { type: 'breakpoints', points: c.points.map((p) => ({ at: p.at, factor: p.factor })) };
    case 'expression': return { type: 'expression', expression: c.expression.source };
    case 'custom': throw new TypeError('Custom curve functions cannot be encoded to JSON');
  }
}

function fontScaleToSpec(f: FontScalePolicy): FontScaleSpec {
  return f.type === 'clamp' ? { max: f.max } : f.type;
}

function range(min: number | undefined, max: number | undefined): RangeSpec {
  const r: RangeSpec = {};
  if (min !== undefined) r.min = min;
  if (max !== undefined) r.max = max;
  return r;
}

function patchToSpec(p: ScalingPatch, defaults: boolean): ScalingPatchSpec {
  if (p.transform) throw new TypeError('transform functions cannot be encoded to JSON');
  const o: ScalingPatchSpec = {};
  if (p.reference && (!defaults || p.reference.width !== 300 || p.reference.height !== 533)) o.reference = { ...p.reference };
  if (p.axis && (!defaults || p.axis !== 'smallestWidth')) o.axis = p.axis;
  if (p.curve) o.curve = curveToSpec(p.curve);
  if (p.multiplier !== undefined && (!defaults || p.multiplier !== 1)) o.multiplier = p.multiplier;
  if (p.minFactor !== undefined || p.maxFactor !== undefined) o.clamp = range(p.minFactor, p.maxFactor);
  if (p.minValue !== undefined || p.maxValue !== undefined) o.valueClamp = range(p.minValue, p.maxValue);
  if (p.aspectRatio !== undefined && (!defaults || p.aspectRatio || p.sensitivity !== undefined)) {
    o.aspectRatio = p.sensitivity !== undefined ? { enabled: p.aspectRatio, sensitivity: p.sensitivity } : { enabled: p.aspectRatio };
  } else if (p.aspectRatio === undefined && p.sensitivity !== undefined) {
    o.sensitivity = p.sensitivity; // sensitivity-only patch
  }
  if (p.fontScale && (!defaults || p.fontScale.type !== 'follow')) o.fontScale = fontScaleToSpec(p.fontScale);
  if (p.ignoreMultiWindow !== undefined && (!defaults || p.ignoreMultiWindow)) o.ignoreMultiWindow = p.ignoreMultiWindow;
  if (p.formula) o.formula = p.formula.source;
  return o;
}

function conditionToSpec(c: ScreenCondition): ScreenConditionSpec {
  const o: ScreenConditionSpec = {};
  if (c.devices) o.device = DEVICE_CLASSES.filter((d) => c.devices!.has(d));
  if (c.orientation) o.orientation = c.orientation;
  if (c.minSmallestWidth !== undefined || c.maxSmallestWidth !== undefined) o.smallestWidth = range(c.minSmallestWidth, c.maxSmallestWidth);
  if (c.minWidth !== undefined || c.maxWidth !== undefined) o.width = range(c.minWidth, c.maxWidth);
  if (c.minHeight !== undefined || c.maxHeight !== undefined) o.height = range(c.minHeight, c.maxHeight);
  if (c.minAspectRatio !== undefined || c.maxAspectRatio !== undefined) o.aspectRatio = range(c.minAspectRatio, c.maxAspectRatio);
  if (c.multiWindow !== undefined) o.multiWindow = c.multiWindow;
  return o;
}

/** Encodes a config as a JSON-ready spec (throws for function curves / transforms). */
export function configToSpec(id: string, c: ScalingConfig): ScalingStrategySpec {
  const spec: ScalingStrategySpec = { id, ...patchToSpec(c, true) };
  if (c.rules.length) {
    spec.rules = c.rules.map((r) => ({
      ...(r.name !== undefined ? { name: r.name } : {}),
      when: conditionToSpec(r.condition),
      set: patchToSpec(r.patch, false),
    }));
  }
  return spec;
}

/** Parses a strategies document, a single spec or an array; resolves `extends` with `lookup`. */
export function parseStrategiesDocument(
  input: string | ScalingStrategiesDocument | ScalingStrategySpec | readonly ScalingStrategySpec[],
  lookup: (id: string) => ScalingConfig | undefined,
): { configs: Map<string, ScalingConfig>; defaultId?: string } {
  let root: unknown = input;
  if (typeof input === 'string') {
    try {
      root = JSON.parse(input);
    } catch (e) {
      throw new SyntaxError(`Invalid JSON: ${(e as Error).message}`);
    }
  }
  let items: readonly unknown[];
  let defaultId: string | undefined;
  if (Array.isArray(root)) items = root;
  else if (root && typeof root === 'object' && 'strategies' in root) {
    const doc = root as ScalingStrategiesDocument;
    const version = doc.version ?? CUSTOM_FORMAT_VERSION;
    if (version > CUSTOM_FORMAT_VERSION) throw new RangeError(`Unsupported strategies format version ${version}`);
    if (!Array.isArray(doc.strategies)) throw new TypeError('strategies must be an array');
    items = doc.strategies;
    defaultId = typeof doc.default === 'string' ? doc.default : undefined;
  } else if (root && typeof root === 'object') items = [root];
  else throw new TypeError('Expected a JSON object or array');

  const raw = new Map<string, ScalingStrategySpec>();
  items.forEach((item, i) => {
    if (!item || typeof item !== 'object') throw new TypeError(`strategies[${i}] must be an object`);
    const spec = item as ScalingStrategySpec;
    if (typeof spec.id !== 'string' || !spec.id.trim()) throw new TypeError(`strategies[${i}].id is required`);
    if (raw.has(spec.id)) throw new TypeError(`Duplicate strategy id '${spec.id}'`);
    raw.set(spec.id, spec);
  });
  const configs = new Map<string, ScalingConfig>();
  const build = (id: string, stack: string[]): ScalingConfig => {
    const done = configs.get(id);
    if (done) return done;
    if (stack.includes(id)) throw new TypeError(`Cyclic 'extends': ${[...stack, id].join(' → ')}`);
    const spec = raw.get(id)!;
    let parent = DEFAULT_CONFIG;
    if (spec.extends !== undefined) {
      if (raw.has(spec.extends)) parent = build(spec.extends, [...stack, id]);
      else {
        const found = lookup(spec.extends);
        if (!found) throw new TypeError(`'${id}' extends unknown strategy '${spec.extends}'`);
        parent = found;
      }
    }
    const cfg = configFromSpec(spec, parent, id);
    configs.set(id, cfg);
    return cfg;
  };
  raw.forEach((_, id) => build(id, []));
  return { configs, defaultId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-ins and presets as specs (identical on every platform)
// ─────────────────────────────────────────────────────────────────────────────

/** The built-in strategies expressed as custom specs (parents for `extends`). */
export const BUILT_IN_SPECS: Readonly<Record<string, ScalingStrategySpec>> = Object.freeze({
  scaled: { id: 'scaled' },
  power: { id: 'power', curve: { type: 'power', exponent: 0.75 } },
  logarithmic: { id: 'logarithmic', curve: { type: 'logarithmic', k: 0.4 } },
  interpolated: { id: 'interpolated', curve: { type: 'interpolated', t: 0.5 } },
  diagonal: { id: 'diagonal', axis: 'diagonal' },
  perimeter: { id: 'perimeter', axis: 'perimeter' },
  fixed: { id: 'fixed', curve: { type: 'constant', factor: 1 } },
});

/** Ready-made strategies for common product needs. */
export const PRESET_SPECS: Readonly<Record<string, ScalingStrategySpec>> = Object.freeze({
  tabletFriendly: {
    id: 'tabletFriendly',
    clamp: { max: 1.8 },
    rules: [{ name: 'large', when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'power', exponent: 0.5 } } }],
  },
  compactFirst: {
    id: 'compactFirst',
    reference: { width: 360, height: 640 },
    curve: { type: 'interpolated', t: 0.5 },
    clamp: { min: 0.9, max: 1.4 },
  },
  tvSafe: {
    id: 'tvSafe',
    rules: [{ name: 'tv', when: { device: 'tv' }, set: { axis: 'height', reference: { width: 960, height: 540 }, clamp: { min: 1, max: 2 } } }],
  },
  wearable: {
    id: 'wearable',
    rules: [{ name: 'watch', when: { device: 'watch' }, set: { axis: 'min', reference: { width: 192, height: 192 }, clamp: { min: 0.85, max: 1.15 } } }],
  },
  gameHud: {
    id: 'gameHud',
    axis: 'min',
    curve: { type: 'power', exponent: 0.85 },
    aspectRatio: true,
    clamp: { min: 0.75, max: 2.5 },
    fontScale: 'ignore',
  },
  readableText: {
    id: 'readableText',
    curve: { type: 'logarithmic', k: 0.4 },
    fontScale: { max: 1.3 },
  },
});
