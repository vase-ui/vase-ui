/** The elements that can be a tab stop. `isTabbable` tells which of them are. */
export const CANDIDATES =
  'a[href],area[href],button,input:not([type="hidden"]),select,textarea,iframe,summary,details,audio[controls],video[controls],[tabindex],[contenteditable]:not([contenteditable="false"])';

/**
 * The tab stops in the container, in the order of the document: each focusable element with a
 * `tabIndex` of 0 or more that is not disabled, not inert and shown, and one radio of a group. The
 * elements in `skipped` are none.
 */
export function tabbables(container: Element, skipped?: Element): HTMLElement[] {
  const collected = [...walk(container)];
  const found = skipped ? collected.filter((element) => !skipped.contains(element)) : collected;
  return found.filter((element) => {
    if (!isNamedRadio(element)) return true;
    const group = found.filter(
      (other): other is HTMLInputElement =>
        isNamedRadio(other) && other.name === element.name && other.form === element.form,
    );
    return element === (group.find((radio) => radio.checked) ?? group[0]);
  });
}

/** The container holds a tab stop. The walk stops at the first one. */
export function hasTabStop(container: Element): boolean {
  return !walk(container).next().done;
}

// The content of an open shadow root takes the place of its host in the order.
function* walk(container: Element | ShadowRoot): Generator<HTMLElement> {
  for (const element of container.querySelectorAll<HTMLElement>('*')) {
    if (element.matches(CANDIDATES) && isTabbable(element)) yield element;
    if (element.shadowRoot) yield* walk(element.shadowRoot);
  }
}

// A browser gives an editable element and a media element with controls the `tabIndex` -1, and its
// Tab key reaches them.
function tabIndexOf(element: HTMLElement) {
  const reached =
    !element.hasAttribute('tabindex') &&
    (element.isContentEditable || /^(?:audio|video)$/.test(element.localName));
  return reached ? 0 : element.tabIndex;
}

/** A candidate is a tab stop: its `tabIndex` is 0 or more, and it is not disabled, inert or hidden. */
export function isTabbable(element: HTMLElement) {
  return (
    tabIndexOf(element) >= 0 &&
    !element.matches(':disabled') &&
    !element.closest('[inert]') &&
    element.checkVisibility({ checkVisibilityCSS: true })
  );
}

function isNamedRadio(element: HTMLElement): element is HTMLInputElement {
  const input = element as HTMLInputElement;
  return element.localName === 'input' && input.type === 'radio' && !!input.name;
}
