import type { MarkdownRenderer } from 'vitepress';

const START = '<!-- lower-headings -->';
const END = '<!-- /lower-headings -->';

/**
 * Lowers each heading between the lines `<!-- lower-headings -->` and `<!-- /lower-headings -->` by
 * one level. A page puts these lines around an include of a file whose first headings have the
 * level of the page heading above the include, such as `CHANGELOG.md`.
 */
export function markdownLowerHeadings(md: MarkdownRenderer): void {
  // The rules that read the level of a heading, such as the anchor rule, run after `block`.
  md.core.ruler.after('block', 'lower_headings', (state) => {
    let lowered = false;
    state.tokens = state.tokens.filter((token) => {
      const marker = token.type === 'html_block' ? token.content.trim() : undefined;
      if (marker === START || marker === END) {
        lowered = marker === START;
        return false;
      }
      if (lowered && (token.type === 'heading_open' || token.type === 'heading_close')) {
        const level = Number(token.tag.slice(1));
        if (level === 6) {
          throw new Error(
            `${String(state.env.relativePath)}: a heading of level 6 is between "${START}" and "${END}". HTML has no heading of level 7. Raise the heading in its file.`,
          );
        }
        token.tag = `h${String(level + 1)}`;
      }
      return true;
    });
  });
}
