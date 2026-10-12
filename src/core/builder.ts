/**
 * Custom-dimension builder — port of `DimenScaled` / `ScaledSp` and their strategy
 * twins (`DimenPower`, `PowerSp`, …).
 *
 *   const pad = scaledDp(16)
 *     .aspectRatio(true)
 *     .screen(UiModeType.TELEVISION, 40)
 *     .screen(DpQualifier.SMALL_WIDTH, 600, 24)
 *   pad.sdp  // CSS px for the current window
 *
 * Builders are immutable (every call returns a new builder) and memoize their result
 * per snapshot version, so reading `.sdp` in a render loop costs a version compare.
 */
import { KIND_DP, KIND_SP, resolve, type Bound, type Kind } from './api';
import { DpQualifier, Inverter, Orientation, UiModeType } from './enums';
import { S, sync } from './runtime';
import { readScreenDp } from './strategy';

/** One `.screen(...)` rule. Lower priority wins; ties prefer the larger qualifier value. */
export interface ScreenEntry {
  readonly priority: 1 | 2 | 3 | 4;
  readonly uiModeType?: UiModeType;
  readonly qualifier?: { readonly type: DpQualifier; readonly value: number };
  readonly orientation?: Orientation;
  readonly value: number;
  readonly finalQualifierResolver?: DpQualifier;
  readonly inverter?: Inverter;
}

/** Object form of `.screen()`. */
export interface ScreenRule {
  uiModeType?: UiModeType;
  qualifier?: { type: DpQualifier; value: number } | readonly [DpQualifier, number];
  orientation?: Orientation;
  /** Base value (dp) used when the rule matches. */
  value: number;
  finalQualifierResolver?: DpQualifier;
  inverter?: Inverter;
}

const UI_MODES = new Set<string>(Object.values(UiModeType));
const QUALIFIERS = new Set<string>(Object.values(DpQualifier));
const ORIENTATIONS = new Set<string>(Object.values(Orientation));

type Opt<T> = T | null | undefined;

export class DimenBuilder {
  /** @internal */ private readonly b: Bound;
  /** @internal */ private readonly base: number;
  /** @internal */ private readonly entries: readonly ScreenEntry[];
  /** @internal */ private readonly mw: boolean;
  /** @internal */ private readonly ar: boolean;
  /** @internal */ private readonly k: number | null;
  /** @internal */ private memoVersion = -1;
  /** @internal */ private readonly memo = new Float64Array(24);

  constructor(
    bound: Bound,
    base: number,
    entries: readonly ScreenEntry[] = [],
    ignoreMultiWindows = false,
    applyAspectRatio = false,
    customSensitivityK: number | null = null,
  ) {
    if (!Number.isFinite(base)) throw new RangeError('base value must be finite');
    this.b = bound;
    this.base = base;
    this.entries = entries;
    this.mw = ignoreMultiWindows;
    this.ar = applyAspectRatio;
    this.k = customSensitivityK;
  }

  private copy(entries = this.entries, mw = this.mw, ar = this.ar, k = this.k): this {
    const Ctor = this.constructor as new (...args: ConstructorParameters<typeof DimenBuilder>) => this;
    return new Ctor(this.b, this.base, entries, mw, ar, k);
  }

  /** Enables the aspect-ratio correction, optionally with a custom sensitivity k. */
  aspectRatio(apply = true, customSensitivityK: number | null = null): this {
    return this.copy(this.entries, this.mw, apply, customSensitivityK);
  }

  /** Alias of {@link aspectRatio} (Android `applyAspectRatio`). */
  applyAspectRatio(apply = true): this {
    return this.copy(this.entries, this.mw, apply, this.k);
  }

  /** Returns the unscaled base value in split / floating windows. */
  ignoreMultiWindows(ignore = true): this {
    return this.copy(this.entries, ignore, this.ar, this.k);
  }

  /** Priority 1 — UI mode + qualifier threshold: `.screen(UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 600, 40)`. */
  screen(
    uiModeType: UiModeType,
    qualifierType: DpQualifier,
    qualifierValue: number,
    customValue: number,
    finalQualifierResolver?: Opt<DpQualifier>,
    inverter?: Opt<Inverter>,
    orientation?: Opt<Orientation>,
  ): this;
  /** Priority 2 — UI mode: `.screen(UiModeType.TELEVISION, 40)`. */
  screen(
    uiModeType: UiModeType,
    customValue: number,
    finalQualifierResolver?: Opt<DpQualifier>,
    inverter?: Opt<Inverter>,
    orientation?: Opt<Orientation>,
  ): this;
  /** Priority 3 — qualifier threshold: `.screen(DpQualifier.SMALL_WIDTH, 600, 24)`. */
  screen(
    qualifierType: DpQualifier,
    qualifierValue: number,
    customValue: number,
    finalQualifierResolver?: Opt<DpQualifier>,
    inverter?: Opt<Inverter>,
    orientation?: Opt<Orientation>,
  ): this;
  /** Priority 4 — orientation: `.screen(Orientation.LANDSCAPE, 12)`. */
  screen(
    orientation: Orientation,
    customValue: number,
    finalQualifierResolver?: Opt<DpQualifier>,
    inverter?: Opt<Inverter>,
  ): this;
  /** Object form: `.screen({ uiModeType, qualifier: [DpQualifier.SMALL_WIDTH, 600], orientation, value })`. */
  screen(rule: ScreenRule): this;
  screen(...args: unknown[]): this {
    return this.copy(insert(this.entries, parseScreen(args)));
  }

  /** Resolves on `qualifier` → CSS px. */
  dp(qualifier: DpQualifier = DpQualifier.SMALL_WIDTH): number {
    return this.get(qualifier, KIND_DP, false, true);
  }

  /** Resolves on `qualifier` → device px (× devicePixelRatio). */
  px(qualifier: DpQualifier = DpQualifier.SMALL_WIDTH): number {
    return this.get(qualifier, KIND_DP, true, true);
  }

  /** Text size on `qualifier` → CSS px, × font scale unless `fontScale` is false. */
  sp(qualifier: DpQualifier = DpQualifier.SMALL_WIDTH, fontScale = true): number {
    return this.get(qualifier, KIND_SP, false, fontScale);
  }

  /** Text size → device px. */
  spPx(qualifier: DpQualifier = DpQualifier.SMALL_WIDTH, fontScale = true): number {
    return this.get(qualifier, KIND_SP, true, fontScale);
  }

  get sdp(): number { return this.dp(DpQualifier.SMALL_WIDTH); }
  get hdp(): number { return this.dp(DpQualifier.HEIGHT); }
  get wdp(): number { return this.dp(DpQualifier.WIDTH); }
  get sdpPx(): number { return this.px(DpQualifier.SMALL_WIDTH); }
  get hdpPx(): number { return this.px(DpQualifier.HEIGHT); }
  get wdpPx(): number { return this.px(DpQualifier.WIDTH); }
  get ssp(): number { return this.sp(DpQualifier.SMALL_WIDTH); }
  get hsp(): number { return this.sp(DpQualifier.HEIGHT); }
  get wsp(): number { return this.sp(DpQualifier.WIDTH); }
  get sspPx(): number { return this.spPx(DpQualifier.SMALL_WIDTH); }
  get hspPx(): number { return this.spPx(DpQualifier.HEIGHT); }
  get wspPx(): number { return this.spPx(DpQualifier.WIDTH); }
  get sem(): number { return this.sp(DpQualifier.SMALL_WIDTH, false); }
  get hem(): number { return this.sp(DpQualifier.HEIGHT, false); }
  get wem(): number { return this.sp(DpQualifier.WIDTH, false); }
  get semPx(): number { return this.spPx(DpQualifier.SMALL_WIDTH, false); }
  get hemPx(): number { return this.spPx(DpQualifier.HEIGHT, false); }
  get wemPx(): number { return this.spPx(DpQualifier.WIDTH, false); }

  /** Resolves `.sdp`, `.hdp` and `.wdp` in one pass (Android `sdpHdpWdpPx`). */
  all(): { sdp: number; hdp: number; wdp: number } {
    return { sdp: this.sdp, hdp: this.hdp, wdp: this.wdp };
  }

  private get(qualifier: DpQualifier, kind: Kind, px: boolean, fontScale: boolean): number {
    if (S.dirty) sync();
    if (this.memoVersion !== S.version) {
      this.memoVersion = S.version;
      this.memo.fill(Number.NaN);
    }
    const key =
      (qualifier === DpQualifier.HEIGHT ? 8 : qualifier === DpQualifier.WIDTH ? 16 : 0) +
      kind * 4 +
      (px ? 2 : 0) +
      (fontScale ? 1 : 0);
    const hit = this.memo[key]!;
    if (hit === hit) return hit; // not NaN → cached for this snapshot
    const m = S.metrics;
    let value = this.base;
    let finalQualifier = qualifier;
    let inverter: Inverter = Inverter.DEFAULT;
    for (const e of this.entries) {
      const orientationMatch =
        e.orientation === Orientation.LANDSCAPE ? m.isLandscape : e.orientation === Orientation.PORTRAIT ? m.isPortrait : true;
      if (!orientationMatch) continue;
      const uiModeMatch = e.uiModeType == null || e.uiModeType === m.uiModeType;
      const qualifierMatch = e.qualifier ? readScreenDp(m, e.qualifier.type) >= e.qualifier.value : true;
      const matched =
        e.priority === 1 ? uiModeMatch && qualifierMatch : e.priority === 2 ? uiModeMatch : e.priority === 3 ? qualifierMatch : true;
      if (matched) {
        value = e.value;
        finalQualifier = e.finalQualifierResolver ?? qualifier;
        inverter = e.inverter ?? Inverter.DEFAULT;
        break;
      }
    }
    const out = resolve(
      this.b,
      value,
      finalQualifier,
      { inverter, ignoreMultiWindows: this.mw, applyAspectRatio: this.ar, customSensitivityK: this.k, fontScale },
      kind,
      px,
    );
    this.memo[key] = out;
    return out;
  }
}

function insert(entries: readonly ScreenEntry[], entry: ScreenEntry): ScreenEntry[] {
  // Stable sort: priority ascending, then qualifier value descending (Android `reorderEntries`).
  return [...entries, entry].sort(
    (a, b) => a.priority - b.priority || (b.qualifier?.value ?? 0) - (a.qualifier?.value ?? 0),
  );
}

function num(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`screen(): ${what} must be a finite number`);
  return v;
}

const opt = <T>(v: unknown): T | undefined => (v == null ? undefined : (v as T));

function parseScreen(args: unknown[]): ScreenEntry {
  const [a0, a1, a2, a3, a4, a5, a6] = args;
  if (typeof a0 === 'object' && a0 !== null) {
    const r = a0 as ScreenRule;
    const q = r.qualifier
      ? Array.isArray(r.qualifier)
        ? { type: r.qualifier[0] as DpQualifier, value: num(r.qualifier[1], 'qualifier value') }
        : { type: (r.qualifier as { type: DpQualifier }).type, value: num((r.qualifier as { value: number }).value, 'qualifier value') }
      : undefined;
    const priority = r.uiModeType != null ? (q ? 1 : 2) : q ? 3 : 4;
    return {
      priority,
      uiModeType: r.uiModeType,
      qualifier: q,
      orientation: r.orientation,
      value: num(r.value, 'value'),
      finalQualifierResolver: r.finalQualifierResolver,
      inverter: r.inverter,
    };
  }
  if (typeof a0 === 'string' && UI_MODES.has(a0)) {
    if (typeof a1 === 'string' && QUALIFIERS.has(a1)) {
      return {
        priority: 1,
        uiModeType: a0 as UiModeType,
        qualifier: { type: a1 as DpQualifier, value: num(a2, 'qualifierValue') },
        value: num(a3, 'customValue'),
        finalQualifierResolver: opt(a4),
        inverter: opt(a5),
        orientation: opt(a6),
      };
    }
    return {
      priority: 2,
      uiModeType: a0 as UiModeType,
      value: num(a1, 'customValue'),
      finalQualifierResolver: opt(a2),
      inverter: opt(a3),
      orientation: opt(a4),
    };
  }
  if (typeof a0 === 'string' && QUALIFIERS.has(a0)) {
    return {
      priority: 3,
      qualifier: { type: a0 as DpQualifier, value: num(a1, 'qualifierValue') },
      value: num(a2, 'customValue'),
      finalQualifierResolver: opt(a3),
      inverter: opt(a4),
      orientation: opt(a5),
    };
  }
  if (typeof a0 === 'string' && ORIENTATIONS.has(a0)) {
    return {
      priority: 4,
      orientation: a0 as Orientation,
      value: num(a1, 'customValue'),
      finalQualifierResolver: opt(a2),
      inverter: opt(a3),
    };
  }
  throw new TypeError(`screen(): unrecognized first argument ${String(a0)}`);
}
