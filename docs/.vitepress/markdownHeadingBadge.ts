import type { MarkdownRenderer } from 'vitepress';

// These are the words of `HEADING_TAGS` in the Base UI docs. Each other text in brackets stays in
// the heading.
const TRAILING_BADGE = /\s+\[(New|Preview)\]\s*$/;

/**
 * Shows the `[New]` or `[Preview]` at the end of a heading of level 2 to 6 as a badge, as the Base UI
 * docs do. The slug of the heading, its permalink label and the outline do not have the word.
 */
export function markdownHeadingBadge(md: MarkdownRenderer): void {
  // The rule of the anchor plugin makes the slug and the permalink label from the tokens of the
  // heading.
  md.core.ruler.before('anchor', 'heading_badge', (state) => {
    for (const [index, token] of state.tokens.entries()) {
      if (token.type !== 'heading_open' || token.tag === 'h1') {
        continue;
      }
      const children = state.tokens[index + 1]?.children;
      const last = children?.at(-1);
      if (!children || last?.type !== 'text') {
        continue;
      }
      const found = TRAILING_BADGE.exec(last.content);
      if (!found) {
        continue;
      }
      last.content = last.content.slice(0, found.index);
      // The anchor plugin leaves an `html_inline` token out of the slug and of the permalink label.
      // The outline of the default theme leaves out an element with the class `ignore-header`.
      const badge = new state.Token('html_inline', '', 0);
      badge.content = ` <span class="heading-badge ignore-header">${found[1]}</span>`;
      children.push(badge);
    }
  });
}
