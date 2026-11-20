import {
  computed,
  markRaw,
  nextTick,
  onMounted,
  onScopeDispose,
  shallowReactive,
  shallowRef,
  watch,
  watchPostEffect,
  type ShallowRef,
} from 'vue';
import { addEventListener } from '../common/addEventListener';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import { useModel } from '../common/model';
import { ownerDocument } from '../common/owner';

export type InteractionType = 'mouse' | 'touch' | 'pen' | 'keyboard' | '';

export interface PopupChangeEventDetails<
  Reason extends string = string,
> extends ChangeEventDetails<Reason> {
  /**
   * The popup stops the key event that closed it. After this call, the event goes on, and the
   * popup below can also close.
   */
  allowPropagation(): void;
  readonly isPropagationAllowed: boolean;
  /** The element that the action is on. With no such element, the active trigger. */
  trigger: Element | undefined;
}

/** A trigger of a root, from its `setup` to its unmount. The properties are reactive. */
export interface PopupTrigger {
  readonly id: string;
  readonly element: Element | null;
  readonly payload: unknown;
  readonly disabled: boolean;
}

/** What a root gives to its parts. The properties are reactive. */
export interface PopupRoot<Payload = unknown> {
  readonly open: boolean;
  /** From a close until Vue removed the popup and the backdrop from the document. */
  readonly leaving: boolean;
  /** The `keepMounted` of the portal. */
  readonly keepMounted: boolean;
  /** The reason of the last accepted change. */
  readonly reason: string | undefined;
  /** The input of the last accepted open. */
  readonly interaction: InteractionType;
  /** The input of the last accepted close. */
  readonly closeInteraction: InteractionType;
  readonly instant: string | undefined;
  readonly triggers: readonly PopupTrigger[];
  readonly activeTrigger: Element | null;
  readonly activeTriggerId: string | null;
  /** The payload of the active trigger, or the payload of `openWithPayload`. */
  readonly payload: Payload | undefined;
  /** The popup element, while it is in the document. */
  readonly popup: HTMLElement | null;
  /** The sentinels, the fixed element and the viewport, while they are in the document. */
  readonly portalElements: readonly Element[];
  /** The elements of the popup and the backdrop, while they are in the document. */
  readonly parts: readonly Element[];
  /** The `id` of the mounted title that mounted last. */
  readonly titleId: string | undefined;
  /** The `id` of the mounted description that mounted last. */
  readonly descriptionId: string | undefined;
  /**
   * The number of close requests: each accepted close that no hover made, and each close of a
   * closed root. A hover close does not stop the hover open of another trigger.
   */
  readonly closeRequests: number;
  /**
   * Asks for a change of the state after an action of the user. A request for the state that the
   * root has, for the same trigger, emits nothing. An open with the `trigger` `null` has no active
   * trigger, also when the root has one trigger.
   */
  request(
    open: boolean,
    reason: string,
    event: Event,
    trigger?: Element | null,
  ): PopupChangeEventDetails;
  /**
   * Asks for an open with no active trigger. The parts get the payload until the next open by a
   * trigger.
   */
  openWithPayload(payload: Payload, event: Event): PopupChangeEventDetails;
  addTrigger(trigger: PopupTrigger): () => void;
  setPopup(element: HTMLElement | null): void;
  setKeepMounted(keepMounted: boolean): void;
  setInstant(instant: string | undefined): void;
  /** Adds an element that can leave in a `<Transition>`: the popup, the backdrop. */
  addLeaving(element: () => Element | null): () => void;
  addPortalElement(element: () => Element | null): () => void;
  addLabel(kind: 'title' | 'description', label: { readonly id: string }): () => void;
}

export interface PopupRootOptions {
  /** The family, for the text of an error. */
  name: string;
  open: () => boolean | undefined;
  defaultOpen: boolean;
  triggerId: () => string | null | undefined;
  defaultTriggerId: string | null;
  handle: () => PopupHandle | undefined;
  /** Emits the change event. Its listeners can cancel the change. */
  emitChange: (open: boolean, details: PopupChangeEventDetails) => void;
  emitOpen: (open: boolean) => void;
  emitTriggerId: (id: string | null) => void;
  /** The `instant` state of a change. */
  instantOf?: (open: boolean, reason: string, event: Event) => string | undefined;
}

export function createPopupChangeEventDetails<Reason extends string>(
  reason: Reason,
  event: Event,
  trigger: Element | undefined,
): PopupChangeEventDetails<Reason> {
  let isCanceled = false;
  let isPropagationAllowed = false;
  return {
    reason,
    event,
    trigger,
    cancel() {
      isCanceled = true;
    },
    get isCanceled() {
      return isCanceled;
    },
    allowPropagation() {
      isPropagationAllowed = true;
    },
    get isPropagationAllowed() {
      return isPropagationAllowed;
    },
  };
}

// A click event of Safari before 18.2 has no `pointerType`. The `pointerdown` before it has one.
// One listener of each document keeps the type of its last `pointerdown` while a root is mounted.
const pointerTypes = new Map<Document, { type: InteractionType; roots: number; stop(): void }>();

function trackPointerType(doc: Document) {
  let tracker = pointerTypes.get(doc);
  if (!tracker) {
    const created = {
      type: '' as InteractionType,
      roots: 0,
      stop: addEventListener(
        doc,
        'pointerdown',
        (event) => (created.type = event.pointerType as InteractionType),
        true,
      ),
    };
    tracker = created;
    pointerTypes.set(doc, tracker);
  }
  tracker.roots += 1;
  return () => {
    tracker.roots -= 1;
    if (tracker.roots > 0) return;
    tracker.stop();
    pointerTypes.delete(doc);
  };
}

/** The input of an event: a pointer type, or `'keyboard'` for a key and a click with no press. */
export function interactionOf(event: Event): InteractionType {
  if (event.type.startsWith('key')) return 'keyboard';
  if (!('detail' in event) || !('clientX' in event)) return '';
  if (event.type === 'click' && event.detail === 0) return 'keyboard';
  const type = (event as Partial<PointerEvent>).pointerType;
  const target = event.target as Node | null;
  return (
    (type as InteractionType) || (pointerTypes.get(ownerDocument(target as Element))?.type ?? '')
  );
}

const handleRoots = new WeakMap<PopupHandle, ShallowRef<PopupRoot | null>>();

/** The root that has the handle as `handle`, while it is mounted. */
export function rootOfHandle<Payload>(handle: PopupHandle<Payload>) {
  return (handleRoots.get(handle)?.value ?? null) as PopupRoot<Payload> | null;
}

/**
 * Opens and closes a popup from code, and connects triggers outside the root to it. Give it to the
 * `handle` prop of the root and of each such trigger. With no mounted root, a method does nothing.
 */
export class PopupHandle<Payload = unknown> {
  constructor() {
    handleRoots.set(this, shallowRef(null));
    // A reactive proxy of the handle would be another key of the map.
    markRaw(this);
  }

  /**
   * Opens the popup for the trigger with this `id`. Throws an error when the root has no trigger
   * with this `id`.
   */
  open(triggerId: string) {
    const root = rootOfHandle<Payload>(this);
    if (!root) return;
    const trigger = root.triggers.find((each) => each.id === triggerId);
    if (!trigger) {
      throw new Error(
        `Vase UI: The handle has no trigger with the id "${triggerId}". Give this id to a trigger of the root, or open the popup with the id of one of its triggers.`,
      );
    }
    root.request(true, 'imperative-action', new Event('vase-ui'), trigger.element);
  }

  /** Closes the popup. */
  close() {
    rootOfHandle(this)?.request(false, 'imperative-action', new Event('vase-ui'));
  }

  /** The popup is open. It is `false` while no root has the handle. */
  get isOpen() {
    return rootOfHandle(this)?.open ?? false;
  }
}

export function usePopupRoot<Payload>(options: PopupRootOptions): PopupRoot<Payload> {
  const openModel = useModel(() => options.open(), options.open() ?? options.defaultOpen);
  const open = openModel.value;
  const triggerIdModel = useModel(
    () => options.triggerId(),
    options.triggerId() ?? options.defaultTriggerId,
  );
  const chosenTriggerId = triggerIdModel.value;
  const triggers = shallowReactive<PopupTrigger[]>([]);
  const leavingElements = shallowReactive<(() => Element | null)[]>([]);
  const portalElements = shallowReactive<(() => Element | null)[]>([]);
  // The popup names the last mounted title and description. When it unmounts, the one before it.
  const labels = {
    title: shallowReactive<{ readonly id: string }[]>([]),
    description: shallowReactive<{ readonly id: string }[]>([]),
  };
  const popup = shallowRef<HTMLElement | null>(null);
  const keepMounted = shallowRef(false);
  const leaving = shallowRef(false);
  const reason = shallowRef<string>();
  const interaction = shallowRef<InteractionType>('');
  const closeInteraction = shallowRef<InteractionType>('');
  const instant = shallowRef<string>();
  const closeRequests = shallowRef(0);

  // An open with no trigger keeps the one trigger of the root inactive until the next open.
  const withoutTrigger = shallowRef(false);
  const givenPayload = shallowRef<{ value: Payload }>();
  const activeTriggerId = computed(
    () =>
      chosenTriggerId.value ??
      (triggers.length === 1 && !withoutTrigger.value ? (triggers[0]?.id ?? null) : null),
  );
  const activeEntry = computed(() =>
    triggers.find((trigger) => trigger.id === activeTriggerId.value),
  );
  // The popup stays at its trigger after the trigger leaves the DOM.
  const lastTrigger = shallowRef<Element | null>(null);
  watch(
    () => activeEntry.value?.element,
    (element) => {
      if (element) lastTrigger.value = element;
    },
    { flush: 'sync' },
  );
  const activeTrigger = computed(() =>
    activeTriggerId.value === null ? null : (activeEntry.value?.element ?? lastTrigger.value),
  );

  /**
   * `entry` is the trigger of an open, `null` for an open with no trigger, and `undefined` for a
   * close or an open that keeps the active trigger. `payload` replaces the payload of the trigger.
   */
  function change(
    next: boolean,
    why: string,
    event: Event,
    entry: PopupTrigger | null | undefined,
    payload?: { value: Payload },
  ) {
    const element = entry === null ? null : (entry?.element ?? activeTrigger.value);
    const details = createPopupChangeEventDetails(why, event, element ?? undefined);
    const nextId = !next || entry === undefined ? activeTriggerId.value : (entry?.id ?? null);
    if (next === open.value && nextId === activeTriggerId.value) {
      if (!next) closeRequests.value += 1;
      if (payload) givenPayload.value = payload;
      // A press keeps a popup open that a hover opened.
      if (next && why === 'trigger-press') reason.value = why;
      return details;
    }
    options.emitChange(next, details);
    if (details.isCanceled) return details;
    reason.value = why;
    if (next) interaction.value = interactionOf(event);
    else closeInteraction.value = interactionOf(event);
    instant.value = options.instantOf?.(next, why, event);
    if (next && entry !== undefined) {
      withoutTrigger.value = entry === null;
      givenPayload.value = payload ?? (entry ? undefined : givenPayload.value);
    }
    // The trigger of an open stays active when another trigger mounts.
    if (next && nextId !== chosenTriggerId.value) {
      triggerIdModel.setOwn(nextId);
      options.emitTriggerId(nextId);
    }
    if (next !== open.value) {
      openModel.setOwn(next);
      options.emitOpen(next);
    }
    if (!next && why !== 'trigger-hover') closeRequests.value += 1;
    return details;
  }

  // The popup and the backdrop leave in a `<Transition>` after Vue removes them from the render.
  // Vue sets their refs to `null` at once, so the root keeps the elements of the close.
  let leavingNow: Element[] = [];
  let observer: MutationObserver | undefined;
  function settle() {
    leavingNow = leavingNow.filter((element) => element.isConnected);
    if (leavingNow.length > 0) return false;
    observer?.disconnect();
    observer = undefined;
    leaving.value = false;
    return true;
  }
  watch(
    open,
    (isOpen) => {
      if (instant.value === 'trigger-change') instant.value = undefined;
      if (isOpen || keepMounted.value) return;
      const elements = leavingElements
        .map((element) => element())
        .filter((element): element is Element => !!element);
      if (elements.length === 0) return;
      leavingNow.push(...elements);
      leaving.value = true;
      void nextTick(() => {
        if (settle()) return;
        observer ??= new MutationObserver(settle);
        for (const element of leavingNow) {
          if (element.parentNode) observer.observe(element.parentNode, { childList: true });
        }
      });
    },
    { flush: 'sync' },
  );
  onScopeDispose(() => observer?.disconnect());

  const root: PopupRoot<Payload> = {
    get open() {
      return open.value;
    },
    get leaving() {
      return leaving.value;
    },
    get keepMounted() {
      return keepMounted.value;
    },
    get reason() {
      return reason.value;
    },
    get interaction() {
      return interaction.value;
    },
    get closeInteraction() {
      return closeInteraction.value;
    },
    get instant() {
      return instant.value;
    },
    get triggers() {
      return triggers;
    },
    get activeTrigger() {
      return activeTrigger.value;
    },
    get activeTriggerId() {
      return activeTriggerId.value;
    },
    get payload() {
      return givenPayload.value
        ? givenPayload.value.value
        : (activeEntry.value?.payload as Payload | undefined);
    },
    get popup() {
      return popup.value;
    },
    get portalElements() {
      return portalElements
        .map((element) => element())
        .filter((element): element is Element => !!element);
    },
    get parts() {
      return leavingElements
        .map((element) => element())
        .filter((element): element is Element => !!element);
    },
    get titleId() {
      return labels.title.at(-1)?.id;
    },
    get descriptionId() {
      return labels.description.at(-1)?.id;
    },
    get closeRequests() {
      return closeRequests.value;
    },
    request(next, why, event, trigger) {
      const entry = trigger ? triggers.find((each) => each.element === trigger) : trigger;
      return change(next, why, event, entry);
    },
    openWithPayload(payload, event) {
      return change(true, 'imperative-action', event, null, { value: payload });
    },
    addTrigger: (trigger) => add(triggers, trigger),
    setPopup(element) {
      popup.value = element;
    },
    setKeepMounted(value) {
      keepMounted.value = value;
    },
    setInstant(value) {
      instant.value = value;
    },
    addLeaving: (element) => add(leavingElements, element),
    addPortalElement: (element) => add(portalElements, element),
    addLabel: (kind, label) => add(labels[kind], label),
  };

  onMounted(() => onScopeDispose(trackPointerType(ownerDocument(null))));
  // A post-flush effect runs only on the client, so a handle in a module of a server holds no root
  // of a request. It runs before `onMounted` of the children, and not while a `<Suspense>` waits
  // for the page of the root. When a `<Suspense>` replaces a page, the old root releases its handle
  // before the new root takes it (test/measurements/dialog.test.ts). Of two mounted roots with one
  // handle, the last one holds it.
  watchPostEffect((onCleanup) => {
    const handle = options.handle();
    const holder = handle && handleRoots.get(handle);
    if (!holder) return;
    holder.value = root;
    onCleanup(() => {
      if (holder.value === root) holder.value = null;
    });
  });

  return root;
}

function add<T>(list: T[], item: T) {
  list.push(item);
  return () => {
    const index = list.indexOf(item);
    if (index !== -1) list.splice(index, 1);
  };
}
