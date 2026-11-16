/** The words that a Base UI page can show as a badge on a heading: `HEADING_TAGS` in the Base UI docs. */
export const HEADING_BADGES = ['New', 'Preview'] as const;
export type HeadingBadge = (typeof HEADING_BADGES)[number];

const TRAILING_BADGES = HEADING_BADGES.map((badge) => ({
  badge,
  pattern: new RegExp(`\\s+\\[${badge}\\]\\s*$`),
}));

/**
 * Splits the badge from the end of the text of a heading, as `splitTrailingHeadingTag` of the Base
 * UI docs does. Each other text in brackets stays in the heading. So does a text that is only the
 * badge, because the badge needs white space before it.
 */
export function splitHeadingBadge(text: string): { text: string; badge: HeadingBadge } | undefined {
  for (const { badge, pattern } of TRAILING_BADGES) {
    const found = pattern.exec(text);
    if (found) {
      return { text: text.slice(0, found.index), badge };
    }
  }
  return undefined;
}
