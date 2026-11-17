/**
 * Chrome shows no native validation message for an input that has zero size. A hidden input with
 * no `name` has zero size (`visuallyHiddenInputPinned`). The browser sends `invalid` just before it
 * shows the message, so this handler grows the input to 1px at that time. Only an input that failed
 * validation gets the compositor layer of a 1px fixed input. An input that is 1px already does not
 * change.
 *
 * The write goes directly to the DOM, because the browser shows the message before the next Vue
 * flush. Base UI writes `width` and `height`. Vue writes each key of the style of the input again
 * in a render, and the input then has zero size again. Vue writes only the keys that the style
 * has, so the handler writes `min-width` and `min-height`. Give no hidden input a style with one
 * of these two keys.
 */
export function handleHiddenInputInvalid(event: Event): void {
  const { style } = event.currentTarget as HTMLInputElement;
  style.minWidth = '1px';
  style.minHeight = '1px';
}
