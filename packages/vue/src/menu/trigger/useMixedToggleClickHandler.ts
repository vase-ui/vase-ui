import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { ownerDocument } from '../../common/owner';
import type { VaseUIEvent } from '../../internals/types';

/**
 * Returns `click` and `mousedown` handlers that fix the behavior of triggers of popups that are toggled by different events.
 * For example, a button that opens a popup on mousedown and closes it on click.
 * This composable prevents the popup from closing immediately after the mouse button is released.
 *
 * Call it in `setup`. It makes the object of listeners one time, and each listener returns while
 * the composable is not enabled.
 */
export function useMixedToggleClickHandler(params: UseMixedToggleClickHandlerParameters) {
  const { enabled, mouseDownAction, open } = params;
  let ignoreClick = false;

  const isEnabled = () => toValue(enabled) ?? true;

  return {
    onMousedown(event: MouseEvent) {
      if (!isEnabled()) {
        return;
      }

      const isOpen = toValue(open);
      if ((mouseDownAction === 'open' && !isOpen) || (mouseDownAction === 'close' && isOpen)) {
        ignoreClick = true;

        ownerDocument(event.currentTarget as Element).addEventListener(
          'click',
          () => {
            ignoreClick = false;
          },
          { once: true },
        );
      }
    },
    onClick(event: VaseUIEvent<MouseEvent>) {
      if (!isEnabled()) {
        return;
      }

      if (ignoreClick) {
        ignoreClick = false;
        event.preventVaseUIHandler();
      }
    },
  };
}

export interface UseMixedToggleClickHandlerParameters {
  /**
   * Whether the mixed toggle click handler is enabled. It is a value, a ref or a getter.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Determines what action is performed on mousedown.
   */
  mouseDownAction: 'open' | 'close';
  /**
   * The current open state of the popup. It is a value, a ref or a getter.
   */
  open: MaybeRefOrGetter<boolean>;
}
