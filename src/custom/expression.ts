/**
 * Free-form formulas for custom strategies — a small, safe expression language (no `eval`).
 *
 * Same grammar, variables, functions and results on every AppDimens platform (reference:
 * Android `ScalingExpression`). Booleans are numbers (true = 1, false = 0; non-zero is true).
 *
 * - Operators: `+ - * / % ^` (`^` = power, right-associative; `%` keeps the dividend's sign),
 *   `== != < <= > >=`, `&& || !`, `cond ? a : b`, parentheses.
 * - Functions: `min max clamp pow sqrt ln log log10 log2 exp abs sign floor ceil round lerp step smoothstep`.
 * - Variables: {@link SCREEN_VARIABLES}; curves add `ratio axis ref refWidth refHeight`; value
 *   formulas add `base scaled factor`.
 */
import type { DeviceClass, ScreenSnapshot } from './engine';

export const SCREEN_VARIABLES: readonly string[] = Object.freeze([
  'sw', 'width', 'height', 'shortSide', 'longSide', 'diagonal', 'perimeter', 'aspectRatio',
  'density', 'fontScale', 'landscape', 'portrait', 'multiWindow',
  'phone', 'tablet', 'desktop', 'tv', 'watch', 'car', 'vr', 'pi', 'e',
]);
export const CURVE_VARIABLES: readonly string[] = Object.freeze([...SCREEN_VARIABLES, 'ratio', 'axis', 'ref', 'refWidth', 'refHeight']);
export const FORMULA_VARIABLES: readonly string[] = Object.freeze([...CURVE_VARIABLES, 'base', 'scaled', 'factor']);

type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'un'; op: '-' | '!'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'tern'; c: Node; a: Node; b: Node }
  | { k: 'call'; name: string; args: Node[] };

const ARITY: Readonly<Record<string, [number, number]>> = {
  min: [1, Infinity], max: [1, Infinity], clamp: [3, 3], pow: [2, 2], sqrt: [1, 1],
  ln: [1, 1], log: [1, 1], log10: [1, 1], log2: [1, 1], exp: [1, 1],
  abs: [1, 1], sign: [1, 1], floor: [1, 1], ceil: [1, 1], round: [1, 1],
  lerp: [3, 3], step: [2, 2], smoothstep: [3, 3],
};
const COMPARISONS = ['==', '!=', '<=', '>=', '<', '>'];

/** A parsed, immutable expression. */
export class ScalingExpression {
  private constructor(readonly source: string, private readonly root: Node) {}

  /** Parses `source`; every identifier must be in `allowed`. Errors carry the position. */
  static parse(source: string, allowed: readonly string[] = FORMULA_VARIABLES): ScalingExpression {
    if (typeof source !== 'string') throw new TypeError('expression must be a string');
    return new ScalingExpression(source, new Parser(source, new Set(allowed)).parseAll());
  }

  /** Evaluates with a name → value lookup. */
  evaluate(vars: (name: string) => number): number {
    return evalNode(this.root, vars);
  }

  private coefficient?: ScalingExpression | null;

  /**
   * Non-null when the whole formula is `base`, `base * E` or `E * base` and `E` reads no value
   * variable (`base`, `scaled`, `factor`). Such a formula is a pure screen factor: strategies
   * evaluate `E` once per window and `base * E` costs one multiply (same result, bit for bit).
   * @internal
   */
  get baseCoefficient(): ScalingExpression | null {
    if (this.coefficient === undefined) {
      const r = this.root;
      let e: Node | null = null;
      if (isBase(r)) e = { k: 'num', v: 1 };
      else if (r.k === 'bin' && r.op === '*' && isBase(r.a) && !reads(r.b, VALUE_VARIABLES)) e = r.b;
      else if (r.k === 'bin' && r.op === '*' && isBase(r.b) && !reads(r.a, VALUE_VARIABLES)) e = r.a;
      this.coefficient = e ? new ScalingExpression(this.source, e) : null;
    }
    return this.coefficient;
  }

  toString(): string {
    return this.source;
  }
}

/** Variable lookup for `screen` plus the strategy context. */
export function expressionVariables(
  screen: ScreenSnapshot, ratio: number, axisDp: number, refDp: number,
  reference: { readonly width: number; readonly height: number },
  base = NaN, scaled = NaN, factor = NaN,
): (name: string) => number {
  const min = Math.min(screen.widthDp, screen.heightDp);
  const max = Math.max(screen.widthDp, screen.heightDp);
  const flag = (d: DeviceClass): number => (screen.device === d ? 1 : 0);
  return (name) => {
    switch (name) {
      case 'sw': return screen.smallestWidthDp;
      case 'width': return screen.widthDp;
      case 'height': return screen.heightDp;
      case 'shortSide': return min;
      case 'longSide': return max;
      case 'diagonal': return Math.sqrt(min * min + max * max);
      case 'perimeter': return min + max;
      case 'aspectRatio': return min > 0 ? max / min : 1;
      case 'density': return screen.density;
      case 'fontScale': return screen.fontScale;
      case 'landscape': return screen.isLandscape ? 1 : 0;
      case 'portrait': return screen.isLandscape ? 0 : 1;
      case 'multiWindow': return screen.isMultiWindow ? 1 : 0;
      case 'phone': case 'tablet': case 'desktop': case 'tv': case 'watch': case 'car': case 'vr':
        return flag(name);
      case 'pi': return Math.PI;
      case 'e': return Math.E;
      case 'ratio': return ratio;
      case 'axis': return axisDp;
      case 'ref': return refDp;
      case 'refWidth': return reference.width;
      case 'refHeight': return reference.height;
      case 'base': return base;
      case 'scaled': return scaled;
      case 'factor': return factor;
      default: return NaN;
    }
  };
}

const VALUE_VARIABLES: ReadonlySet<string> = new Set(['base', 'scaled', 'factor']);

const isBase = (n: Node): boolean => n.k === 'var' && n.name === 'base';

/** True when the subtree reads any of `names`. */
function reads(n: Node, names: ReadonlySet<string>): boolean {
  switch (n.k) {
    case 'num': return false;
    case 'var': return names.has(n.name);
    case 'un': return reads(n.a, names);
    case 'bin': return reads(n.a, names) || reads(n.b, names);
    case 'tern': return reads(n.c, names) || reads(n.a, names) || reads(n.b, names);
    case 'call': return n.args.some((a) => reads(a, names));
  }
}

function evalNode(n: Node, v: (name: string) => number): number {
  switch (n.k) {
    case 'num': return n.v;
    case 'var': return v(n.name);
    case 'un': {
      const x = evalNode(n.a, v);
      return n.op === '-' ? -x : x !== 0 ? 0 : 1;
    }
    case 'tern': return evalNode(n.c, v) !== 0 ? evalNode(n.a, v) : evalNode(n.b, v);
    case 'bin': {
      if (n.op === '&&') return evalNode(n.a, v) !== 0 && evalNode(n.b, v) !== 0 ? 1 : 0;
      if (n.op === '||') return evalNode(n.a, v) !== 0 || evalNode(n.b, v) !== 0 ? 1 : 0;
      const x = evalNode(n.a, v);
      const y = evalNode(n.b, v);
      switch (n.op) {
        case '+': return x + y;
        case '-': return x - y;
        case '*': return x * y;
        case '/': return x / y;
        case '%': return x % y;
        case '^': return Math.pow(x, y);
        case '==': return x === y ? 1 : 0;
        case '!=': return x !== y ? 1 : 0;
        case '<': return x < y ? 1 : 0;
        case '<=': return x <= y ? 1 : 0;
        case '>': return x > y ? 1 : 0;
        default: return x >= y ? 1 : 0;
      }
    }
    case 'call': {
      const x = n.args.map((a) => evalNode(a, v));
      switch (n.name) {
        case 'min': return Math.min(...x);
        case 'max': return Math.max(...x);
        case 'clamp': return Math.max(x[1]!, Math.min(x[2]!, x[0]!));
        case 'pow': return Math.pow(x[0]!, x[1]!);
        case 'sqrt': return Math.sqrt(x[0]!);
        case 'ln': case 'log': return Math.log(x[0]!);
        case 'log10': return Math.log10(x[0]!);
        case 'log2': return Math.log2(x[0]!);
        case 'exp': return Math.exp(x[0]!);
        case 'abs': return Math.abs(x[0]!);
        case 'sign': return Math.sign(x[0]!);
        case 'floor': return Math.floor(x[0]!);
        case 'ceil': return Math.ceil(x[0]!);
        case 'round': return Math.floor(x[0]! + 0.5);
        case 'lerp': return x[0]! + (x[1]! - x[0]!) * x[2]!;
        case 'step': return x[1]! < x[0]! ? 0 : 1;
        default: {
          const t = Math.max(0, Math.min(1, (x[2]! - x[0]!) / (x[1]! - x[0]!)));
          return t * t * (3 - 2 * t);
        }
      }
    }
  }
}

class Parser {
  private i = 0;

  constructor(private readonly src: string, private readonly allowed: ReadonlySet<string>) {}

  parseAll(): Node {
    if (this.src.trim() === '') throw this.fail('empty expression');
    const n = this.ternary();
    this.ws();
    if (this.i < this.src.length) throw this.fail(`unexpected '${this.src[this.i]}'`);
    return n;
  }

  private ternary(): Node {
    const c = this.or();
    if (!this.eat('?')) return c;
    const a = this.ternary();
    if (!this.eat(':')) throw this.fail("expected ':'");
    return { k: 'tern', c, a, b: this.ternary() };
  }

  private or(): Node {
    let n = this.and();
    while (this.eat('||')) n = { k: 'bin', op: '||', a: n, b: this.and() };
    return n;
  }

  private and(): Node {
    let n = this.cmp();
    while (this.eat('&&')) n = { k: 'bin', op: '&&', a: n, b: this.cmp() };
    return n;
  }

  private cmp(): Node {
    const n = this.add();
    for (const op of COMPARISONS) if (this.eat(op)) return { k: 'bin', op, a: n, b: this.add() };
    return n;
  }

  private add(): Node {
    let n = this.mul();
    for (;;) {
      if (this.eat('+')) n = { k: 'bin', op: '+', a: n, b: this.mul() };
      else if (this.eat('-')) n = { k: 'bin', op: '-', a: n, b: this.mul() };
      else return n;
    }
  }

  private mul(): Node {
    let n = this.unary();
    for (;;) {
      if (this.eat('*')) n = { k: 'bin', op: '*', a: n, b: this.unary() };
      else if (this.eat('/')) n = { k: 'bin', op: '/', a: n, b: this.unary() };
      else if (this.eat('%')) n = { k: 'bin', op: '%', a: n, b: this.unary() };
      else return n;
    }
  }

  private unary(): Node {
    if (this.eat('-')) return { k: 'un', op: '-', a: this.unary() };
    if (this.eat('+')) return this.unary();
    if (this.peekIs('!') && !this.peekIs('!=')) {
      this.eat('!');
      return { k: 'un', op: '!', a: this.unary() };
    }
    return this.power();
  }

  private power(): Node {
    const n = this.primary();
    return this.eat('^') ? { k: 'bin', op: '^', a: n, b: this.unary() } : n;
  }

  private primary(): Node {
    this.ws();
    if (this.i >= this.src.length) throw this.fail('unexpected end');
    const c = this.src[this.i]!;
    if (c === '(') {
      this.i++;
      const n = this.ternary();
      if (!this.eat(')')) throw this.fail("expected ')'");
      return n;
    }
    if (/[0-9.]/.test(c)) return this.number();
    if (/[A-Za-z_]/.test(c)) {
      const start = this.i;
      while (this.i < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.i]!)) this.i++;
      const name = this.src.slice(start, this.i);
      if (this.eat('(')) return this.call(name, start);
      if (name === 'true') return { k: 'num', v: 1 };
      if (name === 'false') return { k: 'num', v: 0 };
      if (!this.allowed.has(name)) {
        this.i = start;
        throw this.fail(`unknown variable '${name}' (allowed: ${[...this.allowed].sort().join(', ')})`);
      }
      return { k: 'var', name };
    }
    throw this.fail(`unexpected '${c}'`);
  }

  private call(name: string, start: number): Node {
    const args: Node[] = [];
    if (!this.eat(')')) {
      do args.push(this.ternary()); while (this.eat(','));
      if (!this.eat(')')) throw this.fail("expected ')'");
    }
    const arity = ARITY[name];
    if (!arity) {
      this.i = start;
      throw this.fail(`unknown function '${name}'`);
    }
    if (args.length < arity[0] || args.length > arity[1]) {
      this.i = start;
      throw this.fail(`'${name}' takes ${arity[0] === arity[1] ? arity[0] : `${arity[0]}+`} argument(s), got ${args.length}`);
    }
    return { k: 'call', name, args };
  }

  private number(): Node {
    const start = this.i;
    while (this.i < this.src.length && /[0-9.]/.test(this.src[this.i]!)) this.i++;
    if (this.i < this.src.length && /[eE]/.test(this.src[this.i]!)) {
      const save = this.i;
      this.i++;
      if (/[+-]/.test(this.src[this.i] ?? '')) this.i++;
      if (/[0-9]/.test(this.src[this.i] ?? '')) {
        while (/[0-9]/.test(this.src[this.i] ?? '')) this.i++;
      } else this.i = save;
    }
    const text = this.src.slice(start, this.i);
    const v = Number(text);
    if (text === '' || !Number.isFinite(v) || (text.match(/\./g) ?? []).length > 1) {
      this.i = start;
      throw this.fail(`bad number '${text}'`);
    }
    return { k: 'num', v };
  }

  private ws(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i]!)) this.i++;
  }

  private peekIs(token: string): boolean {
    this.ws();
    return this.src.startsWith(token, this.i);
  }

  private eat(token: string): boolean {
    if (!this.peekIs(token)) return false;
    this.i += token.length;
    return true;
  }

  private fail(msg: string): SyntaxError {
    return new SyntaxError(`Invalid expression at ${this.i}: ${msg} in "${this.src}"`);
  }
}
