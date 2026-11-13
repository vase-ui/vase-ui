/**
 * Chrome shows no native validation message for an input that has zero size. A hidden input with
 * no `name` has zero size (`visuallyHiddenInputPinned`). The browser sends `invalid` just before it
 * shows the message, so this handler grows the input to 1px at that time. Only an input that failed
 * validation gets the compositor layer of a 1px fixed input. An input that is 1px already does not
 * change.
 *
 * The write goes directly to the DOM, because the browser shows the message before the next Vue
 * flush. Vue writes each key of a style again when the `style` object is not the object of the last
 * render, and the input then has zero size again. Give the input the style constant itself, and do
 * not merge it with another style.
 */
export function handleHiddenInputInvalid(event: Event): void {
  const { style } = event.currentTarget as HTMLInputElement;
  style.width = '1px';
  style.height = '1px';
}
