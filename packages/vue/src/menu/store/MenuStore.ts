import { shallowRef, toRaw } from 'vue';
import type { Ref, ShallowRef } from 'vue';
import { EMPTY_OBJECT, NOOP } from '../../common/empty';
import { platform } from '../../common/platform';
import type { InteractionType } from '../../common/useEnhancedClickHandler';
import { Timeout } from '../../common/useTimeout';
import { REASONS } from '../../internals/reasons';

import { NullStore } from '../../utils/popups/NullStore';
import type { AdaptiveOriginMiddleware } from '../../utils/popups/positioning/adaptiveOriginConstants';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  popupStoreSelectors,
} from '../../utils/popups/store';
import type {
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerStoreKeys,
} from '../../utils/popups/store';
import { FloatingTreeStore } from '../../utils/popups/tree/FloatingTreeStore';
import type {
  MenuParent,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootHighlightEventReason,
} from '../root/MenuRoot.vue';
import { isKeyboardClick, isKeyboardOpen } from '../utils/isKeyboardOpen';

type PopupProps = PopupStoreState<unknown>['popupProps'];

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  modal: boolean | undefined;
  openMethod: InteractionType | null;
  /** Whether the popup last opened from the keyboard or an assistive-technology press. */
  keyboardOpen: boolean;
  allowMouseEnter: boolean;
  highlightItemOnHover: boolean;
  parent: MenuParent;
  rootId: string | undefined;
  activeIndex: number | null;
  /** The `Menu.List` element, which takes the `menu` role from the popup when rendered. */
  listElement: HTMLElement | null;
  /**
   * Props a filter root adds to its triggers (dialog semantics and the key relay to the input).
   * Published by the filter implementation so a plain menu never bundles them.
   */
  filterTriggerProps: PopupProps;
  /** List navigation props for the element that holds real focus under virtual focus. */
  inputProps: PopupProps;
  /** Whether this menu's filter input has focus. */
  inputFocused: boolean;
  /** The element at `activeIndex` once the item list settles. Only virtual focus publishes it. */
  highlightedItem: HTMLElement | undefined;
  hoverEnabled: boolean;
  instantType: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
  openChangeReason: MenuRootChangeEventReason | null;
  floatingTreeRoot: FloatingTreeStore;
  floatingNodeId: string | undefined;
  floatingParentNodeId: string | null;
  itemProps: PopupProps;
  closeDelay: number;
  keyboardEventRelay: ((event: KeyboardEvent) => void) | undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

type Context = PopupStoreContext<MenuRootChangeEventDetails> & {
  readonly positionerRef: ShallowRef<HTMLElement | null>;
  readonly typingRef: ShallowRef<boolean>;
  readonly itemDomElements: ShallowRef<(HTMLElement | null)[]>;
  readonly itemLabels: ShallowRef<(string | null)[]>;
  /** Why the next `activeIndex` write happens, consumed by `itemHighlighted` after the DOM update. */
  highlightReason: MenuRootHighlightEventReason;
  /** The event that caused the next `activeIndex` write, reported along with `highlightReason`. */
  highlightEvent: Event | undefined;
  /** The item last reported as highlighted, kept in every menu so reasons compare against it. */
  reportedItem: HTMLElement | undefined;
  allowMouseUpTriggerRef: Ref<boolean>;
  /** The element that holds real focus while virtual list navigation is active. */
  virtualFocusRef: Readonly<Ref<HTMLElement | null>> | undefined;
  /** Whether a filterable menu's trigger was last pressed by a screen reader. */
  virtualPress?: boolean | undefined;
  readonly triggerFocusTargetRef: ShallowRef<HTMLElement | null>;
  readonly beforeTriggerFocusGuardRef: ShallowRef<HTMLElement | null>;
  readonly beforeContentFocusGuardRef: ShallowRef<HTMLElement | null>;
  /**
   * The event of the menu's last open change, unlike `openEvent`, which keeps the event of a
   * click open when a hover open follows. Cleared once the menu is closed.
   */
  lastOpenChangeEvent: Event | undefined;
  /**
   * Whether a touch click may close the menu. Some mobile browsers fire `focus` and then a delayed
   * `click` for one tap, so a focus-open briefly ignores touch clicks.
   */
  allowTouchToClose: boolean;
  readonly allowTouchToCloseTimeout: Timeout;
  /**
   * Returns the open state the `Menu.Root` rendered last, which tells a repeated request apart.
   * Set only while the root is mounted, so open changes requested while it isn't are dropped.
   */
  getCommittedOpenState: (() => MenuCommittedOpenState) | undefined;
};

/**
 * The open state a `Menu.Root` rendered last.
 */
export interface MenuCommittedOpenState {
  open: boolean;
  activeTriggerElement: Element | null;
  openChangeReason: MenuRootChangeEventReason | null;
}

const selectors = {
  ...popupStoreSelectors,
  disabled: (state: State<unknown>) =>
    state.parent.type === 'menubar'
      ? state.parent.context.disabled.value || state.disabled
      : state.disabled,
  modal: (state: State<unknown>) =>
    (state.parent.type === undefined || state.parent.type === 'context-menu') &&
    (state.modal ?? true),
  openMethod: (state: State<unknown>) => state.openMethod,
  keyboardOpen: (state: State<unknown>) => state.keyboardOpen,

  allowMouseEnter: (state: State<unknown>) => state.allowMouseEnter,
  highlightItemOnHover: (state: State<unknown>) => state.highlightItemOnHover,
  parent: (state: State<unknown>) => state.parent,
  rootId: (state: State<unknown>): string | undefined => {
    if (state.parent.type === 'menu') {
      return state.parent.store.select('rootId');
    }

    return state.parent.type !== undefined ? state.parent.context.rootId.value : state.rootId;
  },
  activeIndex: (state: State<unknown>) => state.activeIndex,
  listElement: (state: State<unknown>) => state.listElement,
  /** The trigger's `aria-controls`: the list when one holds the `menu` role, else the popup. */
  triggerControlsId: (state: State<unknown>, triggerId: string | undefined) => {
    const popupId = popupStoreSelectors.triggerPopupId(state, triggerId);
    return popupId ? state.listElement?.id || popupId : undefined;
  },
  filterTriggerProps: (state: State<unknown>) => state.filterTriggerProps,
  inputProps: (state: State<unknown>) => state.inputProps,
  // `aria-selected` is invalid on `menuitem`, but Safari VoiceOver needs it for arrow-key
  // navigation. Limit it to WebKit while the input has focus so normal VoiceOver navigation
  // does not encounter the invalid attribute.
  webkitAriaSelected: (state: State<unknown>, highlighted: boolean) =>
    platform.engine.webkit && state.inputFocused && highlighted ? true : undefined,
  highlightedItemId: (state: State<unknown>) => state.highlightedItem?.id || undefined,
  isActive: (state: State<unknown>, itemIndex: number) => state.activeIndex === itemIndex,
  highlightedWhileOpen: (state: State<unknown>, highlighted: boolean) =>
    highlighted && popupStoreSelectors.open(state),
  hoverEnabled: (state: State<unknown>) => state.hoverEnabled,
  // `trigger-change` describes a popup moving between triggers, which only has
  // meaning while it is open. Dropping it once closed keeps a late or stale
  // restoration from marking a closing popup instant and skipping its exit
  // transition, including on close paths that never reach `setOpen` — a
  // controlled consumer committing `open={false}` goes straight through the prop.
  instantType: (state: State<unknown>) =>
    state.instantType === 'trigger-change' && !popupStoreSelectors.open(state)
      ? undefined
      : state.instantType,
  lastOpenChangeReason: (state: State<unknown>) => state.openChangeReason,
  floatingTreeRoot: (state: State<unknown>): FloatingTreeStore => {
    if (state.parent.type === 'menu') {
      return state.parent.store.select('floatingTreeRoot');
    }

    return state.floatingTreeRoot;
  },
  floatingNodeId: (state: State<unknown>) => state.floatingNodeId,
  floatingParentNodeId: (state: State<unknown>) => state.floatingParentNodeId,
  itemProps: (state: State<unknown>) => state.itemProps,
  closeDelay: (state: State<unknown>) => state.closeDelay,
  adaptiveOrigin: (state: State<unknown>): AdaptiveOriginMiddleware | undefined =>
    state.adaptiveOrigin,
  keyboardEventRelay: (state: State<unknown>): ((event: KeyboardEvent) => void) | undefined => {
    if (state.keyboardEventRelay) {
      return state.keyboardEventRelay;
    }

    if (state.parent.type === 'menu') {
      return state.parent.store.select('keyboardEventRelay');
    }

    return undefined;
  },
};

type Selectors = typeof selectors;

/**
 * The subset of `MenuStore` that detached handle-backed triggers rely on: the members for the
 * trigger data, and `setOpen`. Both the real `MenuStore` and the inert fallback store satisfy it,
 * so a trigger can read from whichever store the handle currently exposes. On the inert store,
 * each write does nothing.
 */
export type MenuHandleStore<Payload> = Pick<MenuStore<Payload>, PopupTriggerStoreKeys | 'setOpen'>;

export class MenuStore<Payload> extends BasePopupStore<
  State<Payload>,
  Context,
  Selectors,
  MenuRootChangeEventDetails
> {
  constructor(initialState?: Partial<State<Payload>>, defaultPopupId?: string) {
    super(
      createInitialState<Payload>(defaultPopupId, initialState),
      createInitialContext(),
      selectors,
    );

    this.shareMouseUpTriggerRef(toRaw(this.state).parent);
  }

  // A store makes no watcher, so the write that changes `parent` shares the ref of the new parent.
  override setState(newState: Readonly<State<Payload>>): void {
    const previousParent = toRaw(this.state).parent;
    super.setState(newState);
    const parent = toRaw(this.state).parent;
    if (parent !== previousParent) {
      this.shareMouseUpTriggerRef(parent);
    }
  }

  private shareMouseUpTriggerRef(parent: MenuParent) {
    if (parent.type === 'menu') {
      this.context.allowMouseUpTriggerRef = parent.store.context.allowMouseUpTriggerRef;
    } else if (parent.type !== undefined) {
      this.context.allowMouseUpTriggerRef = parent.context.allowMouseUpTriggerRef;
    }
  }

  protected override isOpenChangeIgnored(
    nextOpen: boolean,
    eventDetails: MenuRootChangeEventDetails,
  ) {
    const getCommittedOpenState = this.context.getCommittedOpenState;
    if (!getCommittedOpenState) {
      return true;
    }

    // Some mobile browsers fire `focus` and then a delayed `click` for one tap. Without this guard,
    // a menu that opened on focus would close on the click right away.
    const nativeEvent = eventDetails.event as Event | undefined;
    if (
      !nextOpen &&
      eventDetails.reason !== REASONS.itemPress &&
      nativeEvent?.type === 'click' &&
      (nativeEvent as PointerEvent).pointerType === 'touch' &&
      !this.context.allowTouchToClose
    ) {
      return true;
    }

    // Repeated requests are compared against what the root rendered last.
    const committed = getCommittedOpenState();
    return (
      committed.open === nextOpen &&
      eventDetails.trigger === committed.activeTriggerElement &&
      committed.openChangeReason === eventDetails.reason
    );
  }

  protected override getCloseTrigger() {
    // Reports the trigger the root last rendered, which repeated requests are compared against.
    // The store can already hold a newer trigger from a request that hasn't rendered yet.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- `isOpenChangeIgnored` drops each request while the root has not set `getCommittedOpenState`.
    return this.context.getCommittedOpenState!().activeTriggerElement;
  }

  protected override prepareOpenChange(
    nextOpen: boolean,
    eventDetails: MenuRootChangeEventDetails,
  ) {
    const reason = eventDetails.reason;
    const nativeEvent = eventDetails.event as Event | undefined;

    if (nextOpen && reason === REASONS.triggerFocus) {
      this.context.allowTouchToClose = false;
      this.context.allowTouchToCloseTimeout.start(300, () => {
        this.context.allowTouchToClose = true;
      });
    } else {
      this.context.allowTouchToClose = true;
      this.context.allowTouchToCloseTimeout.clear();
    }

    this.context.lastOpenChangeEvent = eventDetails.event;

    let instantType: State<Payload>['instantType'];
    if (
      toRaw(this.state).parent.type === 'menubar' &&
      (reason === REASONS.triggerFocus ||
        reason === REASONS.focusOut ||
        reason === REASONS.triggerHover ||
        reason === REASONS.listNavigation ||
        reason === REASONS.siblingOpen)
    ) {
      instantType = 'group';
    } else if (isKeyboardClick(reason, nativeEvent)) {
      instantType = 'click';
    } else if (!nextOpen && (reason === REASONS.escapeKey || reason == null)) {
      instantType = 'dismiss';
    }

    return {
      keyboardOpen: nextOpen && isKeyboardOpen(reason, nativeEvent),
      instantType,
    };
  }

  protected override prepareUnmount() {
    return { allowMouseEnter: false };
  }

  setActiveIndex(activeIndex: number | null, reason: MenuRootHighlightEventReason, event?: Event) {
    // Only a write that changes the index is reported. Tagging a no-op, or a write back to the
    // reported item before the change is reported, would let a later registry-driven re-emit
    // report this reason instead of `none`.
    if (toRaw(this.state).activeIndex !== activeIndex) {
      const item =
        activeIndex === null ? undefined : this.context.itemDomElements.value[activeIndex];
      const isWriteBack = item === this.context.reportedItem;
      this.context.highlightReason = isWriteBack ? 'none' : reason;
      this.context.highlightEvent = isWriteBack ? undefined : event;
    }
    this.set('activeIndex', activeIndex);
  }

  highlightItem(element: Element | null, reason: MenuRootHighlightEventReason, event?: Event) {
    const index = this.context.itemDomElements.value.indexOf(element as HTMLElement);
    if (index > -1) {
      this.setActiveIndex(index, reason, event);
    }
  }
}

/**
 * Creates the inert fallback store that detached handle-backed triggers use while no `Menu.Root`
 * is attached. It keeps a trigger registry of its own in its context, so detached triggers can
 * register before they move to the store of the root. Each write does nothing, and so does
 * `setOpen`.
 */
export function createNullMenuStore<Payload>(): MenuHandleStore<Payload> {
  const store = new NullStore<Readonly<State<Payload>>, Context, Selectors>(
    Object.freeze(createInitialState<Payload>()),
    Object.freeze(createInitialContext()),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP });
}

function createInitialContext(): Context {
  return {
    ...createPopupStoreContext(),
    positionerRef: shallowRef<HTMLElement | null>(null),
    typingRef: shallowRef(false),
    itemDomElements: shallowRef<(HTMLElement | null)[]>([]),
    itemLabels: shallowRef<(string | null)[]>([]),
    highlightReason: 'none',
    highlightEvent: undefined,
    reportedItem: undefined,
    allowMouseUpTriggerRef: shallowRef(false),
    virtualFocusRef: undefined,
    triggerFocusTargetRef: shallowRef<HTMLElement | null>(null),
    beforeTriggerFocusGuardRef: shallowRef<HTMLElement | null>(null),
    beforeContentFocusGuardRef: shallowRef<HTMLElement | null>(null),
    lastOpenChangeEvent: undefined,
    allowTouchToClose: true,
    allowTouchToCloseTimeout: new Timeout(),
    getCommittedOpenState: undefined,
  };
}

function createInitialState<Payload>(
  defaultPopupId?: string,
  initialState?: Partial<State<Payload>>,
): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    disabled: false,
    modal: true,
    openMethod: null,
    keyboardOpen: false,
    allowMouseEnter: false,
    highlightItemOnHover: true,
    parent: {
      type: undefined,
    },
    rootId: undefined,
    activeIndex: null,
    listElement: null,
    filterTriggerProps: EMPTY_OBJECT,
    inputProps: EMPTY_OBJECT,
    inputFocused: false,
    highlightedItem: undefined,
    hoverEnabled: true,
    instantType: undefined,
    openChangeReason: null,
    floatingTreeRoot: new FloatingTreeStore(),
    floatingNodeId: undefined,
    floatingParentNodeId: null,
    itemProps: EMPTY_OBJECT,
    keyboardEventRelay: undefined,
    closeDelay: 0,
    adaptiveOrigin: undefined,
    ...initialState,
  };
}
