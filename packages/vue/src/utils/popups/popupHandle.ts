import { exposePopupBindings } from './popupBindings';
import { hasInjectionContext, inject, markRaw, shallowRef } from 'vue';
import type { InjectionKey, ShallowRef } from 'vue';
import { AnimationFrame } from '../../common/useAnimationFrame';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { PopupTriggerMap } from './usePopupRoot';

let readingTrigger: object | undefined;

export function readTriggerStore<Store>(handle: PopupHandleStoreProvider<Store>): Store {
  const previous = readingTrigger;
  readingTrigger = handle;
  try {
    return handle.store;
  } finally {
    readingTrigger = previous;
  }
}

/**
 * The minimal store contract that a popup handle gives to a detached trigger.
 *
 * A detached trigger reads `store` in a `computed`. The `computed` follows the handle when the
 * handle starts or stops pointing at the store of a root.
 *
 * @template HandleStore The store shape that a detached trigger sees.
 */
export interface PopupHandleStoreProvider<HandleStore> {
  /**
   * The store that the handle gives now.
   */
  readonly store: HandleStore;

  /**
   * The inert store of the handle. A trigger reads it on a server and while it hydrates, so that
   * its first render is equal to the server HTML.
   * @internal
   */
  readonly serverStore: HandleStore;
}

/**
 * The store shape that holds a trigger map. `BasePopupHandle.openByTrigger` needs it to find a
 * trigger element by id in the store of the attached root and in the inert store.
 */
export interface PopupHandleStoreWithTriggers {
  readonly context: { readonly triggerElements: PopupTriggerMap };
}

/**
 * The store shape that `BasePopupHandle.openByTrigger` and `closePopup` need to change the open
 * state. Only the store of a root needs it. The view that a detached trigger sees can omit
 * `setOpen`, because no call reaches it while the handle has no root.
 */
export interface PopupHandleStoreWithOpen extends PopupHandleStoreWithTriggers {
  setOpen(
    open: boolean,
    eventDetails: VaseUIChangeEventDetails<typeof REASONS.imperativeAction>,
  ): void;
}

/**
 * Keeps `call`, a call of `handle`, for a popup root of that handle above the part that makes the
 * call, while `KeepAlive` holds the root and its store is detached. The root runs `call` after its
 * activation. Returns whether a root kept the call.
 */
export type TakeHeldRootCall = (handle: object, call: () => void) => boolean;

/**
 * Gives a part the `TakeHeldRootCall` of the nearest popup root above it. A root gives a call of
 * another handle to the root above it.
 */
export const HeldRootCallContext: InjectionKey<TakeHeldRootCall> = Symbol('HeldRootCallContext');

/**
 * The base of the popup handles. A handle connects detached triggers to a mounted root.
 *
 * A subclass adds the imperative methods of its component. This class holds the inert store, the
 * stack of the attached root stores, the pointer to the store that controls the handle and the
 * development warning for overlapping roots.
 *
 * All apps and all server requests can share a handle that a module makes. A server writes nothing
 * to it, because a root attaches its store in a post-flush effect, which a server does not run.
 *
 * @template HandleStore The store shape that a detached trigger sees.
 * @template Store The store that the root of the component attaches.
 */
export class BasePopupHandle<
  HandleStore extends PopupHandleStoreWithTriggers,
  Store extends HandleStore & PopupHandleStoreWithOpen,
> {
  /**
   * The stores of all roots that use this handle, in the order of the attach. A handle is for one
   * mounted root, but roots can overlap for a short time, for example during an animated route
   * transition. When a newer root detaches first, this stack lets the cleanup of `attachStore`
   * return control to the older root that is still mounted.
   */
  readonly #attachedStores: Store[] = [];

  /**
   * The store of the root that controls the handle: the newest root that is still mounted, or
   * `null` when no root is attached. The imperative methods do nothing while it is `null`. A
   * `computed` that reads the handle follows each change of this ref.
   */
  // For a type parameter, the return type of `shallowRef<Store | null>()` is a conditional type that
  // TypeScript does not resolve, and `.value` is then `any`. The annotation keeps `Store | null`.
  readonly #attachedStoreRef: ShallowRef<Store | null> = shallowRef(null);

  protected readonly fallbackStore: HandleStore;

  readonly #componentName: string;

  readonly #throwOnMissingTrigger: boolean;

  /**
   * The frame of the development warning for overlapping roots. Only a development build makes it,
   * on the first overlap.
   */
  #overlapWarningFrame: AnimationFrame | undefined;

  /**
   * @param fallbackStore The inert, closed store that a detached trigger gets while no root is
   * attached. A trigger registers in the store that `store` gives, so a detached trigger is in the
   * trigger map of this store until a root attaches. It then moves to the store of the root, and
   * back when the root detaches.
   * @param componentName The name of the component. It starts the method names in the warnings:
   * `'Menu'` gives `MenuHandle.open()`.
   * @param throwOnMissingTrigger Whether `open(triggerId)` throws when no trigger has that id.
   * Menu, Popover, Tooltip and Preview Card are anchored, so they need a trigger and they throw.
   * Dialog is not anchored. It opens with no trigger and warns in a development build.
   */
  constructor(fallbackStore: HandleStore, componentName: string, throwOnMissingTrigger = true) {
    this.fallbackStore = fallbackStore;
    this.#componentName = componentName;
    this.#throwOnMissingTrigger = throwOnMissingTrigger;
    // A consumer can put the handle in `ref()`, `reactive()`, `readonly()` or the `data` option. A
    // method that reads a private member throws a `TypeError` on a proxy of the handle.
    markRaw(this);
  }

  /**
   * The store of the root that controls the handle, or `null`. This read depends on the pointer. A
   * getter that reads it, such as `isOpen`, then follows each change of the pointer.
   */
  protected get attachedStore() {
    return this.#attachedStoreRef.value;
  }

  /**
   * The store of the newest attached root, or `null`. This read has no dependency, because the
   * list of the stores is a plain array. A method that an event handler or an effect calls reads
   * it. An effect that calls `open()` or `close()` then does not run again when a root attaches or
   * detaches.
   */
  protected get attachedStoreUntracked() {
    return this.#attachedStores.at(-1) ?? null;
  }

  /**
   * The store that a detached trigger reads: the store of the attached root, or the inert store
   * while no root is attached.
   * @internal
   */
  get store(): HandleStore {
    const store = this.#attachedStoreRef.value ?? this.fallbackStore;
    // A trigger reads the same getter as a consumer but takes its bindings directly from the root.
    if (readingTrigger !== this) {
      exposePopupBindings(store);
    }
    return store;
  }

  /**
   * The inert store, for a server render and for a hydration. A handle can be shared by concurrent
   * server requests, so a server never records the store of a root on it.
   * @internal
   */
  get serverStore(): HandleStore {
    return this.fallbackStore;
  }

  /**
   * Points the handle at the store of a root. A detached trigger follows the pointer and registers
   * again in that store. Returns the function that detaches the store.
   * @internal
   */
  attachStore(newStore: Store) {
    this.#attachedStores.push(newStore);
    this.#attachedStoreRef.value = newStore;

    if (process.env.NODE_ENV !== 'production') {
      if (this.#attachedStores.length > 1) {
        // A short overlap is usual during an animated route transition, because the old root
        // unmounts a little after the new root mounts. The check waits one frame and warns only
        // when the overlap is still there, so a clean handoff gives no warning at any unmount time.
        (this.#overlapWarningFrame ??= AnimationFrame.create()).request(() => {
          if (this.#attachedStores.length > 1) {
            console.warn(
              'Vase UI: A handle is attached to more than one mounted root at the same time. ' +
                'The most recently mounted root takes over, and the handle stops controlling the previous root. ' +
                'Use a handle with one root that stays mounted as long as the handle exists.',
            );
          }
        });
      }
    }

    return () => {
      const index = this.#attachedStores.lastIndexOf(newStore);
      if (index !== -1) {
        this.#attachedStores.splice(index, 1);
      }
      // Control goes to the newest root that is still mounted. A reset to `null` would leave an
      // older root that is still mounted with no control when a newer overlapping root detaches
      // first, for example when a route transition is canceled.
      this.#attachedStoreRef.value = this.#attachedStores.at(-1) ?? null;
    };
  }

  /**
   * Gives `call` to the popup root of this handle above the part that calls the handle, while
   * `KeepAlive` holds that root and its store is detached. The root runs `call` after its
   * activation. Returns whether a root took the call. A call with no current component, such as a
   * call in an event handler, gets no root. A method that reads `attachedStoreUntracked` calls it
   * first, and returns when it gives `true`.
   */
  protected deferToHeldRoot(call: () => void): boolean {
    return hasInjectionContext() && (inject(HeldRootCallContext, null)?.(this, call) ?? false);
  }

  /**
   * Opens the attached root and links it to the trigger with the given id. It does nothing, and
   * warns in a development build, while no root is attached. A call in a lifecycle hook of a part
   * below a root of this handle that `KeepAlive` holds goes to that root (`deferToHeldRoot`). The
   * `open()` method of each concrete handle calls it and only narrows the type of the parameter.
   *
   * When no registered trigger has the id, an anchored popup throws (see `throwOnMissingTrigger`).
   * Dialog opens with no trigger and warns in a development build.
   *
   * Call it only in an event handler or an effect, and not in a render.
   *
   * @param triggerId The id of the trigger to link to the popup, or `null` or `undefined` to open
   * with no trigger.
   */
  protected openByTrigger(triggerId: string | null | undefined) {
    if (this.deferToHeldRoot(() => this.openByTrigger(triggerId))) {
      return;
    }
    const attachedStore = this.attachedStoreUntracked;

    if (attachedStore === null) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `Vase UI: ${this.#componentName}Handle.open() was called while no root that uses this handle is mounted. ` +
            'The handle ignored the call. Mount a root with this handle before you call open().',
        );
      }
      return;
    }

    // A detached trigger registers in the store of a new root only after the next flush. Until
    // then it is in the trigger map where it was before: the inert store when this is the first
    // root, or the store of an older root during an overlap. The search goes from the newest store
    // to the oldest and then to the inert store, so an `open(triggerId)` call in that flush still
    // finds the trigger.
    let triggerElement: Element | undefined;
    if (triggerId) {
      for (let i = this.#attachedStores.length - 1; i >= 0 && !triggerElement; i -= 1) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The loop runs from the last index to 0.
        triggerElement = this.#attachedStores[i]!.context.triggerElements.getById(triggerId);
      }
      triggerElement ??= this.fallbackStore.context.triggerElements.getById(triggerId);
    }

    if (triggerId && !triggerElement) {
      if (this.#throwOnMissingTrigger) {
        throw new Error(
          `Vase UI: ${this.#componentName}Handle.open() was called with the trigger id "${triggerId}", ` +
            'but no matching trigger is registered with this handle. ' +
            'An anchored popup cannot open without a trigger to anchor to. ' +
            `Pass the id of a mounted ${this.#componentName}.Trigger that has this handle set on its "handle" prop.`,
        );
      }

      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `Vase UI: ${this.#componentName}Handle.open: No trigger found with id "${triggerId}". ` +
            'The popup will open, but the trigger will not be associated with it. ' +
            `Pass the id of a mounted ${this.#componentName}.Trigger that has this handle set on its "handle" prop.`,
        );
      }
    }

    attachedStore.setOpen(
      true,
      createChangeEventDetails(REASONS.imperativeAction, undefined, triggerElement),
    );
  }

  /**
   * Closes the attached root. It does nothing, and warns in a development build, while no root is
   * attached. A call in a lifecycle hook of a part below a root of this handle that `KeepAlive`
   * holds goes to that root (`deferToHeldRoot`). The `close()` method of each concrete handle calls
   * it.
   *
   * Call it only in an event handler or an effect, and not in a render.
   */
  protected closePopup() {
    if (this.deferToHeldRoot(() => this.closePopup())) {
      return;
    }
    const attachedStore = this.attachedStoreUntracked;

    if (attachedStore === null) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `Vase UI: ${this.#componentName}Handle.close() was called while no root that uses this handle is mounted. ` +
            'The handle ignored the call. Mount a root with this handle before you call close().',
        );
      }
      return;
    }

    attachedStore.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
  }
}
