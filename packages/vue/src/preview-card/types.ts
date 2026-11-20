import type { AnchorHTMLAttributes, HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type { PlacementProps, Side, Align } from '../popup/placement';
import type { PopupPortalProps } from '../popup/portal';
import type { PopupChangeEventDetails } from '../popup/root';
import type { PreviewCardHandle } from './root';

export type {
  Align,
  Anchor,
  Boundary,
  CollisionAvoidance,
  OffsetFunction,
  Side,
  VirtualElement,
} from '../popup/placement';

export type PreviewCardRootChangeEventReason =
  'trigger-hover' | 'trigger-focus' | 'outside-press' | 'escape-key' | 'imperative-action' | 'none';

export type PreviewCardRootChangeEventDetails =
  PopupChangeEventDetails<PreviewCardRootChangeEventReason>;

export interface PreviewCardRootProps<Payload = unknown> {
  /** The preview card is open. `v-model:open` binds it. */
  open?: boolean | undefined;
  /**
   * The preview card is open at the mount of an uncontrolled root.
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
  handle?: PreviewCardHandle<Payload> | undefined;
}

export interface PreviewCardRootState {}

export interface PreviewCardTriggerProps<Payload = unknown>
  extends AsProps, /* @vue-ignore */ Omit<AnchorHTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
  /** The payload that the preview card gets when this trigger opens it. */
  payload?: Payload | undefined;
  /** Connects the trigger to a root outside it. */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * The time in milliseconds that the mouse rests on the link, or that the link has the focus,
   * before the open.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * The time in milliseconds before the close, after the pointer left the link.
   * @default 300
   */
  closeDelay?: number | undefined;
}

export interface PreviewCardTriggerState {
  /** The preview card is open for this trigger. */
  open: boolean;
}

export interface PreviewCardPortalProps extends PopupPortalProps {}

export interface PreviewCardPortalState {}

export interface PreviewCardBackdropProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface PreviewCardBackdropState {
  open: boolean;
}

export interface PreviewCardPositionerProps
  extends AsProps, PlacementProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface PreviewCardPositionerState {
  open: boolean;
  /** The side of the anchor that the popup is on. */
  side: Side;
  align: Align;
  /** The anchor is out of view. */
  anchorHidden: boolean;
  instant: 'focus' | 'dismiss' | undefined;
}

export interface PreviewCardPopupProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface PreviewCardPopupState {
  open: boolean;
  side: Side;
  align: Align;
  /** Why a style should skip its animation: `'focus'` (the focus opened it), `'dismiss'` (Escape). */
  instant: 'focus' | 'dismiss' | undefined;
}

export interface PreviewCardArrowProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface PreviewCardArrowState {
  open: boolean;
  side: Side;
  align: Align;
  /** The arrow cannot point to the center of the anchor. */
  uncentered: boolean;
}

export interface PreviewCardViewportProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface PreviewCardViewportState {
  /** The side of the new trigger from the old one, such as `'right down'`. */
  activationDirection: string | undefined;
  /** The preview card moves to another trigger. */
  transitioning: boolean;
  instant: 'focus' | 'dismiss' | undefined;
}
