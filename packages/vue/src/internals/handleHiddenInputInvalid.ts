/**
 * Chrome shows no native validation message for an input that has zero size. A hidden input with
 * no `name` has zero size (`visuallyHiddenInputPinned`). The browser sends `invalid` just before it
 * shows the message, so this handler grows the input to 1px at that time. Only an input that failed
 * validation gets the compositor layer of a 1px fixed input. An input that is 1px already does not
 * change.
 *
 * The write goes directly to the DOM, because the browser shows the message before the next Vue
 * flush. Base UI writes `width` and `height`. A Vue render writes each key of the style of the
 * input again, and it writes no other property. A size in `width` and `height` thus does not stay
 * after a render. The handler writes `min-width` and `min-height`, which no hidden input style
 * has. Give no hidden input a style with one of these two keys.
 */
export function handleHiddenInputInvalid(event: Event): void {
  const { style } = event.currentTarget as HTMLInputElement;
  style.minWidth = '1px';
  style.minHeight = '1px';
}
