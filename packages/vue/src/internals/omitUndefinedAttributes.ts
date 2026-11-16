/**
 * Returns a copy of the attributes of the consumer without each attribute whose value is
 * `undefined`.
 * Vue gives a declared prop its default when the value is `undefined`. An attribute follows the
 * same rule: `undefined` keeps the value of the part, and `null` removes it (`VUE-103`).
 */
export function omitUndefinedAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  const definedAttrs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) {
      definedAttrs[key] = value;
    }
  }
  return definedAttrs;
}
