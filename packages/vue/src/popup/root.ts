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
import { createError } from '../common/createError';
import { useModel } from '../common/model';
import { ownerDocument } from '../common/owner';
import { warn } from '../common/warn';

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
  /** The element of the action. With no such element, the active trigger in the document. */
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
  /**
   * From a close until the popup and the backdrop are hidden or out of the document. An open ends it
   * for an element that its part shows again.
   */
  readonly leaving: boolean;
  /** The `keepMounted` of the portal. */
  readonly keepMounted: boolean;
  /** The reason of the last accepted change. */
  readonly reason: string | undefined;
  /** The input of the last accepted open. An open by the `open` prop has none. */
  readonly interaction: InteractionType;
  /** The input of the last accepted close. */
  readonly closeInteraction: InteractionType;
  readonly instant: string | undefined;
  readonly triggers: readonly PopupTrigger[];
  readonly activeTrigger: Element | null;
  readonly activeTriggerId: string | null;
  /**
   * The payload of the active trigger, or the payload of `openWithPayload`. After a close, the
   * payload of the last render while the root was open.
   */
  readonly payload: Payload | undefined;
  /** The popup element, while its part renders it. */
  readonly popup: HTMLElement | null;
  /** The sentinels, the fixed element and the viewport, while they are in the document. */
  readonly portalElements: readonly Element[];
  /** The elements of the popup and the backdrop, while their parts render them. */
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
   * trigger, also when the root has one trigger. `interaction` replaces the input that the root
   * reads from the event.
   */
  request(
    open: boolean,
    reason: string,
    event: Event,
    trigger?: Element | null,
    interaction?: InteractionType,
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
  /** Ends `leaving` at once, so that the portal removes the popup that leaves. */
  endLeaving(): void;
}

/**
 * The state of a root that its family holds, such as the value of a navigation menu. `trigger` is
 * the trigger of an open, `null` for an open with no trigger, and `undefined` for a close or an
 * open that keeps the active trigger.
 */
export interface PopupRootState {
  open(): boolean;
  activeTriggerId(): string | null;
  /** Emits the change event. Its listeners can cancel the change. */
  emitChange(
    open: boolean,
    trigger: PopupTrigger | null | undefined,
    details: PopupChangeEventDetails,
  ): void;
  /** Sets the state after a change that no listener cancelled. */
  set(open: boolean, trigger: PopupTrigger | null | undefined): void;
}

interface PopupRootModels {
  open: () => boolean | undefined;
  defaultOpen: boolean;
  triggerId: () => string | null | undefined;
  defaultTriggerId: string | null;
  handle: () => PopupHandle | undefined;
  /** Emits the change event. Its listeners can cancel the change. */
  emitChange: (open: boolean, details: PopupChangeEventDetails) => void;
  emitOpen: (open: boolean) => void;
  emitTriggerId: (id: string | null) => void;
}

export type PopupRootOptions = {
  /** The family, for the text of an error. */
  name: string;
  /** The `instant` state of a change. */
  instantOf?: (open: boolean, reason: string, event: Event) => string | undefined;
  /**
   * The root is closed for its parts while it is `true`, and the state keeps its value. After the
   * mount, a disabled root with an open state asks for a close with the reason `'disabled'`.
   */
  disabled?: () => boolean;
} & (PopupRootModels | { state: PopupRootState });

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

// The mounted roots of each handle, in the order in which they took it, and the last one of them.
const handleRoots = new WeakMap<
  PopupHandle,
  { roots: PopupRoot[]; holder: ShallowRef<PopupRoot | null> }
>();

/** The root that has the handle as `handle`, while it is mounted. */
export function rootOfHandle<Payload>(handle: PopupHandle<Payload>) {
  return (handleRoots.get(handle)?.holder.value ?? null) as PopupRoot<Payload> | null;
}

/**
 * The root for a method of a handle that opens the popup. With no mounted root, the call does
 * nothing, and a development build warns: the cause is a mistake that gives no other signal, such
 * as a root with no `handle` prop or a call before the mount.
 */
export function rootToOpen<Payload>(handle: PopupHandle<Payload>, method: string) {
  const root = rootOfHandle(handle);
  if (process.env.NODE_ENV !== 'production' && !root) {
    warn(
      `\`${method}()\` of a handle found no mounted root with this handle. The call does nothing.`,
    );
  }
  return root;
}

/**
 * Opens and closes a popup from code, and connects triggers outside the root to it. Give it to the
 * `handle` prop of the root and of each such trigger. With no mounted root, a method does nothing.
 */
export class PopupHandle<Payload = unknown> {
  constructor() {
    handleRoots.set(this, { roots: [], holder: shallowRef(null) });
    // A reactive proxy of the handle would be another key of the map.
    markRaw(this);
  }

  /**
   * Opens the popup for the trigger with this `id`. With no mounted root, it does nothing, and a
   * development build warns. Throws an error when the root has no trigger with this `id`.
   */
  open(triggerId: string) {
    const root = rootToOpen<Payload>(this, 'open');
    if (!root) return;
    const trigger = root.triggers.find((each) => each.id === triggerId);
    if (!trigger) {
      throw createError(46, triggerId);
    }
    root.request(true, 'imperative-action', new Event('vase-ui'), trigger.element);
  }

  /** Closes the popup. With no mounted root, it does nothing. */
  close() {
    rootOfHandle(this)?.request(false, 'imperative-action', new Event('vase-ui'));
  }

  /** The popup is open. It is `false` while no root has the handle. */
  get isOpen() {
    return rootOfHandle(this)?.open ?? false;
  }
}

// `v-model:open` and `v-model:trigger-id` of a root. With one trigger, it is the active trigger.
function useModelState(options: PopupRootModels, triggers: readonly PopupTrigger[]) {
  const openModel = useModel(() => options.open(), options.open() ?? options.defaultOpen);
  const triggerIdModel = useModel(
    () => options.triggerId(),
    options.triggerId() ?? options.defaultTriggerId,
  );
  // An open with no trigger keeps the one trigger of the root inactive until the next open.
  const withoutTrigger = shallowRef(false);
  const activeTriggerId = () =>
    triggerIdModel.value.value ??
    (triggers.length === 1 && !withoutTrigger.value ? (triggers[0]?.id ?? null) : null);
  const state: PopupRootState = {
    open: () => openModel.value.value,
    activeTriggerId,
    emitChange: (open, _, details) => options.emitChange(open, details),
    set(next, trigger) {
      const nextId = !next || trigger === undefined ? activeTriggerId() : (trigger?.id ?? null);
      if (next && trigger !== undefined) withoutTrigger.value = trigger === null;
      // The trigger of an open stays active when another trigger mounts.
      if (next && nextId !== triggerIdModel.value.value) {
        triggerIdModel.setOwn(nextId);
        options.emitTriggerId(nextId);
      }
      if (next !== openModel.value.value) {
        openModel.setOwn(next);
        options.emitOpen(next);
      }
    },
  };
  return state;
}

export function usePopupRoot<Payload>(options: PopupRootOptions): PopupRoot<Payload> {
  const triggers = shallowReactive<PopupTrigger[]>([]);
  const state = 'state' in options ? options.state : useModelState(options, triggers);
  const open = computed(() => state.open() && !options.disabled?.());
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

  // The input of an accepted open that the state does not show yet: a controlled root shows it
  // when its parent writes the `open` prop.
  let requestedInput: InteractionType | undefined;

  const givenPayload = shallowRef<{ value: Payload }>();
  const activeTriggerId = computed(() => state.activeTriggerId());
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
  // A new `id` of the active trigger of an open popup keeps that trigger active. A family with a
  // state of its own, such as the value of a navigation menu, follows the id itself.
  if (!('state' in options)) {
    watch(
      () =>
        triggers.find((trigger) => !!trigger.element && trigger.element === lastTrigger.value)?.id,
      (id) => {
        const previous = activeTriggerId.value;
        if (id === undefined || previous === null || id === previous || !state.open()) return;
        // The old id names no trigger, so the active trigger has a new id.
        if (triggers.some((trigger) => trigger.id === previous)) return;
        const entry = triggers.find((trigger) => trigger.id === id);
        if (entry) state.set(true, entry);
      },
      { flush: 'sync' },
    );
  }
  // The popup keeps its payload while its active trigger is out of the DOM.
  const lastPayload = shallowRef<{ id: string; payload: unknown }>();
  watch(
    () => activeEntry.value && { id: activeEntry.value.id, payload: activeEntry.value.payload },
    (entry) => {
      if (entry) lastPayload.value = entry;
    },
    { flush: 'sync' },
  );
  const openPayload = computed(() => {
    if (givenPayload.value) return givenPayload.value.value;
    const entry = activeEntry.value ?? lastPayload.value;
    return (entry?.id === activeTriggerId.value ? entry?.payload : undefined) as
      Payload | undefined;
  });
  // Vue patches the popup that leaves, so the popup keeps the payload of its last render, also
  // when the parent clears the trigger at the close. A watcher of the default flush runs before
  // the render, after the parent wrote each prop.
  const closedPayload = shallowRef<{ value: Payload | undefined }>();
  watch([open, openPayload] as const, ([isOpen], [wasOpen, payload]) => {
    if (wasOpen && !isOpen) closedPayload.value = { value: payload };
  });

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
    input = interactionOf(event),
  ) {
    const element = entry === null ? null : (entry?.element ?? activeTrigger.value);
    const details = createPopupChangeEventDetails(
      why,
      event,
      element?.isConnected ? element : undefined,
    );
    const nextId = !next || entry === undefined ? activeTriggerId.value : (entry?.id ?? null);
    if (next === state.open() && nextId === activeTriggerId.value) {
      if (!next) closeRequests.value += 1;
      if (payload) givenPayload.value = payload;
      // A press keeps a popup open that a hover opened.
      if (next && why === 'trigger-press') reason.value = why;
      return details;
    }
    state.emitChange(next, entry, details);
    if (details.isCanceled) return details;
    reason.value = why;
    if (next) interaction.value = requestedInput = input;
    else {
      closeInteraction.value = input;
      requestedInput = undefined;
    }
    instant.value = options.instantOf?.(next, why, event);
    if (next && entry !== undefined) {
      givenPayload.value = payload ?? (entry ? undefined : givenPayload.value);
    }
    state.set(next, entry);
    if (!next && why !== 'trigger-hover') closeRequests.value += 1;
    return details;
  }

  const parts = () =>
    leavingElements.map((element) => element()).filter((element): element is Element => !!element);
  // A part hides its element with `v-show`, and the `<Transition>` around it keeps the element
  // until its leave ends. A part that renders its element with a `v-if` leaves it to the
  // `<Transition>`, and Vue sets its ref to `null` at once, so the root keeps the elements of
  // the close.
  let leavingNow: Element[] = [];
  let observer: MutationObserver | undefined;
  function settle() {
    leavingNow = leavingNow.filter(
      (element) => element.isConnected && (element as HTMLElement).style.display !== 'none',
    );
    if (leavingNow.length > 0) return false;
    observer?.disconnect();
    observer = undefined;
    leaving.value = false;
    return true;
  }
  function endLeaving() {
    leavingNow = [];
    settle();
  }
  watch(
    open,
    (isOpen) => {
      if (isOpen) interaction.value = requestedInput ?? '';
      requestedInput = undefined;
      if (instant.value === 'trigger-change') instant.value = undefined;
      if (isOpen) {
        // A part that keeps its element shows it again. An element that Vue removes still leaves.
        const kept = parts();
        leavingNow = leavingNow.filter((element) => !kept.includes(element));
        settle();
        return;
      }
      if (keepMounted.value) return;
      const elements = parts();
      if (elements.length === 0) return;
      leavingNow.push(...elements);
      leaving.value = true;
      void nextTick(() => {
        if (settle()) return;
        observer ??= new MutationObserver(settle);
        for (const element of leavingNow) {
          if (element.parentNode) observer.observe(element.parentNode, { childList: true });
          observer.observe(element, { attributeFilter: ['style'] });
        }
      });
    },
    { flush: 'sync' },
  );
  // Vue removes the elements of a root that unmounts during the leave after this scope stops the
  // observer. So the leave ends here, and a parent menu that waits for it can leave.
  onScopeDispose(endLeaving);

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
      return !open.value && closedPayload.value ? closedPayload.value.value : openPayload.value;
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
      return parts();
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
    request(next, why, event, trigger, input) {
      const entry = trigger ? triggers.find((each) => each.element === trigger) : trigger;
      return change(next, why, event, entry, undefined, input);
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
    endLeaving,
  };

  onMounted(() => {
    onScopeDispose(trackPointerType(ownerDocument(null)));
    watch(
      () => state.open() && !!options.disabled?.(),
      (closes) => {
        if (closes) change(false, 'disabled', new Event('vase-ui'), undefined);
      },
      { immediate: true },
    );
  });
  // A post-flush effect runs only on the client, so a handle in a module of a server holds no root
  // of a request. It runs before `onMounted` of the children, and not while a `<Suspense>` waits
  // for the page of the root. When a `<Suspense>` replaces a page, the old root releases its handle
  // before the new root takes it (test/measurements/dialog.test.ts). Of two mounted roots with one
  // handle, the last one holds it, and the one before holds it again when the last one goes.
  watchPostEffect((onCleanup) => {
    const handle = 'handle' in options ? options.handle() : undefined;
    const entry = handle && handleRoots.get(handle);
    if (!entry) return;
    const { roots, holder } = entry;
    roots.push(root);
    holder.value = root;
    onCleanup(() => {
      roots.splice(roots.indexOf(root), 1);
      holder.value = roots.at(-1) ?? null;
    });
  });

  return root;
}

/**
 * Closes the open root with the reason `'none'` when its active trigger leaves the DOM. A trigger
 * that a `v-if` with a new `key` replaces in one update is mounted for a `post` watcher
 * (test/measurements/preview-card.test.ts).
 */
export function useCloseWhenTriggerLeaves(root: PopupRoot) {
  const mounted = computed(() =>
    root.triggers.some((trigger) => trigger.id === root.activeTriggerId && !!trigger.element),
  );
  watch(
    mounted,
    (isMounted) => {
      if (!isMounted && root.open) root.request(false, 'none', new Event('vase-ui'));
    },
    { flush: 'post' },
  );
}

function add<T>(list: T[], item: T) {
  list.push(item);
  return () => {
    const index = list.indexOf(item);
    if (index !== -1) list.splice(index, 1);
  };
}
