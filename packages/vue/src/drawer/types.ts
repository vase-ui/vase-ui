import type { ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type {
  DialogBackdropProps,
  DialogBackdropState,
  DialogPopupProps,
  DialogRootProps,
  DialogTriggerState,
  DialogViewportProps,
} from '../dialog/types';
import type { PopupChangeEventDetails } from '../popup/root';
import type { DrawerHandle } from './root';

export type {
  DialogCloseProps as DrawerCloseProps,
  DialogCloseState as DrawerCloseState,
  DialogDescriptionProps as DrawerDescriptionProps,
  DialogDescriptionState as DrawerDescriptionState,
  DialogPortalProps as DrawerPortalProps,
  DialogPortalState as DrawerPortalState,
  DialogTitleProps as DrawerTitleProps,
  DialogTitleState as DrawerTitleState,
  FocusTarget,
  InteractionType,
} from '../dialog/types';

/**
 * A place of the drawer: a number from 0 to 1 is a part of the height of the viewport, a larger
 * number is pixels, and a string has the unit `px` or `rem`.
 */
export type DrawerSnapPoint = number | string;

/** The direction of the swipe that closes the drawer. */
export type DrawerSwipeDirection = 'up' | 'down' | 'left' | 'right';

export type DrawerRootChangeEventReason =
  | 'trigger-press'
  | 'outside-press'
  | 'escape-key'
  | 'close-press'
  | 'focus-out'
  | 'imperative-action'
  | 'swipe'
  | 'close-watcher'
  | 'none';

export type DrawerRootChangeEventDetails = PopupChangeEventDetails<DrawerRootChangeEventReason>;

export type DrawerRootSnapPointChangeEventReason = DrawerRootChangeEventReason;

export interface DrawerRootSnapPointChangeEventDetails {
  reason: DrawerRootSnapPointChangeEventReason;
  event: Event;
  /** The drawer keeps its snap point. */
  cancel(): void;
  readonly isCanceled: boolean;
  /** The element that the action is on. With no such element, the active trigger. */
  trigger: Element | undefined;
}

export interface DrawerRootProps<Payload = unknown> extends Omit<
  DialogRootProps<Payload>,
  'handle'
> {
  /** Connects the root to triggers outside it and to code. */
  handle?: DrawerHandle<Payload> | undefined;
  /**
   * The direction of the swipe that closes the drawer.
   * @default 'down'
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
  /**
   * The places where the drawer stops. A number from 0 to 1 is a part of the height of the
   * viewport, a larger number is pixels, and a string has the unit `px` or `rem`.
   */
  snapPoints?: DrawerSnapPoint[] | undefined;
  /** The active snap point. `v-model:snap-point` binds it. */
  snapPoint?: DrawerSnapPoint | null | undefined;
  /** The active snap point at the mount of an uncontrolled root. By default the first snap point. */
  defaultSnapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * The speed of a swipe moves the drawer one snap point at most.
   * @default false
   */
  snapToSequentialPoints?: boolean | undefined;
}

export interface DrawerRootState {}

export interface DrawerTriggerProps<Payload = unknown>
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  id?: string | undefined;
  /**
   * The user cannot press the trigger.
   * @default false
   */
  disabled?: boolean | undefined;
  /** The payload that the drawer gets when this trigger opens it. */
  payload?: Payload | undefined;
  /** Connects the trigger to a root outside it. */
  handle?: DrawerHandle<Payload> | undefined;
}

export interface DrawerTriggerState extends DialogTriggerState {}

export interface DrawerSwipeAreaProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
  /**
   * A swipe on the area opens nothing.
   * @default false
   */
  disabled?: boolean | undefined;
  /** The direction of the swipe that opens the drawer. By default the opposite of that of the root. */
  swipeDirection?: DrawerSwipeDirection | undefined;
}

export interface DrawerSwipeAreaState {
  open: boolean;
  /** A swipe on the area moves the drawer. */
  swiping: boolean;
  swipeDirection: DrawerSwipeDirection;
  disabled: boolean;
}

export interface DrawerBackdropProps extends DialogBackdropProps {}

export interface DrawerBackdropState extends DialogBackdropState {}

export interface DrawerViewportProps extends DialogViewportProps {}

export interface DrawerViewportState {
  open: boolean;
  /** A dialog root or a drawer root is above the root in the component tree. */
  nested: boolean;
  /** A dialog or a drawer is open above this drawer. */
  nestedDialogOpen: boolean;
}

export interface DrawerPopupProps extends Omit<DialogPopupProps, 'initialFocus'> {
  /** The element that gets the focus at the open. By default the popup. */
  initialFocus?: DialogPopupProps['initialFocus'];
}

export interface DrawerPopupState {
  open: boolean;
  /** The drawer is at the snap point `1`. */
  expanded: boolean;
  /** A dialog root or a drawer root is above the root in the component tree. */
  nested: boolean;
  /** A drawer in this drawer is open. */
  nestedDrawerOpen: boolean;
  /** A swipe moves a drawer in this drawer. */
  nestedDrawerSwiping: boolean;
  swipeDirection: DrawerSwipeDirection;
  /** A swipe moves the popup. */
  swiping: boolean;
}

export interface DrawerContentProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface DrawerContentState {}

export interface DrawerProviderProps {}

export interface DrawerProviderState {}

export interface DrawerIndentProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface DrawerIndentState {
  /** A drawer of the provider is open. */
  active: boolean;
}

export interface DrawerIndentBackgroundProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface DrawerIndentBackgroundState {
  /** A drawer of the provider is open. */
  active: boolean;
}

export interface DrawerVirtualKeyboardProviderProps {}

export interface DrawerVirtualKeyboardProviderState {}
