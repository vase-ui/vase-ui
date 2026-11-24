export type TextPiece =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

export const SITE_HOMEPAGE = 'https://vase-ui.com/';

const ADDRESS = /(https:\/\/\S*[^\s.,:;)])/;

export function splitTextWithCode(text: string): TextPiece[] {
  return text.split('`').flatMap((piece, index): TextPiece[] => {
    if (index % 2 === 1) {
      return [{ kind: 'code', text: piece }];
    }
    return piece.split(ADDRESS).flatMap((part, partIndex): TextPiece[] => {
      if (part === '') {
        return [];
      }
      if (partIndex % 2 === 1) {
        const href = part.startsWith(SITE_HOMEPAGE) ? `/${part.slice(SITE_HOMEPAGE.length)}` : part;
        return [{ kind: 'link', text: part, href }];
      }
      return [{ kind: 'text', text: part }];
    });
  });
}
