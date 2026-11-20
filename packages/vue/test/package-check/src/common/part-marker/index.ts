export function markPart(): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('package-check development marker');
  }
}
