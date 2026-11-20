import type {
  ButtonHTMLAttributes,
  ComputedRef,
  HTMLAttributes,
  StyleValue,
  VNodeChild,
} from 'vue';
import type { AsProps } from '../common/element';
import type { SwipeDirection } from './swipe';
import type { Align, PlacementProps, Side } from '../popup/placement';
import type { PopupPortalProps } from '../popup/portal';

export type { Align, OffsetFunction, Side } from '../popup/placement';
export type { SwipeDirection };

/**
 * A text, or a function that gives the content. A vnode is no label, because a vnode that mounts a
 * second time on a hydrated page loses its components, and a toast of high priority shows its
 * labels at two places.
 */
export type ToastLabel = string | number | (() => VNodeChild);

export interface ToastObject<Data extends object = any> {
  /** The id of the toast. An `add` with the id of an open toast updates that toast. */
  id: string;
  title?: ToastLabel | undefined;
  /** The type of the toast, such as `'success'`, for styles and for the content. */
  type?: string | undefined;
  description?: ToastLabel | undefined;
  /**
   * The time in milliseconds before the toast closes. `0` keeps the toast open. With no value, the
   * `timeout` of the provider.
   */
  timeout?: number | undefined;
  /**
   * How a screen reader announces the toast: `'low'` politely, `'high'` at once.
   * @default 'low'
   */
  priority?: 'low' | 'high' | undefined;
  /** The number of updates of the toast. */
  updateKey?: number | undefined;
  /** The toast is over the `limit` of the provider. */
  limited?: boolean | undefined;
  /** The natural height of the root in pixels, after its measure. */
  height?: number | undefined;
  /** Runs when the toast closes. */
  onClose?: (() => void) | undefined;
  /** Runs when the element of the toast is out of the document, after its leave. */
  onRemove?: (() => void) | undefined;
  /** The attributes and listeners of `Toast.Action`. `children` is its content. */
  actionProps?: ToastManagerActionProps | undefined;
  /** The props of `Toast.Positioner` for an anchored toast. */
  positionerProps?: ToastManagerPositionerProps | undefined;
  /** The data of the developer. */
  data?: Data | undefined;
}

export interface ToastManagerActionProps extends ButtonHTMLAttributes {
  /** The content of the button. */
  children?: ToastLabel | undefined;
}

export interface ToastManagerPositionerProps extends PlacementProps {
  /**
   * The side of the anchor for the toast. It can change to avoid a collision.
   * @default 'top'
   */
  side?: Side | undefined;
  /** The class of the positioner element, under the class of the developer. */
  class?: unknown;
  /** The style of the positioner element, under the style of the developer. */
  style?: StyleValue | undefined;
}

export interface ToastManagerAddOptions<Data extends object = any> extends Omit<
  ToastObject<Data>,
  'id' | 'updateKey' | 'limited' | 'height'
> {
  /** The id of the toast. With the id of an open toast, the call updates that toast. */
  id?: string | undefined;
}

export interface ToastManagerUpdateOptions<Data extends object = any> extends Partial<
  Omit<ToastObject<Data>, 'id' | 'updateKey' | 'limited' | 'height'>
> {}

export interface ToastManagerPromiseOptions<Value, Data extends object = any> {
  /** The toast while the promise waits. A text is the description. */
  loading: string | ToastManagerAddOptions<Data>;
  /** The toast after the promise resolves. A text is the description. */
  success:
    | string
    | ToastManagerUpdateOptions<Data>
    | ((result: Value) => string | ToastManagerUpdateOptions<Data>);
  /** The toast after the promise rejects. A text is the description. */
  error:
    | string
    | ToastManagerUpdateOptions<Data>
    | ((error: any) => string | ToastManagerUpdateOptions<Data>);
}

export interface ToastManagerEvent {
  action: 'add' | 'close' | 'update' | 'promise';
  options: any;
}

export interface ToastManager<Data extends object = any> {
  /** For `Toast.Provider`. */
  ' subscribe': (listener: (event: ToastManagerEvent) => void) => () => void;
  /** Adds a toast, or updates the open toast with its `id`. Gives the id. */
  add: <T extends Data = Data>(options: ToastManagerAddOptions<T>) => string;
  /** Closes the toast with the id, or each toast with no id. */
  close: (id?: string) => void;
  /** Changes an open toast. A function gets the toast and gives the changes. */
  update: <T extends Data = Data>(
    id: string,
    options:
      ToastManagerUpdateOptions<T> | ((toast: ToastObject<T>) => ToastManagerUpdateOptions<T>),
  ) => void;
  /** Shows a toast for each state of the promise. Gives a promise with its result. */
  promise: <Value, T extends Data = Data>(
    promise: Promise<Value>,
    options: ToastManagerPromiseOptions<Value, T>,
  ) => Promise<Value>;
}

export interface UseToastManagerReturnValue<Data extends object = any> extends Omit<
  ToastManager<Data>,
  ' subscribe'
> {
  /** The open toasts, the newest first. */
  toasts: ComputedRef<ToastObject<Data>[]>;
}

export interface ToastProviderProps {
  /**
   * The time in milliseconds before a toast closes. `0` keeps the toasts open.
   * @default 5000
   */
  timeout?: number | undefined;
  /**
   * The number of toasts that show. A toast over it is `limited`, and its root is inert.
   * @default 3
   */
  limit?: number | undefined;
  /** A manager of `Toast.createToastManager()` that adds toasts from code outside the provider. */
  toastManager?: ToastManager | undefined;
}

export interface ToastProviderState {}

export interface ToastPortalProps extends Omit<PopupPortalProps, 'keepMounted'> {}

export interface ToastPortalState {}

export interface ToastViewportProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ToastViewportState {
  /** The pointer or the keyboard focus is in the viewport. */
  expanded: boolean;
}

export interface ToastRootProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The toast of the root. */
  toast: ToastObject;
  /**
   * The directions of a swipe that closes the toast.
   * @default ['down', 'right']
   */
  swipeDirection?: SwipeDirection | SwipeDirection[] | undefined;
}

export interface ToastRootState {
  /** The pointer or the keyboard focus is in the viewport. */
  expanded: boolean;
  /** The toast is over the `limit` of the provider. */
  limited: boolean;
  type: string | undefined;
  /** The user swipes the toast. */
  swiping: boolean;
  /** The direction of the swipe that closed the toast. */
  swipeDirection: SwipeDirection | undefined;
}

export interface ToastContentProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ToastContentState {
  expanded: boolean;
  /** A newer toast is in front of the toast. */
  behind: boolean;
}

export interface ToastTitleProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
}

export interface ToastTitleState {
  type: string | undefined;
}

export interface ToastDescriptionProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
}

export interface ToastDescriptionState {
  type: string | undefined;
}

export interface ToastActionProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface ToastActionState {
  type: string | undefined;
}

export interface ToastCloseProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface ToastCloseState {
  type: string | undefined;
}

export interface ToastPositionerProps
  extends AsProps, PlacementProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The toast of the positioner. A prop that is absent takes the value of its `positionerProps`. */
  toast: ToastObject;
  /**
   * The side of the anchor for the toast. It can change to avoid a collision.
   * @default 'top'
   */
  side?: Side | undefined;
}

export interface ToastPositionerState {
  /** The side of the anchor that the toast is on. */
  side: Side;
  align: Align;
  /** The anchor is out of view. */
  anchorHidden: boolean;
}

export interface ToastArrowProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ToastArrowState {
  side: Side;
  align: Align;
  /** The arrow cannot point to the center of the anchor. */
  uncentered: boolean;
}
