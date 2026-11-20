export function serializeValue(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- `String` is the last resort for a value that `JSON.stringify` refuses, such as a circular object or a `bigint`.
    return String(value);
  }
}
