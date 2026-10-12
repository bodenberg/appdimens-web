/**
 * webdimens/postcss — write dimension units directly in CSS files (build time, zero runtime cost).
 *
 *   // postcss.config.js
 *   import webdimens from 'webdimens/postcss';
 *   export default { plugins: [webdimens()] };
 *
 *   .card {
 *     padding: 8sdp 16sdp;                     → calc(8 * var(--sdp)) calc(16 * var(--sdp))
 *     font-size: 14ssp;
 *     @dimen landscape { padding: 12sdp 24sdp; }
 *     @dimen sw600 { padding: 32sdp; }         → @media (min-width:600px) and (min-height:600px)
 *     @dimen tv { font-size: 28ssp; }          → :root[data-ad-mode="tv"] .card
 *   }
 *
 * No dependency on postcss itself (PostCSS 8 plugin object). Conditions and priorities are
 * the same as the class syntax: mode + qualifier > mode > qualifier > orientation.
 */
import { mediaOf, orderOf, parseConditions, rootPrefix } from './core/declarative';
import { dimenCss } from './core/tokens';

export interface WebDimensPostcssOptions {
  /** Name of the conditional at-rule. Default `dimen`. */
  atRule?: string;
}

/* Minimal structural types of the PostCSS 8 nodes this plugin touches. */
interface PcssNode {
  type: string;
  parent?: PcssContainer;
  remove(): void;
  clone(overrides?: Record<string, unknown>): PcssNode;
}
interface PcssContainer extends PcssNode {
  nodes?: PcssNode[];
  selectors?: string[];
  selector?: string;
  append(...nodes: PcssNode[]): void;
  after(node: PcssNode | PcssNode[]): void;
}
interface PcssDecl extends PcssNode {
  prop: string;
  value: string;
}
interface PcssAtRule extends PcssContainer {
  name: string;
  params: string;
}
interface Helpers {
  Rule: new (props: { selector?: string; selectors?: string[] }) => PcssContainer;
  AtRule: new (props: { name: string; params: string }) => PcssContainer;
}

export default function webdimens(options: WebDimensPostcssOptions = {}) {
  const atName = options.atRule ?? 'dimen';
  return {
    postcssPlugin: 'webdimens',
    Declaration(decl: PcssDecl) {
      const next = dimenCss(decl.value);
      if (next !== decl.value) decl.value = next;
    },
    AtRule: {
      [atName](at: PcssAtRule, { Rule, AtRule }: Helpers) {
        const parent = at.parent;
        if (!parent || parent.type !== 'rule' || !parent.selectors) {
          throw new Error(`webdimens: @${atName} must be nested inside a style rule`);
        }
        const conditions = parseConditions(at.params.split(/\s+/));
        if (!conditions) throw new Error(`webdimens: unknown condition in "@${atName} ${at.params}"`);
        const prefix = rootPrefix(conditions);
        const rule = new Rule({ selectors: parent.selectors.map((s) => prefix + s) });
        for (const node of at.nodes ?? []) {
          const copy = node.clone() as PcssDecl;
          if (copy.type === 'decl') copy.value = dimenCss(copy.value);
          rule.append(copy);
        }
        const media = mediaOf(conditions);
        let out: PcssContainer = rule;
        if (media) {
          out = new AtRule({ name: 'media', params: media });
          out.append(rule);
        }
        (out as PcssContainer & { __adOrder?: number }).__adOrder = orderOf(conditions);
        // Keep generated blocks of the same parent in Android priority order.
        let anchor: PcssNode = parent;
        const siblings = parent.parent?.nodes ?? [];
        for (let i = siblings.indexOf(parent) + 1; i < siblings.length; i++) {
          const sib = siblings[i] as PcssContainer & { __adOrder?: number; __adParent?: PcssNode };
          if (sib.__adParent !== parent || (sib.__adOrder ?? 0) > orderOf(conditions)) break;
          anchor = sib;
        }
        (out as PcssContainer & { __adParent?: PcssNode }).__adParent = parent;
        (anchor as PcssContainer).after(out);
        at.remove();
        if (parent.nodes && parent.nodes.length === 0) parent.remove();
      },
    },
  };
}
webdimens.postcss = true as const;
