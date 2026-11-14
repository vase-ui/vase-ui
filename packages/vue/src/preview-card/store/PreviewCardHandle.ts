import { BasePopupHandle } from '../../utils/popups/popupHandle';
import { createNullPreviewCardStore } from './PreviewCardStore';
import type { PreviewCardHandleStore, PreviewCardStore } from './PreviewCardStore';

/**
 * Controls a PreviewCard imperatively and associates detached `PreviewCard.Trigger` components with
 * a `PreviewCard.Root`. Create one with `PreviewCard.createHandle()` and pass it to the `handle`
 * prop of the root and of any triggers rendered outside of it.
 *
 * The imperative methods take effect only while a root using this handle is mounted; calls made
 * before a root attaches (or after it unmounts) are ignored.
 */
export class PreviewCardHandle<Payload> extends BasePopupHandle<
  PreviewCardHandleStore<Payload>,
  PreviewCardStore<Payload>
> {
  constructor() {
    super(createNullPreviewCardStore<Payload>(), 'PreviewCard');
  }

  /**
   * Opens the preview card and associates it with the trigger with the given id.
   *
   * Call this method only in an event handler or an effect, and not in a render.
   *
   * @param triggerId ID of the trigger to associate with the preview card. The trigger must be a
   * matching `PreviewCard.Trigger` with this handle passed as a prop.
   */
  open(triggerId: string) {
    this.openByTrigger(triggerId);
  }

  /**
   * Closes the preview card.
   *
   * Call this method only in an event handler or an effect, and not in a render.
   */
  close() {
    this.closePopup();
  }

  /**
   * Whether the preview card is currently open. Returns `false` while no root is attached to the
   * handle. A `computed` that reads it follows the open state, and the attach and the detach of a
   * root.
   */
  get isOpen() {
    return this.attachedStore?.select('open') ?? false;
  }
}

/**
 * Creates a new handle to connect a PreviewCard.Root with detached PreviewCard.Trigger components.
 */
export function createPreviewCardHandle<Payload = unknown>(): PreviewCardHandle<Payload> {
  return new PreviewCardHandle<Payload>();
}
