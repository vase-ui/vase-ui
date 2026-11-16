import { Lexer, walkTokens } from 'marked';

/**
 * A name that GitHub can read as an account: an at sign that is not after a letter, a digit, `_` or
 * `/`, then letters, digits and hyphens that no `/` follows. `@vase-ui/vue` is thus a package name.
 */
const MENTION = /(?<![\w/])@[a-z\d](?:[a-z\d-]*[a-z\d])?(?![\w/-])/gi;

/**
 * The account names with an at sign in the text of a Markdown file. Code spans, code blocks and
 * HTML are not text.
 */
export function mentionsOf(markdown: string): string[] {
  const mentions: string[] = [];
  // `walkTokens` gives the result of each call of the function, and its type allows a promise.
  void walkTokens(new Lexer().lex(markdown), (token) => {
    // A `text` token of a block, such as a list item, holds its text again in `tokens`.
    if (token.type === 'text' && token.tokens === undefined) {
      mentions.push(...(token.raw.match(MENTION) ?? []));
    }
  });
  return mentions;
}
