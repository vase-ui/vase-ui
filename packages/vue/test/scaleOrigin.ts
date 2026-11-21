/** The point that a scale of `element` about `var(--transform-origin)` keeps in its place. */
export function scaleOrigin(element: HTMLElement) {
  element.style.transformOrigin = 'var(--transform-origin)';
  const before = element.getBoundingClientRect();
  element.style.scale = '0.5';
  const after = element.getBoundingClientRect();
  element.style.scale = '';
  return { x: 2 * after.left - before.left, y: 2 * after.top - before.top };
}
