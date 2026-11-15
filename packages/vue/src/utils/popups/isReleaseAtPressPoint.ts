import { BOUNDARY_OFFSET } from '../getPseudoElementBounds';

/**
 * Whether a release comes within `BOUNDARY_OFFSET` of its press on each axis, the tolerance of
 * `isMouseWithinBounds`. A trigger can move in the frame in which its popup opens. The release of
 * a press that did not move then lands on another element. The client coordinates of a pointer
 * that holds still do not change when the page scrolls.
 */
export function isReleaseAtPressPoint(press: MouseEvent, release: MouseEvent): boolean {
  return (
    Math.abs(release.clientX - press.clientX) <= BOUNDARY_OFFSET &&
    Math.abs(release.clientY - press.clientY) <= BOUNDARY_OFFSET
  );
}
