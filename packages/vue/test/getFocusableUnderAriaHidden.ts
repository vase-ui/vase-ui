/**
 * Returns each element of the document that has a `tabIndex` of 0 or more and that has
 * `aria-hidden="true"` on itself or on an ancestor. A screen reader does not announce such an
 * element, but the Tab key can put the focus on it.
 */
export function getFocusableUnderAriaHidden() {
  return [...document.querySelectorAll<HTMLElement>('[aria-hidden="true"]')]
    .flatMap((element) => [element, ...element.querySelectorAll<HTMLElement>('*')])
    .filter((element) => element.tabIndex >= 0);
}
