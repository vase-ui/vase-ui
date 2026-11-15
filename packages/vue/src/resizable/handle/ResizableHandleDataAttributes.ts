/**
 * Indicates the orientation of the panels. The `aria-orientation` of the handle is the other one.
 * @type {'horizontal' | 'vertical'}
 */
export const orientation = 'data-orientation';
/**
 * Present when the handle or the root is disabled.
 */
export const disabled = 'data-disabled';
/**
 * Present while the user drags the handle.
 */
export const dragging = 'data-dragging';
/**
 * Present when the handle cannot move to the left, or up in a vertical root. The side is a side of
 * the screen.
 */
export const atMin = 'data-at-min';
/**
 * Present when the handle cannot move to the right, or down in a vertical root. The side is a side
 * of the screen.
 */
export const atMax = 'data-at-max';
