import type { Placement, VirtualElement } from '@floating-ui/vue';
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { PopupTriggerMap } from './popupTriggerMap';
import type { FloatingTreeStore } from './tree/FloatingTreeStore';

export type ReferenceType = Element | VirtualElement;

export type Delay = number | Partial<{ open: number; close: number }>;

export type NarrowedElement<T> = T extends Element ? T : Element;

export interface ExtendedElements {
  reference: ReferenceType | null;
  floating: HTMLElement | null;
  domReference: NarrowedElement<ReferenceType> | null;
}

export interface PopupEvents {
  emit<T extends string>(event: T, data?: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

/**
 * Reads the interaction state of a popup by key.
 */
export interface PopupInteractionReader {
  (key: 'open'): boolean;
  (key: 'transitionStatus'): TransitionStatus | undefined;
  /**
   * The element of the active trigger. A popup store keeps it after the popup unmounts.
   * `FloatingRootStore` clears it while the popup is not mounted.
   */
  (key: 'anchorElement'): Element | null;
  /**
   * The anchor that the interaction composables see. It is the anchor override, such as the cursor
   * position from `useClientPoint`, or else the anchor of the owner, usually the active trigger.
   * It does not include the `anchor` prop of a positioner, because positioning applies that prop
   * itself.
   */
  (key: 'anchor'): ReferenceType | null;
  /**
   * The positioner element of the popup, or the popup itself when it has no positioner.
   */
  (key: 'positionerElement'): HTMLElement | null;
  /**
   * The id of the popup, unless its element sets one.
   */
  (key: 'defaultPopupId'): string | undefined;
}

/**
 * Plain values that the interaction composables of one popup share.
 * A detached trigger uses an inert store before a root attaches, and `getEmptyRootStore` gives
 * another. Both stores freeze their context, so code that can run against them only reads these
 * fields.
 */
export interface PopupInteractionContext {
  readonly events: PopupEvents;
  nested: boolean;
  readonly triggerElements: PopupTriggerMap;
  /**
   * The event that opened the popup. `dispatchOpenChange` writes it. Navigation Menu clears it.
   */
  openEvent?: Event | undefined;
  /**
   * The orientation of the list navigation of the popup. A nested list reads it from its parent.
   * `useListNavigation` writes it.
   */
  orientation?: 'vertical' | 'horizontal' | 'both' | undefined;
  /**
   * What the popup gives to the other popups of its tree. The positioning composable writes it.
   */
  positioning?: PopupPositioningContext | undefined;
  /**
   * Whether the current event went through the popup element, or through the element of a popup
   * below it in the component tree, such as a popup that `Teleport` moved. A document listener that
   * sees the event as outside then ignores it. `useDismiss` and the focus manager set it, and it
   * is cleared in the next task.
   */
  insideComponentTree?: boolean | undefined;
  /**
   * Whether an Escape key press bubbles to the parent popup. `useDismiss` writes it and never
   * clears it.
   */
  escapeKeyBubbles?: boolean | undefined;
  /**
   * Whether an outside press bubbles to the parent popup. `useDismiss` writes it and never clears
   * it.
   */
  outsidePressBubbles?: boolean | undefined;
}

/**
 * The store that the interaction composables, the focus manager and positioning read and write.
 * A popup store implements it directly. Navigation Menu and Toast keep their open state outside a
 * store, so they use `FloatingRootStore`.
 */
export interface PopupInteractionStore {
  select: PopupInteractionReader;
  set(key: 'anchorOverride', value: ReferenceType | null): void;
  set(key: 'anchorElement', value: Element | null): void;
  setOpen(open: boolean, eventDetails: VaseUIChangeEventDetails<string>): void;
  readonly context: PopupInteractionContext;
}

/**
 * The store that anchor positioning reads and clears. A popup store and `FloatingRootStore`
 * implement it. The narrower handle stores that triggers use do not need to.
 */
export interface PositioningInteractionStore extends PopupInteractionStore {
  /**
   * Forgets the elements that positioning reads while the popup is not mounted. Positioning then
   * does not run for a closed `keepMounted` popup.
   */
  clearPositioning(): void;
}

/**
 * What the positioner of a popup gives to the interaction composables of the popup and to the other
 * popups of its tree. `open` is a plain value. Each other member that can change is a getter, so a
 * read gives the current value.
 */
export interface PopupPositioningContext {
  /**
   * Whether the popup was open at the last DOM update. A popup above reads it in the event in which
   * this popup closes. Thus the writer sets it in a `watch` with `flush: 'post'`, not in the write
   * that closes the popup.
   */
  open: boolean;
  /**
   * The placement that the popup has now, after a flip.
   */
  placement?: Placement | undefined;
  nodeId: string | undefined;
  elements: ExtendedElements;
  rootStore: PopupInteractionStore;
}

export interface FloatingNodeType {
  id: string | undefined;
  parentId: string | null;
  context?: PopupPositioningContext | undefined;
}

export type FloatingTreeType = FloatingTreeStore;

type CaptureListeners = {
  [name: `on${string}Capture` | `on${string}CapturePassive`]: ((event: any) => void) | undefined;
};

/**
 * The attributes and listeners that an interaction composable gives to one element. Vue declares
 * no listener with the `Capture` suffix, and it reads the suffix when it adds the listener.
 */
export type InteractionProps = HTMLAttributes & CaptureListeners;

export interface ElementProps {
  reference?: InteractionProps | undefined;
  floating?: InteractionProps | undefined;
  item?: InteractionProps | undefined;
  trigger?: InteractionProps | undefined;
}

/**
 * The props that `useDismiss` returns. Each handler does nothing while the composable is not
 * enabled, so the object always has the three members.
 */
export type DismissElementProps = Required<
  Pick<ElementProps, 'reference' | 'floating' | 'trigger'>
>;

/**
 * The props that `useClick` returns. Each handler does nothing while the composable is not enabled,
 * so the object always has the `reference` member.
 */
export type ClickElementProps = Required<Pick<ElementProps, 'reference'>>;
