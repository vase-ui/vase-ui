import {
  computed,
  inject,
  nextTick,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import { addEventListener } from '../common/addEventListener';
import { createError } from '../common/createError';
import { useModel } from '../common/model';
import { ownerDocument } from '../common/owner';
import { tabbables } from '../common/tabbable';
import { nextTabStop, usePopupFocus } from '../popup/focus';
import { isInPopup, useLayer, type Layer } from '../popup/layer';
import type { PortalTarget } from '../popup/portal';
import type { usePlacement } from '../popup/placement';
import type { usePopupSizes } from '../popup/viewport';
import {
  usePopupRoot,
  type PopupRoot,
  type PopupRootState,
  type PopupTrigger,
} from '../popup/root';
import type {
  NavigationMenuActivationDirection,
  NavigationMenuOrientation,
  NavigationMenuRootChangeEventDetails,
  NavigationMenuRootChangeEventReason,
  NavigationMenuRootProps,
} from './types';

/** What a `NavigationMenu.Root` gives to its parts. The properties are reactive. */
export interface NavigationMenuRoot {
  readonly popup: PopupRoot;
  readonly layer: Layer;
  /** The value of the open item, or `null`. */
  readonly value: unknown;
  /** The value that the contents show: the value, or the value of the close while the popup leaves. */
  readonly shown: unknown;
  /** From a close until the popup leaves the document, or until the leave of a kept popup ends. */
  readonly leaving: boolean;
  readonly direction: NavigationMenuActivationDirection;
  readonly orientation: NavigationMenuOrientation;
  readonly nested: boolean;
  /** The root has no `Portal`: its viewport is in place. */
  readonly inline: boolean;
  /** The element that the contents go in, while the viewport is in the document or leaves. */
  readonly target: HTMLElement | null;
  /** The target of the `Portal`, for the portals in a content. */
  readonly portalTarget: PortalTarget | undefined;
  /** The element of the shown content. */
  readonly shownContent: HTMLElement | null;
  readonly delay: number;
  readonly closeDelay: number;
  /** The id of the trigger of the item with the value. */
  triggerIdOf(value: unknown): string | undefined;
  /** Closes the root. A `'link-press'` also closes each root above. */
  close(reason: NavigationMenuRootChangeEventReason, event: Event): void;
  /** The element is in the popup, or in a popup above it. */
  inside(element: Element): boolean;
  setElement(element: HTMLElement | null): void;
  setTarget(element: HTMLElement | null): void;
  setShownContent(element: HTMLElement | null): () => void;
  /** Adds a `Portal` with its target and its sentinels. */
  addPortal(portal: { readonly target: PortalTarget; readonly sentinels: Sentinels }): () => void;
  /** Sets the sentinels of the inline viewport. */
  setSentinels(sentinels: Sentinels | null): void;
  onSentinelFocus(place: 'before' | 'after', event: FocusEvent): void;
}

/** The sentinel before the contents and the one after them. */
export type Sentinels = readonly [HTMLElement | null, HTMLElement | null];

/** What a `NavigationMenu.Item` gives to its parts. The properties are reactive. */
export interface NavigationMenuItem {
  readonly value: unknown;
  /** The `id` of the content element while it is in the document. */
  contentId: string | null;
}

const rootKey: InjectionKey<NavigationMenuRoot> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'navigation menu root' : undefined,
);
const itemKey: InjectionKey<NavigationMenuItem> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'navigation menu item' : undefined,
);
/** The placement that `NavigationMenu.Positioner` gives to the popup and the arrow. */
export const positionerKey: InjectionKey<ReturnType<typeof usePlacement>> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'navigation menu positioner' : undefined,
);
/** The sizes that `NavigationMenu.Popup` gives to the positioner around it. */
export const sizesKey: InjectionKey<ShallowRef<ReturnType<typeof usePopupSizes> | null>> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'navigation menu sizes' : undefined,
);
const portalKey: InjectionKey<true> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'navigation menu portal' : undefined,
);

export function useNavigationMenuRoot(
  props: Required<
    Pick<NavigationMenuRootProps, 'defaultValue' | 'delay' | 'closeDelay' | 'orientation'>
  > &
    NavigationMenuRootProps,
  emit: {
    (event: 'valueChange', value: unknown, details: NavigationMenuRootChangeEventDetails): void;
    (event: 'update:modelValue', value: unknown): void;
  },
) {
  const parent = inject(rootKey, null);
  const model = useModel<unknown>(() => props.modelValue, props.modelValue ?? props.defaultValue);
  const value = model.value;
  const self = shallowRef<PopupRoot | null>(null);
  const triggerOf = (item: unknown) =>
    item == null ? undefined : self.value?.triggers.find((trigger) => trigger.payload === item);
  const valueOf = (open: boolean, trigger: PopupTrigger | null | undefined) =>
    open ? (trigger ? trigger.payload : value.value) : null;

  // The active trigger is the trigger of the open item. After a close, it is the trigger of the last
  // open item, so the focus goes back to it.
  const lastItem = shallowRef<unknown>(value.value);
  watch(
    value,
    (item) => {
      if (item != null) lastItem.value = item;
    },
    { flush: 'sync' },
  );

  const state: PopupRootState = {
    open: () => value.value != null,
    activeTriggerId: () => triggerOf(value.value ?? lastItem.value)?.id ?? null,
    emitChange: (open, trigger, details) =>
      emit('valueChange', valueOf(open, trigger), details as NavigationMenuRootChangeEventDetails),
    set(open, trigger) {
      const next = valueOf(open, trigger);
      model.setOwn(next);
      emit('update:modelValue', next);
    },
  };
  const popup = usePopupRoot({ name: 'NavigationMenu', state });
  self.value = popup;

  // The side of the new trigger from the old one, before Vue renders the new content.
  const direction = shallowRef<NavigationMenuActivationDirection>(null);
  watch(
    value,
    (next, previous) => {
      const from = triggerOf(previous)?.element;
      const to = triggerOf(next)?.element;
      if (next == null || previous == null) direction.value = null;
      if (!from || !to || next == null || previous == null) return;
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      if (props.orientation === 'vertical') {
        if (b.top !== a.top) direction.value = b.top > a.top ? 'down' : 'up';
      } else if (b.left !== a.left) {
        direction.value = b.left > a.left ? 'right' : 'left';
      }
    },
    { flush: 'sync' },
  );

  // A kept popup stays in the DOM at a close, and CSS on `[hidden]` can animate its leave. It leaves
  // until those animations end.
  const keptLeaving = shallowRef(false);
  let closes = 0;
  watch(
    () => popup.open,
    async (open) => {
      const close = ++closes;
      keptLeaving.value = !open && popup.keepMounted;
      if (!keptLeaving.value) return;
      await nextTick();
      const animations = popup.popup?.getAnimations() ?? [];
      await Promise.allSettled(animations.map((animation) => animation.finished));
      if (close === closes) keptLeaving.value = false;
    },
    { flush: 'sync' },
  );
  const leaving = computed(() => popup.leaving || keptLeaving.value);

  // While the popup leaves, it keeps the content and the viewport of its close.
  const lastShown = shallowRef<unknown>(null);
  watch(
    [value, leaving],
    ([next, isLeaving]) => {
      if (next != null && !isLeaving) lastShown.value = next;
    },
    { flush: 'sync', immediate: true },
  );
  const shown = computed(() => (leaving.value ? lastShown.value : value.value));
  const viewport = shallowRef<HTMLElement | null>(null);
  const lastViewport = shallowRef<HTMLElement | null>(null);
  watch(viewport, (element) => element && (lastViewport.value = element), { flush: 'sync' });
  const target = computed(() => viewport.value ?? (leaving.value ? lastViewport.value : null));

  const element = shallowRef<HTMLElement | null>(null);
  const portals = shallowRef<{ readonly target: PortalTarget; readonly sentinels: Sentinels }[]>(
    [],
  );
  const inlineSentinels = shallowRef<Sentinels | null>(null);
  const inline = computed(() => portals.value.length === 0);
  const sentinels = (): Sentinels =>
    portals.value[0]?.sentinels ?? inlineSentinels.value ?? [null, null];

  const layer = useLayer(popup, () => ({
    escape: !inline.value,
    outsidePress: !inline.value,
    focusOut: !inline.value,
    pressStart: false,
    block: false,
    hide: false,
    trap: false,
    lockScroll: false,
    triggerInUse: true,
    inside: inline.value ? [] : [element.value],
  }));
  usePopupFocus(popup, layer, {
    takesFocus: () => false,
    placed: () => false,
    initialFocus: () => undefined,
    finalFocus: () => undefined,
    noReturn: ['trigger-hover', 'outside-press', 'focus-out'],
  });

  // A key rule or the pass rule moved the focus to the sentinel: it stays there.
  let moving = false;
  function moveTo(sentinel: HTMLElement) {
    moving = true;
    sentinel.focus({ preventScroll: true });
    moving = false;
  }
  function focus(target: Element | null | undefined) {
    (target as HTMLElement | null | undefined)?.focus({ preventScroll: true });
  }

  // The content of the open item follows its trigger in the Tab order. Each key rule moves the
  // focus to a sentinel at `keydown`, and the browser does the Tab from there, with the setting of
  // the system for the elements that Tab reaches (test/measurements/navigation-menu.test.ts, "Tab
  // after a key listener moved the focus to a sentinel").
  function onTabKey(event: KeyboardEvent) {
    const trigger = popup.activeTrigger;
    const box = popup.popup;
    const [before, after] = sentinels();
    if (event.key !== 'Tab' || event.defaultPrevented || !trigger || !box || !before || !after) {
      return;
    }
    if (tabbables(box).length === 0) return;
    const keyTarget = event.composedPath()[0];
    if (!event.shiftKey && keyTarget === trigger) moveTo(before);
    if (event.shiftKey && keyTarget === nextTabStop(trigger, [box, before, after])) moveTo(after);
  }
  watch(
    () => (popup.open ? element.value : null),
    (current, _, onCleanup) => {
      if (current) onCleanup(addEventListener(ownerDocument(current), 'keydown', onTabKey));
    },
    { immediate: true },
  );

  function onSentinelFocus(place: 'before' | 'after', event: FocusEvent) {
    const box = popup.popup;
    const [before, after] = sentinels();
    if (moving || !box || !before || !after) return;
    const from = event.relatedTarget as Element | null;
    const trigger = popup.activeTrigger;
    if (from && (box.contains(from) || from === before || from === after)) {
      focus(place === 'before' ? trigger : trigger && nextTabStop(trigger, [box, before, after]));
      return;
    }
    // A Tab from another place passes the contents, which follow their trigger.
    const stops = tabbables(ownerDocument(before).body).filter((stop) => !box.contains(stop));
    if (place === 'before') {
      const next = stops.find(
        (stop) => after.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      if (next) focus(next);
      else moveTo(after);
    } else {
      const previous = stops.findLast(
        (stop) => before.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_PRECEDING,
      );
      if (previous) focus(previous);
      else moveTo(before);
    }
  }

  const shownContent = shallowRef<HTMLElement | null>(null);
  const root: NavigationMenuRoot = {
    popup,
    layer,
    get value() {
      return value.value;
    },
    get shown() {
      return shown.value;
    },
    get leaving() {
      return leaving.value;
    },
    get direction() {
      return direction.value;
    },
    get orientation() {
      return props.orientation;
    },
    nested: !!parent,
    get inline() {
      return inline.value;
    },
    get target() {
      return target.value;
    },
    get portalTarget() {
      return portals.value[0]?.target;
    },
    get shownContent() {
      return shownContent.value;
    },
    get delay() {
      return props.delay;
    },
    get closeDelay() {
      return props.closeDelay;
    },
    triggerIdOf: (item) => triggerOf(item)?.id,
    close(reason, event) {
      const details = popup.request(false, reason, event);
      if (!details.isCanceled && reason === 'link-press') parent?.close(reason, event);
    },
    inside: (target) => isInPopup(layer, target),
    setElement(value) {
      element.value = value;
    },
    setTarget(value) {
      viewport.value = value;
    },
    setShownContent(value) {
      shownContent.value = value;
      return () => {
        if (shownContent.value === value) shownContent.value = null;
      };
    },
    addPortal(portal) {
      portals.value = [...portals.value, portal];
      return () => (portals.value = portals.value.filter((each) => each !== portal));
    },
    setSentinels(value) {
      inlineSentinels.value = value;
    },
    onSentinelFocus,
  };
  provide(rootKey, root);

  return {
    root,
    /** Closes the root with the reason `'imperative-action'`. */
    close: () => root.close('imperative-action', new Event('vase-ui')),
  };
}

function missingParent(part: string, parent: string): never {
  throw createError(39, part, parent);
}

/** The root of the part. A part with no root throws an error that names it. */
export function injectNavigationMenuRoot(part: string) {
  return inject(rootKey, null) ?? missingParent(part, 'Root');
}

export function provideItem(item: NavigationMenuItem) {
  provide(itemKey, item);
}

/** The item of the part. A part with no item throws an error that names it. */
export function injectItem(part: string) {
  return inject(itemKey, null) ?? missingParent(part, 'Item');
}

/** Marks the parts in a `NavigationMenu.Portal`. */
export function providePortal() {
  provide(portalKey, true);
}

/** `NavigationMenu.Positioner` and `NavigationMenu.Backdrop` need a portal of their root. */
export function injectPortal(part: string) {
  if (!inject(portalKey, false)) missingParent(part, 'Portal');
}

/** The placement of the positioner around the part. A part with no positioner throws an error. */
export function injectPositioner(part: string) {
  return inject(positionerKey, null) ?? missingParent(part, 'Positioner');
}

/** The placement of the positioner around the part, or `null` with none. */
export function injectPositionerIfAny() {
  return inject(positionerKey, null);
}
