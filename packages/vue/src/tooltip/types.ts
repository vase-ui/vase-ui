import type { ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type { Align, PlacementProps, Side } from '../popup/placement';
import type { PopupPortalProps } from '../popup/portal';
import type { PopupChangeEventDetails } from '../popup/root';
import type { TooltipHandle } from './root';

export type {
  Align,
  Anchor,
  Boundary,
  CollisionAvoidance,
  OffsetFunction,
  Side,
  VirtualElement,
} from '../popup/placement';

export type TooltipRootChangeEventReason =
  | 'trigger-hover'
  | 'trigger-focus'
  | 'trigger-press'
  | 'outside-press'
  | 'escape-key'
  | 'disabled'
  | 'imperative-action'
  | 'none';

export type TooltipRootChangeEventDetails = PopupChangeEventDetails<TooltipRootChangeEventReason>;

/**
 * Why a style should skip its animation: `'delay'` (another tooltip of the group was open),
 * `'focus'` (the focus opened the tooltip), `'dismiss'` (Escape or a press closed it).
 */
export type TooltipInstant = 'delay' | 'focus' | 'dismiss' | undefined;

export interface TooltipProviderProps {
  /** The time in milliseconds that the mouse rests on a trigger before the open. */
  delay?: number | undefined;
  /** The time in milliseconds before the close, after the pointer left. */
  closeDelay?: number | undefined;
  /**
   * The time in milliseconds after a close in which a hover opens another tooltip of the provider
   * at once.
   * @default 400
   */
  timeout?: number | undefined;
}

export interface TooltipProviderState {}

export interface TooltipRootProps<Payload = unknown> {
  /** The tooltip is open. `v-model:open` binds it. */
  open?: boolean | undefined;
  /**
   * The tooltip is open at the mount of an uncontrolled root.
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
  /** Connects the root to triggers outside it and to code. */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * The tooltip does not open, and an open tooltip closes.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The pointer cannot rest on the popup: the tooltip closes when the pointer leaves the trigger.
   * @default false
   */
  disableHoverablePopup?: boolean | undefined;
  /**
   * The axis on which the popup follows the mouse pointer on the trigger.
   * @default 'none'
   */
  trackCursorAxis?: 'none' | 'x' | 'y' | 'both' | undefined;
}

export interface TooltipRootState {}

export interface TooltipTriggerProps<Payload = unknown>
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  /**
   * The `id` of the element, with a generated `id` as the default. The `triggerId` of the root and
   * `open()` of the handle name the trigger by it.
   */
  id?: string | undefined;
  /** Connects the trigger to a root outside it. */
  handle?: TooltipHandle<Payload> | undefined;
  /** The payload that the tooltip gets when this trigger opens it. */
  payload?: Payload | undefined;
  /**
   * The tooltip does not open from this trigger. The element of the trigger stays in use.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The time in milliseconds that the mouse rests on the trigger before the open. With no value,
   * the `delay` of the `Tooltip.Provider`, else 600.
   */
  delay?: number | undefined;
  /**
   * The time in milliseconds before the close, after the pointer left the trigger and the popup.
   * With no value, the `closeDelay` of the `Tooltip.Provider`, else 0.
   */
  closeDelay?: number | undefined;
  /**
   * A press on the trigger closes the tooltip.
   * @default true
   */
  closeOnClick?: boolean | undefined;
}

export interface TooltipTriggerState {
  /** The tooltip is open for this trigger. */
  open: boolean;
  /** The tooltip does not open from this trigger. */
  disabled: boolean;
}

export interface TooltipPortalProps extends PopupPortalProps {}

export interface TooltipPortalState {}

export interface TooltipPositionerProps
  extends AsProps, PlacementProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface TooltipPositionerState {
  open: boolean;
  /** The side of the anchor that the popup is on. */
  side: Side;
  align: Align;
  /** The anchor is out of view. */
  anchorHidden: boolean;
  /** `'tracking-cursor'` while the popup follows the pointer. */
  instant: TooltipInstant | 'tracking-cursor';
}

export interface TooltipPopupProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface TooltipPopupState {
  open: boolean;
  side: Side;
  align: Align;
  instant: TooltipInstant;
}

export interface TooltipArrowProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface TooltipArrowState {
  open: boolean;
  side: Side;
  align: Align;
  /** The arrow cannot point to the center of the anchor. */
  uncentered: boolean;
  instant: TooltipInstant;
}

export interface TooltipViewportProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface TooltipViewportState {
  /** The side of the new trigger from the old one, such as `'right down'`. */
  activationDirection: string | undefined;
  /** The popup moves to another trigger. */
  transitioning: boolean;
  instant: TooltipInstant;
}
