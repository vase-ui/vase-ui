import type { ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type { FocusTarget } from '../popup/focus';
import type { PopupPortalProps } from '../popup/portal';
import type { InteractionType, PopupChangeEventDetails } from '../popup/root';
import type { DialogHandle } from './root';

export type { FocusTarget, InteractionType };

export type DialogRootChangeEventReason =
  | 'trigger-press'
  | 'outside-press'
  | 'escape-key'
  | 'close-press'
  | 'focus-out'
  | 'imperative-action'
  | 'none';

export type DialogRootChangeEventDetails = PopupChangeEventDetails<DialogRootChangeEventReason>;

export interface DialogRootProps<Payload = unknown> {
  /** The dialog is open. `v-model:open` binds it. */
  open?: boolean | undefined;
  /**
   * The dialog is open at the mount of an uncontrolled root.
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
   * The modal state of the open dialog:
   * - `true`: the focus stays in the popup, and the rest of the page is inert. The page does not
   *   scroll, and a fixed element covers it.
   * - `'trap-focus'`: the focus stays in the popup, and screen readers do not read the rest of the
   *   page. The page stays in use for the pointer.
   * - `false`: the page stays in use. The dialog closes when the focus leaves it, unless
   *   `disablePointerDismissal` is set.
   *
   * Put a `Close` part in the popup: a touch screen reader needs it to leave a dialog that keeps
   * the focus.
   * @default true
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * A press outside does not close the dialog. A dialog that is not modal also stays open when the
   * focus leaves it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /** Connects the root to triggers outside it and to code. */
  handle?: DialogHandle<Payload> | undefined;
}

export interface DialogRootEmits {
  /** The dialog opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: DialogRootChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** The active trigger changes. `v-model:trigger-id` uses it. */
  'update:triggerId': [id: string | null];
}

export interface DialogRootState {}

export interface DialogTriggerProps<Payload = unknown>
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  /** The root names the active trigger by this id in `triggerId`. */
  id?: string | undefined;
  /**
   * The user cannot press the trigger.
   * @default false
   */
  disabled?: boolean | undefined;
  /** The payload that the dialog gets when this trigger opens it. */
  payload?: Payload | undefined;
  /** Connects the trigger to a root outside it. */
  handle?: DialogHandle<Payload> | undefined;
}

export interface DialogTriggerState {
  /** The dialog is open for this trigger. */
  open: boolean;
  disabled: boolean;
}

export interface DialogPortalProps extends PopupPortalProps {}

export interface DialogPortalState {}

export interface DialogBackdropProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The backdrop of a nested dialog renders its element.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export interface DialogBackdropState {
  open: boolean;
}

export interface DialogViewportProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface DialogViewportState {
  open: boolean;
  /** A dialog root is above the root of the dialog in the component tree. */
  nested: boolean;
  /** A dialog is open above this dialog. */
  nestedDialogOpen: boolean;
}

export interface DialogPopupProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The trigger names the popup by this id in `aria-controls`. */
  id?: string | undefined;
  /**
   * The element that gets the focus at the open, or `false` to move no focus. A function gets the
   * type of the interaction and gives the element. By default: the element with `autofocus`, else
   * the first tab stop, else the popup; after a touch, the popup. A modal dialog makes the page
   * inert, so an element outside the popup cannot keep or get the focus.
   */
  initialFocus?: FocusTarget | undefined;
  /**
   * The element that gets the focus at the close, or `false` to keep the focus where it is. A
   * function gets the type of the interaction and gives the element. By default: the trigger, else
   * the element that had the focus before the open. For an element that is no tab stop, the focus
   * goes to its first tab stop outside the popup. An element in the popup is no target.
   */
  finalFocus?: FocusTarget | undefined;
}

export interface DialogPopupState {
  open: boolean;
  /** A dialog root is above the root of the dialog in the component tree. */
  nested: boolean;
  /** A dialog is open above this dialog. */
  nestedDialogOpen: boolean;
}

export interface DialogTitleProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The popup names the title by this id in `aria-labelledby`. */
  id?: string | undefined;
}

export interface DialogTitleState {}

export interface DialogDescriptionProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The popup names the description by this id in `aria-describedby`. */
  id?: string | undefined;
}

export interface DialogDescriptionState {}

export interface DialogCloseProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface DialogCloseState {
  disabled: boolean;
}
