import type { OTPFieldRootValidationType } from './types';

/** What a root gives a code. */
export interface CodeRules {
  readonly length: number;
  readonly validationType: OTPFieldRootValidationType;
  readonly normalizeValue?: ((value: string) => string) | undefined;
}

const types = {
  numeric: { refused: /\D/g, character: '\\d', inputmode: 'numeric' },
  alpha: { refused: /[^a-zA-Z]/g, character: '[a-zA-Z]', inputmode: 'text' },
  alphanumeric: { refused: /[^a-zA-Z0-9]/g, character: '[a-zA-Z0-9]', inputmode: 'text' },
  none: { refused: undefined, character: '.', inputmode: undefined },
} as const;

function filter(text: string, type: OTPFieldRootValidationType) {
  const refused = types[type].refused;
  return refused ? text.replace(refused, '') : text;
}

/**
 * The code of a text: the text with no white space, with only the characters of the type, after
 * the normalizer, and with at most `length` characters. A character is one code point. `refused`
 * says that a filter, the normalizer or the length removed characters.
 */
export function toCode(text: string | null | undefined, rules: CodeRules) {
  const plain = (text ?? '').replaceAll(/\s/g, '');
  let accepted = filter(plain, rules.validationType);
  let refused = accepted.length < plain.length;
  if (rules.normalizeValue) {
    const normalized = rules.normalizeValue(accepted);
    refused ||= Array.from(normalized).length < Array.from(accepted).length;
    accepted = filter(normalized, rules.validationType);
    refused ||= accepted.length < normalized.length;
  }
  const characters = Array.from(accepted);
  const length = Math.max(rules.length, 0);
  return {
    code: characters.slice(0, length).join(''),
    refused: refused || characters.length > length,
  };
}

/** Writes the characters of `accepted`, a code, over the code from the slot `index` on. */
export function writeAt(code: string, index: number, accepted: string, rules: CodeRules) {
  const characters = Array.from(code);
  const added = Array.from(accepted);
  characters.splice(index, added.length, ...added);
  return toCode(characters.join(''), rules).code;
}

/** Removes the character of the slot `index`. The later characters move one slot to the start. */
export function removeAt(code: string, index: number) {
  const characters = Array.from(code);
  characters.splice(index, 1);
  return characters.join('');
}

/** The `pattern` of a whole code. */
export function patternOf(type: OTPFieldRootValidationType, length: number) {
  return `${types[type].character}{${length}}`;
}

/** The keyboard of a type. */
export function inputmodeOf(type: OTPFieldRootValidationType) {
  return types[type].inputmode;
}
