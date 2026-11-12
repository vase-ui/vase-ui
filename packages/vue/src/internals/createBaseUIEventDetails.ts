import { EMPTY_OBJECT } from '../common/empty';
import type { REASONS } from './reasons';

interface ReasonToEventMap {
  [REASONS.none]: Event;

  [REASONS.triggerPress]: MouseEvent | PointerEvent | TouchEvent | KeyboardEvent;
  [REASONS.triggerHover]: MouseEvent;
  [REASONS.triggerFocus]: FocusEvent;

  [REASONS.outsidePress]: MouseEvent | PointerEvent | TouchEvent;
  [REASONS.itemPress]: MouseEvent | KeyboardEvent | PointerEvent;
  [REASONS.closePress]: MouseEvent | KeyboardEvent | PointerEvent;
  [REASONS.linkPress]: MouseEvent | PointerEvent;
  [REASONS.clearPress]: PointerEvent | MouseEvent | KeyboardEvent;
  [REASONS.chipRemovePress]: PointerEvent | MouseEvent | KeyboardEvent;
  [REASONS.trackPress]: PointerEvent | MouseEvent | TouchEvent;
  [REASONS.incrementPress]: PointerEvent | MouseEvent | TouchEvent;
  [REASONS.decrementPress]: PointerEvent | MouseEvent | TouchEvent;

  [REASONS.inputChange]: InputEvent | Event;
  [REASONS.inputClear]: InputEvent | FocusEvent | Event;
  [REASONS.inputBlur]: FocusEvent;
  [REASONS.inputPaste]: ClipboardEvent;
  [REASONS.inputPress]: MouseEvent | PointerEvent | TouchEvent | KeyboardEvent;

  [REASONS.focusOut]: FocusEvent | KeyboardEvent;
  [REASONS.escapeKey]: KeyboardEvent;
  [REASONS.closeWatcher]: Event;
  [REASONS.listNavigation]: KeyboardEvent;
  [REASONS.keyboard]: KeyboardEvent;

  [REASONS.pointer]: PointerEvent;
  [REASONS.drag]: PointerEvent | TouchEvent;
  [REASONS.swipe]: PointerEvent | TouchEvent;
  [REASONS.wheel]: WheelEvent;
  [REASONS.scrub]: PointerEvent;

  [REASONS.cancelOpen]: MouseEvent;
  [REASONS.siblingOpen]: Event;
  [REASONS.disabled]: Event;
  [REASONS.missing]: Event;
  [REASONS.initial]: Event;
  [REASONS.imperativeAction]: Event;

  [REASONS.windowResize]: UIEvent;
}

/**
 * Maps a change `reason` string to the corresponding native event type.
 */
export type ReasonToEvent<Reason extends string> = Reason extends keyof ReasonToEventMap
  ? ReasonToEventMap[Reason]
  : Event;

type VaseUIChangeEventDetail<Reason extends string, CustomProperties extends object> = {
  /**
   * The reason for the event.
   */
  reason: Reason;
  /**
   * The native event associated with the custom event.
   */
  event: ReasonToEvent<Reason>;
  /**
   * Cancels Vase UI from handling the event.
   */
  cancel: () => void;
  /**
   * Allows the event to propagate in cases where Vase UI will stop the propagation.
   */
  allowPropagation: () => void;
  /**
   * Indicates whether the event has been canceled.
   */
  isCanceled: boolean;
  /**
   * Indicates whether the event is allowed to propagate.
   */
  isPropagationAllowed: boolean;
  /**
   * The element that triggered the event, if applicable.
   * When a popup closes for a reason that names no element, such as Escape or an outside press,
   * this is the trigger that opened the popup, if it is still in the document.
   * Navigation Menu leaves it unset.
   */
  trigger: Element | undefined;
} & CustomProperties;

/**
 * Details of custom change events emitted by Vase UI components.
 */
export type VaseUIChangeEventDetails<
  Reason extends string,
  CustomProperties extends object = {},
> = Reason extends string ? VaseUIChangeEventDetail<Reason, CustomProperties> & {} : never;

/**
 * Details of custom generic events emitted by Vase UI components.
 */
type VaseUIGenericEventDetail<Reason extends string, CustomProperties extends object> = {
  /**
   * The reason for the event.
   */
  reason: Reason;
  /**
   * The native event associated with the custom event.
   */
  event: ReasonToEvent<Reason>;
} & CustomProperties;

export type VaseUIGenericEventDetails<
  Reason extends string,
  CustomProperties extends object = {},
> = Reason extends string ? VaseUIGenericEventDetail<Reason, CustomProperties> & {} : never;

/** Highlight navigation uses mouse events for hover and pointer events for leaving an item. */
export type VaseUIHighlightEventDetails<
  Reason extends string,
  CustomProperties extends object = {},
> = Reason extends typeof REASONS.pointer
  ? { reason: Reason; event: MouseEvent | PointerEvent } & CustomProperties
  : VaseUIGenericEventDetails<Reason, CustomProperties>;

/**
 * Creates a Vase UI event details object with the given reason and utilities
 * for preventing the internal event handling of Vase UI.
 */
export function createChangeEventDetails<
  Reason extends string,
  CustomProperties extends object = {},
>(
  reason: Reason,
  event?: ReasonToEvent<Reason>,
  trigger?: Element,
  customProperties?: CustomProperties,
): VaseUIChangeEventDetails<Reason, CustomProperties> {
  let canceled = false;
  let allowPropagation = false;
  const custom = customProperties ?? (EMPTY_OBJECT as CustomProperties);
  const details: VaseUIChangeEventDetail<Reason, CustomProperties> = {
    reason,
    event: (event ?? new Event('vase-ui')) as ReasonToEvent<Reason>,
    cancel() {
      canceled = true;
    },
    allowPropagation() {
      allowPropagation = true;
    },
    get isCanceled() {
      return canceled;
    },
    get isPropagationAllowed() {
      return allowPropagation;
    },
    trigger,
    ...custom,
  };
  return details as VaseUIChangeEventDetails<Reason, CustomProperties>;
}

export function createGenericEventDetails<
  Reason extends keyof ReasonToEventMap,
  CustomProperties extends object = {},
>(
  reason: Reason,
  event?: ReasonToEvent<Reason>,
  customProperties?: CustomProperties,
): VaseUIGenericEventDetails<Reason, CustomProperties> {
  const custom = customProperties ?? (EMPTY_OBJECT as CustomProperties);
  const details: VaseUIGenericEventDetail<Reason, CustomProperties> = {
    reason,
    event: (event ?? new Event('vase-ui')) as ReasonToEvent<Reason>,
    ...custom,
  };
  return details as VaseUIGenericEventDetails<Reason, CustomProperties>;
}
