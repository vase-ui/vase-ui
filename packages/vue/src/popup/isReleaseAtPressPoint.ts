/**
 * The largest move of a pointer between its press and its release, in CSS pixels on each axis,
 * that is not a drag. `Select.Item` of Base UI takes 8 px of vertical travel as the start of a drag
 * across its items. The value is less than half of the smallest target of WCAG 2.2 (24 px). A
 * pointer that moves this distance or less from the center of an item of that size stays on that
 * item.
 */
const PRESS_POINT_TOLERANCE = 8;

/**
 * Whether a release comes within `PRESS_POINT_TOLERANCE` of its press on each axis. A trigger can
 * move in the frame in which its popup opens. The release of a press that did not move then lands
 * on another element. The client coordinates of a pointer that holds still do not change when the
 * page scrolls.
 */
export function isReleaseAtPressPoint(
  press: Pick<MouseEvent, 'clientX' | 'clientY'>,
  release: MouseEvent,
): boolean {
  return (
    Math.abs(release.clientX - press.clientX) <= PRESS_POINT_TOLERANCE &&
    Math.abs(release.clientY - press.clientY) <= PRESS_POINT_TOLERANCE
  );
}
