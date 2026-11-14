import type { CSSProperties } from 'vue';

export const CLICK_TRIGGER_IDENTIFIER = 'data-vase-ui-click-trigger';

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
