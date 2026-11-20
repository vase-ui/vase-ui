import {
  computed,
  inject,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import { addEventListener } from '../common/addEventListener';
import { isElement } from '../common/element';
import { ownerDocument, ownerWindow } from '../common/owner';
import { useTimeout } from '../common/useTimeout';
import { useList, type List, type ListItem } from '../list/list';
import { menubarKey, menubarOfTrigger, type MenubarForMenu } from '../menubar/menu';
import { usePopupFocus, type FocusTarget } from '../popup/focus';
import { isInPopup, useLayer, type Layer } from '../popup/layer';
import type { usePlacement, VirtualElement } from '../popup/placement';
import { PopupHandle, rootOfHandle, usePopupRoot, type PopupRoot } from '../popup/root';
import type { ViewportSizes } from '../popup/viewport';
import { dispatchClickWithModifiers } from '../utils/dispatchClickWithModifiers';
import { isReleaseAtPressPoint } from '../utils/popups/isReleaseAtPressPoint';
import { filterProviderKey, useMenuFilter, type MenuFilterRoot } from './filter';
import { useTypeahead } from './typeahead';
import type { MenuRootChangeEventReason, MenuRootOrientation } from './types';

/** Opens and closes a menu from code, and connects triggers outside the root to it. */
export class MenuHandle<Payload = unknown> extends PopupHandle<Payload> {}

/** Makes a handle. `new Menu.Handle()` makes the same object. */
export function createHandle<Payload = unknown>() {
  return new MenuHandle<Payload>();
}

/**
 * The place of a menu: a menu with no parent, a submenu, a menu of a menubar, or a context menu.
 */
export type MenuKind = 'menu' | 'submenu' | 'menubar' | 'context';

/** A press that opened a menu, and whose release acts by its place. */
export interface MenuPress {
  x: number;
  y: number;
  time: number;
  /** The element that the press opened the menu from. */
  trigger: Element | null;
  /** The time from the press after which a release on an item clicks it. */
  itemDelay: number;
  /** The time from the press after which a release outside the menu closes it. */
  outsideDelay: number;
}

/** What a menu gives to its parts and to its submenus. The properties are reactive. */
export interface MenuContext<Payload = unknown> {
  readonly root: PopupRoot<Payload>;
  readonly layer: Layer;
  readonly kind: MenuKind;
  readonly parent: MenuContext | null;
  /** The menu with no parent menu. */
  readonly rootMenu: MenuContext;
  readonly menubar: MenubarForMenu | null;
  readonly list: List;
  readonly typeahead: ReturnType<typeof useTypeahead>;
  readonly focus: ReturnType<typeof usePopupFocus>;
  readonly orientation: MenuRootOrientation;
  readonly disabled: boolean;
  /** A hover opened the menu, and no press kept it open. */
  readonly hoverOpen: boolean;
  /** The open submenu. */
  readonly openChild: MenuContext | null;
  /**
   * The last submenu leaves in its `<Transition>`. The popup stays until it is gone, because Vue
   * removes the popup of a submenu with no leave when the popup around it leaves.
   */
  readonly childLeaving: boolean;
  readonly filter: MenuFilterRoot | null;
  /** The point of a context menu. */
  readonly anchor: VirtualElement | undefined;
  /** The hover of the trigger of a submenu. */
  hover: ShallowRef<{ readonly inTriangle: boolean; readonly closeDelay: number } | null>;
  positioner: ShallowRef<HTMLElement | null>;
  /** The positioner has its first place for this open. */
  placed: ShallowRef<boolean>;
  /** The element of `Menu.List`. */
  listElement: ShallowRef<HTMLElement | null>;
  /** The `finalFocus` of the popup. */
  finalFocus: ShallowRef<FocusTarget | undefined>;
  viewport: ShallowRef<ViewportSizes | null>;
  /** The element is in the popup or in a popup above it. */
  inside(element: Element): boolean;
  /** Opens the menu, and highlights its first or its last item after the open. */
  openWithKey(
    edge: 'first' | 'last',
    reason: MenuRootChangeEventReason,
    event: Event,
    trigger?: Element | null,
  ): void;
  /** A key in the popup, or on the active trigger. `true`: the menu used the key. */
  onKeydown(event: KeyboardEvent): boolean;
  /** Asks the root menu for a close. */
  close(reason: MenuRootChangeEventReason, event: Event): void;
  /** The release of the press acts by its place. */
  startDrag(press: MenuPress): void;
  setAnchor(anchor: VirtualElement | undefined): void;
  /** Gives a key that the menu did not use to its parent menu, or to its menubar. */
  passUp(event: KeyboardEvent): boolean;
  setOpenChild(child: MenuContext | null): void;
}

export const menuKey: InjectionKey<MenuContext> = Symbol('menu');
/** The placement that `Menu.Positioner` gives to the popup and the arrow. */
export const positionerKey: InjectionKey<ReturnType<typeof usePlacement>> =
  Symbol('menu positioner');
const portalKey: InjectionKey<true> = Symbol('menu portal');
const contexts = new WeakMap<PopupRoot, MenuContext>();

/** The items of each menu, by element: the drag reads them. */
const menuItems = new WeakMap<Element, { disabled(): boolean }>();
/** The submenu of each submenu trigger, by element. */
const submenus = new WeakMap<Element, MenuContext>();

export function registerMenuItem(element: Element, item: { disabled(): boolean }) {
  menuItems.set(element, item);
  return () => menuItems.delete(element);
}

export function registerSubmenuTrigger(element: Element, submenu: MenuContext) {
  submenus.set(element, submenu);
  return () => submenus.delete(element);
}

export function submenuOf(element: Element | null | undefined) {
  return element ? submenus.get(element) : undefined;
}

// A popup that covers the view leaves no room for a swipe outside, so a touch open locks the page.
const FULL_WIDTH_TOLERANCE = 20;

interface MenuRootOptions {
  open?: boolean | undefined;
  defaultOpen: boolean;
  triggerId?: string | null | undefined;
  defaultTriggerId?: string | null | undefined;
  handle?: MenuHandle<any> | undefined;
  modal?: boolean | undefined;
  disabled: boolean;
  orientation: MenuRootOrientation;
  loopFocus: boolean;
  highlightItemOnHover: boolean;
  closeParentOnEsc?: boolean | undefined;
}

/** The `emit` of a root part. A submenu root has no `update:triggerId`. */
type MenuRootEmit = (...args: any[]) => void;

export function useMenuRoot<Payload>(
  props: MenuRootOptions,
  emit: MenuRootEmit,
  place: 'root' | 'submenu' | 'context',
) {
  const parent = place === 'submenu' ? injectMenu('SubmenuRoot') : null;
  const injectedBar = place === 'root' ? inject(menubarKey, null) : null;
  // Only the root directly in a `Menu.FilterProvider` filters its items.
  const provider = place === 'context' ? null : inject(filterProviderKey, null);
  provide(filterProviderKey, null);

  // The open closes another menu of the menubar.
  let replacesSibling = false;
  // The event of the last accepted open, for the close of the menu that it replaces.
  let openEvent: Event | undefined;
  const root = usePopupRoot<Payload>({
    name: 'Menu',
    open: () => props.open,
    defaultOpen: props.defaultOpen,
    triggerId: () => props.triggerId,
    defaultTriggerId: props.defaultTriggerId ?? null,
    handle: () => props.handle,
    emitChange(open, details) {
      const event = details.event;
      if (!open && details.reason === 'escape-key' && props.closeParentOnEsc && parent) {
        details.allowPropagation();
      }
      emit('openChange', open, details);
      if (details.isCanceled) return;
      if (!open) {
        // A menu closes its submenu first, so that the focus goes back from the inside out.
        openChild.value?.root.request(false, details.reason, event);
        return;
      }
      const sibling = parent ? parent.openChild : (menubar.value?.openMenu ?? null);
      replacesSibling = !!sibling && sibling !== context;
      openEvent = event;
    },
    emitOpen: (open) => emit('update:open', open),
    emitTriggerId: (id) => emit('update:triggerId', id),
    instantOf(open, reason, event) {
      if (kind.value === 'menubar') {
        if (reason === 'sibling-open' || reason === 'list-navigation') return 'group';
        if (open && replacesSibling) return 'group';
      }
      // A `contextmenu` and a `pointerdown` also have `detail` 0 in some browsers.
      const keyClick = event.type === 'click' && (event as MouseEvent).detail === 0;
      if (reason === 'trigger-press' && keyClick) return 'click';
      if (!open && (reason === 'escape-key' || reason === 'none')) return 'dismiss';
      return undefined;
    },
  });

  const menubar = computed<MenubarForMenu | null>(
    () => injectedBar ?? menubarOfTrigger(root.activeTrigger) ?? null,
  );
  const kind = computed<MenuKind>(() =>
    place === 'submenu'
      ? 'submenu'
      : place === 'context'
        ? 'context'
        : menubar.value
          ? 'menubar'
          : 'menu',
  );
  const disabled = computed(
    () => props.disabled || !!parent?.disabled || !!menubar.value?.disabled,
  );
  const openChild = shallowRef<MenuContext | null>(null);
  const lastChild = shallowRef<MenuContext | null>(null);
  const positioner = shallowRef<HTMLElement | null>(null);
  const placed = shallowRef(false);
  const listElement = shallowRef<HTMLElement | null>(null);
  const finalFocus = shallowRef<FocusTarget>();
  const hover = shallowRef<{ readonly inTriangle: boolean; readonly closeDelay: number } | null>(
    null,
  );
  // A context menu that opens with no press, as with `defaultOpen`, opens at the top left of the
  // view.
  const anchor = shallowRef<VirtualElement | undefined>(
    place === 'context' ? { getBoundingClientRect: () => new DOMRect() } : undefined,
  );
  const filter = provider ? useMenuFilter(provider) : null;

  const fullWidth = shallowRef(false);
  watch(placed, (isPlaced) => {
    const element = positioner.value;
    fullWidth.value =
      isPlaced &&
      !!element &&
      element.offsetWidth >=
        element.ownerDocument.documentElement.clientWidth - FULL_WIDTH_TOLERANCE;
  });

  const hoverOpen = computed(() => root.reason === 'trigger-hover' && root.instant !== 'group');
  const layer = useLayer(root, () => {
    const current = kind.value;
    const modal =
      current === 'context' ||
      (current === 'menubar' ? !!menubar.value?.modal : current === 'menu' && !!props.modal);
    const blocks = modal && !hoverOpen.value && !!positioner.value;
    return {
      escape: !disabled.value,
      outsidePress: !disabled.value,
      pressStart: 'each-button',
      focusOut: current !== 'submenu',
      block: blocks,
      hide: current === 'context' ? 'aria-hidden' : false,
      trap: false,
      lockScroll: blocks && (root.interaction !== 'touch' || fullWidth.value),
      hole:
        current === 'context' ? null : current === 'menubar' ? menubar.value?.element : undefined,
      inside: current === 'menubar' ? menubar.value?.triggers : undefined,
    };
  });

  let pendingEdge: 'first' | 'last' | null = null;
  const focus = usePopupFocus(root, layer, {
    takesFocus: () => !hoverOpen.value,
    placed: () => placed.value,
    initialFocus: () => () => {
      const edge = pendingEdge;
      pendingEdge = null;
      if (filter?.input.value) {
        if (edge || root.interaction === 'mouse' || root.interaction === 'keyboard') {
          filter.input.value.focus({ preventScroll: true });
        }
        if (edge) highlightEdge(edge);
        return false;
      }
      if (edge && highlightEdge(edge)) return false;
      if (kind.value === 'submenu') return false;
      return listElement.value ?? root.popup;
    },
    finalFocus: () => {
      if (finalFocus.value !== undefined) return finalFocus.value;
      // The focus went to another menu, or to the place of the press.
      if (root.reason === 'sibling-open') return false;
      if (kind.value === 'menubar' && root.reason === 'outside-press') return false;
      return parent?.filter?.input.value ?? undefined;
    },
    restoreLostFocus: true,
    closeBefore: true,
    exit: () => context.rootMenu.root,
  });

  function highlightEdge(edge: 'first' | 'last') {
    const items = list.items();
    const item = edge === 'first' ? items[0] : items.at(-1);
    if (item) list.highlight(item, 'keyboard');
    return !!item;
  }

  const siblingTimer = useTimeout();
  const list = useList({
    orientation: () => props.orientation,
    loop: () => props.loopFocus,
    container: () => listElement.value ?? root.popup,
    owner: () => filter?.input.value ?? null,
    canLeave: () => !!filter && !filter.autoHighlight,
    hover: () => props.highlightItemOnHover && !openChild.value?.hover.value?.inTriangle,
    keepOnLeave: (item) => !!submenuOf(item.element)?.root.open || !!filter?.autoHighlight,
    onHighlight(item, reason, event) {
      emit('itemHighlighted', item?.element, {
        reason,
        event,
        label: item ? list.text(item) : undefined,
      });
      closeSiblingSubmenu(item, reason, event);
    },
  });
  const typeahead = useTypeahead(list);

  // A pointer on another item closes the open submenu after the close delay of its trigger, and a
  // pointer back on its trigger keeps it open.
  function closeSiblingSubmenu(item: ListItem | null, reason: string, event: Event | undefined) {
    const child = openChild.value;
    if (!child) return;
    if (item?.element === child.root.activeTrigger) {
      siblingTimer.clear();
      return;
    }
    if (reason !== 'pointer' || !item) return;
    siblingTimer.start(child.hover.value?.closeDelay ?? 0, () =>
      child.root.request(false, 'sibling-open', event ?? new Event('vase-ui')),
    );
  }

  // The order of these watchers matters: the focus goes back at the close, then the highlight
  // goes.
  watch(
    () => root.open,
    (open) => {
      if (open) {
        // A parent and a menubar have one open menu, also after an open by the `open` prop.
        const sibling = parent ? parent.openChild : (menubar.value?.openMenu ?? null);
        if (sibling && sibling !== context) {
          sibling.root.request(false, 'sibling-open', openEvent ?? new Event('vase-ui'));
        }
        openEvent = undefined;
      } else {
        if (list.highlighted) list.highlight(null, 'none');
        // A parent that closes with no event of the user closes its submenu.
        openChild.value?.root.request(false, 'sibling-open', new Event('vase-ui'));
      }
      if (parent) {
        if (open) parent.setOpenChild(context);
        else if (parent.openChild === context) parent.setOpenChild(null);
      }
      menubar.value?.setOpen(context, open);
    },
    { flush: 'sync' },
  );

  const cross = () => {
    const container = listElement.value ?? root.popup;
    const rtl =
      !!container && ownerWindow(container).getComputedStyle(container).direction === 'rtl';
    if (props.orientation === 'horizontal') return { end: 'ArrowDown', start: 'ArrowUp' };
    return rtl
      ? { end: 'ArrowLeft', start: 'ArrowRight' }
      : { end: 'ArrowRight', start: 'ArrowLeft' };
  };

  function onKeydown(event: KeyboardEvent): boolean {
    if (disabled.value) return false;
    if (typeahead.onKeydown(event) || list.onKeydown(event)) return true;
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return false;
    const keys = cross();
    const submenu = submenuOf(list.highlighted?.element);
    if (event.key === keys.end && submenu && !submenu.disabled) {
      event.preventDefault();
      submenu.openWithKey('first', 'list-navigation', event, list.highlighted?.element);
      return true;
    }
    if (event.key === keys.start && parent) {
      event.preventDefault();
      root.request(false, 'list-navigation', event);
      return true;
    }
    return passUp(event);
  }

  // A key that the menu did not use goes to the parent menu, or to the menubar.
  function passUp(event: KeyboardEvent): boolean {
    if (parent) {
      if (parent.orientation === 'horizontal' && parent.list.onKeydown(event)) {
        root.request(false, 'list-navigation', event);
        return true;
      }
      return parent.passUp(event);
    }
    return !!menubar.value?.onMenuKey(event, context);
  }

  const drag = shallowRef<MenuPress | null>(null);
  watch(
    drag,
    (press, _, onCleanup) => {
      if (!press) return;
      onCleanup(
        addEventListener(
          ownerDocument(press.trigger),
          'pointerup',
          (event) => {
            drag.value = null;
            release(press, event);
          },
          true,
        ),
      );
    },
    { flush: 'sync' },
  );
  function startDrag(press: MenuPress) {
    drag.value = press;
  }

  function release(press: MenuPress, event: PointerEvent) {
    if (!root.open || isReleaseAtPressPoint({ clientX: press.x, clientY: press.y }, event)) return;
    const elapsed = event.timeStamp - press.time;
    const path = event.composedPath().filter(isElement);
    const item = path.find((node) => menuItems.has(node));
    if (item && isInPopup(layer, item)) {
      if (!submenus.has(item) && !menuItems.get(item)?.disabled() && elapsed >= press.itemDelay) {
        (item as HTMLElement).focus({ preventScroll: true });
        dispatchClickWithModifiers(item, event, { detail: 1, pointerType: 'mouse' });
      }
      return;
    }
    if (path.some((node) => node === press.trigger || isInPopup(layer, node))) return;
    if (elapsed >= press.outsideDelay) root.request(false, 'cancel-open', event);
  }

  const context: MenuContext<Payload> = {
    root,
    layer,
    get kind() {
      return kind.value;
    },
    parent,
    get rootMenu() {
      return parent?.rootMenu ?? context;
    },
    get menubar() {
      return menubar.value;
    },
    list,
    typeahead,
    focus,
    get orientation() {
      return props.orientation;
    },
    get disabled() {
      return disabled.value;
    },
    get hoverOpen() {
      return hoverOpen.value;
    },
    get openChild() {
      return openChild.value;
    },
    get childLeaving() {
      return !!lastChild.value?.root.leaving;
    },
    filter,
    get anchor() {
      return anchor.value;
    },
    hover,
    positioner,
    placed,
    listElement,
    finalFocus,
    viewport: shallowRef(null),
    inside: (element) => isInPopup(layer, element),
    openWithKey(edge, reason, event, trigger) {
      pendingEdge = edge;
      root.request(true, reason, event, trigger);
      if (!root.open) pendingEdge = null;
      // An open menu that has the focus highlights the item at once.
      else if (placed.value && reason !== 'trigger-press') {
        pendingEdge = null;
        highlightEdge(edge);
      }
    },
    onKeydown,
    passUp,
    close(reason, event) {
      context.rootMenu.root.request(false, reason, event);
    },
    startDrag,
    setAnchor(value) {
      anchor.value = value;
    },
    setOpenChild(child) {
      openChild.value = child;
      if (child) lastChild.value = child;
    },
  };
  contexts.set(root, context);
  provide(menuKey, context as MenuContext);
  filter?.connect(context);

  return {
    root,
    context,
    /** Asks for a close with the reason `'imperative-action'`. */
    close() {
      root.request(false, 'imperative-action', new Event('vase-ui'));
    },
  };
}

function missing(part: string): never {
  throw new Error(
    `Vase UI: <Menu.${part}> must be inside <Menu.Root>, <Menu.SubmenuRoot> or <ContextMenu.Root>. Without a root the part has no menu. Put the part inside a root of a menu.`,
  );
}

/** The menu of the part. A part with no menu throws an error that names it. */
export function injectMenu(part: string) {
  return inject(menuKey, null) ?? missing(part);
}

/**
 * The menu of a trigger: the root of its `handle`, else the root around it. A trigger with a
 * `handle` and no mounted root is closed.
 */
export function useTriggerMenu(handle: () => MenuHandle | undefined) {
  const injected = inject(menuKey, null);
  if (!injected && !handle()) {
    throw new Error(
      'Vase UI: <Menu.Trigger> must be inside <Menu.Root>, or it must have a `handle`. Without a root the trigger has no menu to open. Put the trigger inside <Menu.Root>, or pass a `handle`.',
    );
  }
  return computed(() => {
    const given = handle();
    if (!given) return injected;
    const root = rootOfHandle(given);
    return root ? (contexts.get(root) ?? null) : null;
  });
}

/** Marks the parts in a `Menu.Portal`. */
export function providePortal() {
  provide(portalKey, true);
}

/** `Menu.Positioner` and `Menu.Backdrop` need a portal of their menu. */
export function injectPortal(part: string) {
  if (!inject(portalKey, false)) {
    throw new Error(
      `Vase UI: <Menu.${part}> must be inside <Menu.Portal>. Put the part inside <Menu.Portal>.`,
    );
  }
}

/** The placement of the positioner around the part. A part with no positioner throws an error. */
export function injectPositioner(part: string) {
  const placement = inject(positionerKey, null);
  if (!placement) {
    throw new Error(
      `Vase UI: <Menu.${part}> must be inside <Menu.Positioner>. Put the part inside <Menu.Positioner>.`,
    );
  }
  return placement;
}
