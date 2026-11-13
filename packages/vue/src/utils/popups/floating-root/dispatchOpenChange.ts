import type { VaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';
import { isClickLikeEvent } from '../event';
import type { PopupInteractionContext } from '../types';

/**
 * Tells the interaction composables of a popup about an accepted open change. It records the event
 * that opened the popup. Then it emits `openchange`.
 *
 * @param context The context of the store that the interaction composables read.
 * @param open Whether the popup is open before the change.
 * @param newOpen Whether the popup is open after the change.
 * @param eventDetails Details about the event that caused the change.
 */
export function dispatchOpenChange(
  context: Pick<PopupInteractionContext, 'openEvent' | 'events' | 'nested'>,
  open: boolean,
  newOpen: boolean,
  eventDetails: VaseUIChangeEventDetails<string>,
) {
  const event = eventDetails.event;

  // The open event lets the hover logic tell a hover open from a click open. A hover open that
  // waits must not replace the event of a click open. A click can replace the event of a hover
  // open.
  if (!newOpen || !open || (event != null && isClickLikeEvent(event))) {
    context.openEvent = newOpen ? event : undefined;
  }

  const details: FloatingUIOpenChangeDetails = {
    open: newOpen,
    reason: eventDetails.reason,
    nativeEvent: event,
    nested: context.nested,
    triggerElement: eventDetails.trigger,
  };

  context.events.emit('openchange', details);
}
