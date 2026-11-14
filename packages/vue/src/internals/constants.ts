import type { CSSProperties } from 'vue';

export const DISABLED_TRANSITIONS_STYLE = { style: { transition: 'none' } };

/**
 * Used for dropdowns that usually strictly prefer top/bottom placements and
 * use `var(--available-height)` to limit their height.
 */
export const DROPDOWN_COLLISION_AVOIDANCE = {
  fallbackAxisSide: 'none',
} as const;

/**
 * Used by regular popups that usually aren't scrollable and are allowed to
 * freely flip to any axis of placement.
 */
export const POPUP_COLLISION_AVOIDANCE = {
  fallbackAxisSide: 'end',
} as const;

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
