import type { ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type { FocusTarget } from '../popup/focus';
import type { Align, PlacementProps, Side } from '../popup/placement';
import type { PopupPortalProps } from '../popup/portal';
import type { InteractionType, PopupChangeEventDetails } from '../popup/root';
import type { PopoverHandle } from './root';

export type {
  Align,
  Anchor,
  Boundary,
  CollisionAvoidance,
  OffsetFunction,
  Side,
  VirtualElement,
} from '../popup/placement';
export type { FocusTarget, InteractionType };

export type PopoverRootChangeEventReason =
  | 'trigger-hover'
  | 'trigger-focus'
  | 'trigger-press'
  | 'outside-press'
  | 'escape-key'
  | 'close-press'
  | 'focus-out'
  | 'imperative-action'
  | 'none';

export type PopoverRootChangeEventDetails = PopupChangeEventDetails<PopoverRootChangeEventReason>;

export interface PopoverRootProps<Payload = unknown> {
  /** The popover is open. `v-model:open` binds it. */
  open?: boolean | undefined;
  /**
   * The popover is open at the mount of an uncontrolled root.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /** The `id` of the active trigger. `v-model:trigger-id` binds it. */
  triggerId?: string | null | undefined;
  /**
   * The `id` of the active trigger at the mount, with `defaultOpen`.
   * @default null
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * The modal state of the open popover:
   * - `false`: the page stays in use.
   * - `true`: the page does not scroll and gets no pointer. With a `Popover.Close` in the popup,
   *   the focus stays in the popup and the rest of the page is inert.
   * - `'trap-focus'`: with a `Popover.Close` in the popup, the focus stays in the popup, and the
   *   page stays in use.
   * @default false
   */
  modal?: boolean | 'trap-focus' | undefined;
  /** Connects the root to triggers outside it and to code. */
  handle?: PopoverHandle<Payload> | undefined;
}

export interface PopoverRootState {}

export interface PopoverTriggerProps<Payload = unknown>
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  id?: string | undefined;
  /**
   * The user cannot press the trigger.
   * @default false
   */
  disabled?: boolean | undefined;
  /** The payload that the popover gets when this trigger opens it. */
  payload?: Payload | undefined;
  /** Connects the trigger to a root outside it. */
  handle?: PopoverHandle<Payload> | undefined;
  /**
   * A mouse that rests on the trigger also opens the popover.
   * @default false
   */
  openOnHover?: boolean | undefined;
  /**
   * The time in milliseconds that the mouse rests on the trigger before the open, with
   * `openOnHover`.
   * @default 300
   */
  delay?: number | undefined;
  /**
   * The time in milliseconds before the close, after the pointer left the trigger and the popup,
   * with `openOnHover`.
   * @default 0
   */
  closeDelay?: number | undefined;
}

export interface PopoverTriggerState {
  /** The popover is open for this trigger. */
  open: boolean;
  disabled: boolean;
}

export interface PopoverPortalProps extends PopupPortalProps {}

export interface PopoverPortalState {}

export interface PopoverBackdropProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface PopoverBackdropState {
  open: boolean;
}

export interface PopoverPositionerProps
  extends AsProps, PlacementProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface PopoverPositionerState {
  open: boolean;
  /** The side of the anchor that the popup is on. */
  side: Side;
  align: Align;
  /** The anchor is out of view. */
  anchorHidden: boolean;
  instant: string | undefined;
}

export interface PopoverPopupProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
  /**
   * The element that gets the focus at the open. By default: the element with `autofocus`, else the
   * first tab stop, else the popup; after a touch, the popup.
   */
  initialFocus?: FocusTarget | undefined;
  /**
   * The element that gets the focus at the close. By default: the trigger, else the element that
   * had the focus before the open.
   */
  finalFocus?: FocusTarget | undefined;
}

export interface PopoverPopupState {
  open: boolean;
  side: Side;
  align: Align;
  /**
   * Why a style should skip its animation: `'click'` (a key on the trigger), `'dismiss'` (Escape),
   * `'focus'` (the focus left), `'trigger-change'` (a move to another trigger).
   */
  instant: string | undefined;
}

export interface PopoverArrowProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface PopoverArrowState {
  open: boolean;
  side: Side;
  align: Align;
  /** The arrow cannot point to the center of the anchor. */
  uncentered: boolean;
}

export interface PopoverTitleProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
}

export interface PopoverTitleState {}

export interface PopoverDescriptionProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
}

export interface PopoverDescriptionState {}

export interface PopoverCloseProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface PopoverCloseState {
  disabled: boolean;
}

export interface PopoverViewportProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface PopoverViewportState {
  /** The side of the new trigger from the old one, such as `'right down'`. */
  activationDirection: string | undefined;
  /** The popup moves to another trigger. */
  transitioning: boolean;
  instant: string | undefined;
}
