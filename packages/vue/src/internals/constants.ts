import type { CSSProperties } from 'vue';

export const VASE_UI_SWIPE_IGNORE_ATTRIBUTE = 'data-vase-ui-swipe-ignore';
export const LEGACY_SWIPE_IGNORE_ATTRIBUTE = 'data-swipe-ignore';

export const VASE_UI_SWIPE_IGNORE_SELECTOR = `[${VASE_UI_SWIPE_IGNORE_ATTRIBUTE}]`;
export const LEGACY_SWIPE_IGNORE_SELECTOR = `[${LEGACY_SWIPE_IGNORE_ATTRIBUTE}]`;

/**
 * The style of the `aria-owns` owner element. The element is an empty `span`, so it needs fewer
 * declarations than `visuallyHidden`. With these declarations, iOS, Safari and VoiceControl still
 * find the element that the owner owns.
 * @see https://github.com/floating-ui/floating-ui/issues/3403
 */
export const ownerVisuallyHidden: CSSProperties = {
  clipPath: 'inset(50%)',
  position: 'fixed',
  top: 0,
  left: 0,
};
