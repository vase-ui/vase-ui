import type { MenuRootOrientation } from '../root/MenuRoot.vue';
import { isMainOrientationKey } from '../../utils/popups/interactions/useListNavigation';

/**
 * Whether a key moves the highlight of a list with the orientation `orientation`, and no modifier
 * or IME composition changes what the key does.
 */
export function isPlainMainOrientationKey(
  event: KeyboardEvent,
  orientation: MenuRootOrientation | 'both' | undefined,
) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Base UI reads `which` to find the key of an IME composition.
    event.which !== 229 &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    isMainOrientationKey(event.key, orientation)
  );
}
