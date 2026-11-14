import type { AtRule, Node, Plugin, Rule } from 'postcss';

const COLOR_SCHEME_QUERY = /prefers-color-scheme/i;
const DARK_SCHEME_QUERY = /^\(\s*prefers-color-scheme\s*:\s*dark\s*\)$/i;

/** `:where()` adds no specificity, so the rule has the place in the cascade that the media rule had. */
const DARK_THEME_SELECTOR = ':where(.dark)';

function refuse(atRule: AtRule, problem: string): never {
  throw atRule.error(
    `${problem} It follows the color scheme of the system, but the site follows its theme switch. The plugin changes only "(prefers-color-scheme: dark)" inside a style rule. Add this form to postcssFollowSiteTheme.ts.`,
  );
}

function hasRuleAncestor(node: Node): boolean {
  for (let parent: Node['parent'] = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'rule') {
      return true;
    }
  }
  return false;
}

/** Moves `node` out of `parent`, between the nodes of `parent` that come before it and after it. */
function moveOutOf(parent: Rule | AtRule, node: AtRule): void {
  const rest = parent.clone({ nodes: [] });
  for (let next = node.next(); next; next = node.next()) {
    rest.append(next);
  }
  parent.after(node);
  if (rest.nodes?.length) {
    node.after(rest);
  }
  if (parent.nodes?.length === 0) {
    parent.remove();
  }
}

/**
 * Changes each `@media (prefers-color-scheme: dark)` rule into a rule for the class `dark` of the
 * root element, which VitePress sets from the theme switch. A copied style sheet of a Base UI demo
 * follows the color scheme of the system, and the file does not change. With this plugin, the demo
 * on the site follows the theme of the site.
 */
export function postcssFollowSiteTheme(): Plugin {
  return {
    postcssPlugin: 'vase-ui-follow-site-theme',
    // The CSS Modules plugin of Vite renames each class in its `OnceExit`. Vite puts that plugin
    // first, so this plugin runs after it, and the class `dark` keeps its name.
    OnceExit(root, { Rule: StyleRule }) {
      const mediaRules: AtRule[] = [];
      root.walkAtRules('media', (atRule) => {
        if (COLOR_SCHEME_QUERY.test(atRule.params)) {
          mediaRules.push(atRule);
        }
      });
      for (const atRule of mediaRules) {
        if (!DARK_SCHEME_QUERY.test(atRule.params)) {
          refuse(
            atRule,
            `The media query "${atRule.params}" is not "(prefers-color-scheme: dark)".`,
          );
        }
        // An at-rule between the media rule and its style rule goes inside the media rule.
        for (let parent = atRule.parent; parent?.type === 'atrule'; parent = atRule.parent) {
          const parentCopy = parent.clone({ nodes: [] });
          parentCopy.append(atRule.nodes);
          moveOutOf(parent, atRule);
          atRule.append(parentCopy);
        }
        const parent = atRule.parent;
        if (parent?.type !== 'rule') {
          refuse(atRule, `The media query "${atRule.params}" is not inside a style rule.`);
        }
        const nested = hasRuleAncestor(parent);
        const selectors = parent.selectors.map((selector) =>
          nested && !selector.includes('&')
            ? `${DARK_THEME_SELECTOR} & ${selector}`
            : `${DARK_THEME_SELECTOR} ${selector}`,
        );
        moveOutOf(parent, atRule);
        atRule.replaceWith(
          new StyleRule({ selectors, nodes: atRule.nodes, source: atRule.source }),
        );
      }
    },
  };
}
