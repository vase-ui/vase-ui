import { BasePopupHandle } from '../../utils/popups/popupHandle';
import { createNullPopoverStore } from './PopoverStore';
import type { PopoverHandleStore, PopoverStore } from './PopoverStore';

/**
 * Controls a Popover from code, and connects `Popover.Trigger` parts outside a `Popover.Root` to
 * that root. Make one with `Popover.createHandle()`. Give it to the `handle` prop of the root and
 * of each trigger outside the root.
 *
 * The methods work only while a root that uses this handle is mounted. A call before a root
 * attaches, or after it unmounts, does nothing.
 */
export class PopoverHandle<Payload> extends BasePopupHandle<
  PopoverHandleStore<Payload>,
  PopoverStore<Payload>
> {
  constructor() {
    super(createNullPopoverStore<Payload>(), 'Popover');
  }

  /**
   * Opens the popover and associates it with the trigger with the given id.
   *
   * Call this method in an event handler, a lifecycle hook or a watcher, not in `setup` or during
   * a render.
   *
   * @param triggerId ID of the trigger to associate with the popover. The trigger must be a
   * `Popover.Trigger` that has this handle as its `handle` prop.
   */
  open(triggerId: string) {
    this.openByTrigger(triggerId);
  }

  /**
   * Closes the popover.
   *
   * Call this method in an event handler, a lifecycle hook or a watcher, not in `setup` or during
   * a render.
   */
  close() {
    this.closePopup();
  }

  /**
   * Whether the popover is currently open. It is `false` while no root is attached to the handle.
   */
  get isOpen() {
    return this.attachedStore?.select('open') ?? false;
  }
}

/**
 * Creates a new handle to connect a Popover.Root with detached Popover.Trigger components.
 */
export function createPopoverHandle<Payload>(): PopoverHandle<Payload> {
  return new PopoverHandle<Payload>();
}
