import { getFocusGuardAttributes, isFocusGuardButton } from './focusGuardAttributes';

/**
 * Makes the element of `FocusGuard.vue` with no component, for a guard that script keeps beside
 * the element of a part. See `useElementSiblings`. Call it only in a browser, after the mount.
 */
export function createFocusGuardElement(document: Document): HTMLSpanElement {
  const guard = document.createElement('span');
  const { style, ...attributes } = getFocusGuardAttributes(isFocusGuardButton());
  Object.assign(guard.style, style);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      guard.setAttribute(name, String(value));
    }
  }
  return guard;
}
