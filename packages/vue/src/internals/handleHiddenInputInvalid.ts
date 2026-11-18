/**
 * Chrome needs a nonzero input size to show its validation message. The browser displays it before the next Vue patch.
 * The hidden input binds its width and height. Reserve the minimum size for this handler so it survives a patch.
 */
export function handleHiddenInputInvalid(event: Event): void {
  const { style } = event.currentTarget as HTMLInputElement;
  style.minWidth = '1px';
  style.minHeight = '1px';
}
