export function randomStringValue(): string {
  return `s${Math.random().toString(36).slice(2)}`;
}
