import type { CSSProperties } from 'vue';

const visuallyHiddenBase: CSSProperties = {
  clipPath: 'inset(50%)',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  border: 0,
  padding: 0,
  width: '1px',
  height: '1px',
  margin: '-1px',
};

// Just above the viewport: many fixed elements of 1px inside it can make Chrome drop frames.
export const visuallyHidden: CSSProperties = {
  ...visuallyHiddenBase,
  position: 'fixed',
  margin: 0,
  top: '-1px',
  left: 0,
};

export const visuallyHiddenInput: CSSProperties = {
  ...visuallyHiddenBase,
  position: 'absolute',
};

// A hidden input with no name has zero size, so that Chrome gives it no compositor layer.
// It stays on screen. Then the native validation message shows when it grows to 1px on `invalid`.
export const visuallyHiddenInputPinned: CSSProperties = {
  ...visuallyHidden,
  width: 0,
  height: 0,
  top: 0,
};
