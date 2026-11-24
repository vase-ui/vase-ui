import type { HTMLAttributes, ButtonHTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { Group, ItemLabel } from '../common/resolveValueLabel';
import type { FocusTarget } from '../popup/focus';
import type { Align, PlacementProps, Side } from '../popup/placement';
import type { PopupPortalProps } from '../popup/portal';
import type { PopupChangeEventDetails } from '../popup/root';

export type {
  Align,
  Anchor,
  Boundary,
  CollisionAvoidance,
  OffsetFunction,
  Side,
  VirtualElement,
} from '../popup/placement';
export type { InteractionType } from '../popup/root';
export type { FocusTarget, ItemLabel };

/**
 * The items of a select, for the label of a value: a record of labels by value, an array of
 * `{ label, value }`, or an array of groups of them. A label is a text, a number, or a function
 * that gives the content.
 */
export type SelectItems =
  | Record<string, ItemLabel>
  | readonly { label: ItemLabel; value: any }[]
  | readonly Group[]
  | undefined;

export type SelectRootChangeEventReason = 'item-press' | 'none';

export type SelectRootChangeEventDetails = ChangeEventDetails<SelectRootChangeEventReason>;

export type SelectRootOpenChangeEventReason =
  | 'trigger-press'
  | 'outside-press'
  | 'escape-key'
  | 'window-resize'
  | 'item-press'
  | 'focus-out'
  | 'list-navigation'
  | 'cancel-open'
  | 'imperative-action'
  | 'none';

export type SelectRootOpenChangeEventDetails =
  PopupChangeEventDetails<SelectRootOpenChangeEventReason>;

/** The value that a root takes: an array of values with `multiple`. */
export type SelectValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? readonly Value[]
  : Value;

/** The value that a root gives: an array of values with `multiple`, else a value or `null`. */
export type SelectOutputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value | null;

export interface SelectRootProps<Value = any, Multiple extends boolean | undefined = false>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /**
   * The value. `v-model` binds it. With `multiple`, an array, and `null` is the empty array. A
   * native reset of the form gives back the value of the mount.
   */
  modelValue?: SelectValue<Value, Multiple> | null | undefined;
  /**
   * The value of an uncontrolled root, at the mount and at a native reset of the form.
   * @default null
   */
  defaultValue?: SelectValue<Value, Multiple> | null | undefined;
  /**
   * The user can select more than one item.
   * @default false
   */
  multiple?: (Multiple & boolean) | undefined;
  /** The popup is open. `v-model:open` binds it. */
  open?: boolean | undefined;
  /**
   * The popup is open at the mount of an uncontrolled root.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * The open popup locks the scroll of the page, and the page gets no pointer.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * A pointer move highlights the item under the pointer. With `false`, `:hover` and the highlight
   * of the keys are separate.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * The items, so that `Select.Value` shows the label of a value. The closed select needs no
   * mounted popup for it.
   */
  items?: SelectItems;
  /** The text of an object value, for `Select.Value`. The default is its `label`. */
  itemToStringLabel?: ((itemValue: Value) => string) | undefined;
  /** The text of an object value in the form data. The default is its `value`. */
  itemToStringValue?: ((itemValue: Value) => string) | undefined;
  /**
   * An item is selected when this function gives `true` for its value and the value of the root.
   * The default is `Object.is`.
   */
  isItemEqualToValue?: ((itemValue: Value, value: Value) => boolean) | undefined;
  /** The `id` of the trigger, when the trigger has no `id`. */
  id?: string | undefined;
  /**
   * The name of the value in the form data. With `multiple`, the form data has one entry for each
   * selected value. A `Field.Root` gives its own name.
   */
  name?: string | undefined;
  /** The `id` of the form that the inputs belong to. */
  form?: string | undefined;
  /**
   * The `autocomplete` of the visually hidden text input. The browser fills that input. Without
   * `multiple`, the select then takes the item whose value, label or text is the filled text.
   */
  autocomplete?: string | undefined;
  /**
   * The form refuses a submit while the select has no value. A visually hidden text input has the
   * constraint validation.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The user can open the popup, and cannot change the value.
   * @default false
   */
  readonly?: boolean | undefined;
  /**
   * The user cannot open the select or change the value.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface SelectRootEmits<Value = any, Multiple extends boolean | undefined = false> {
  /**
   * The user changes the value. `details.cancel()` keeps the value as it was. Without `multiple`, a
   * press of the selected item sends no event.
   */
  valueChange: [value: SelectOutputValue<Value, Multiple>, details: SelectRootChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: SelectOutputValue<Value, Multiple>];
  /** The popup opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: SelectRootOpenChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
}

export interface SelectRootState {}

export interface SelectFieldState {
  /** The focus left the control one time or more. */
  touched: boolean;
  /** The value differs from the first value. */
  dirty: boolean;
  /** `null` while the field has no validity. */
  valid: boolean | null;
  filled: boolean;
}

export interface SelectLabelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the label. The default is a generated id. */
  id?: string | undefined;
}

export interface SelectLabelState extends SelectFieldState {
  disabled: boolean;
}

export interface SelectTriggerProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  /** The `id` of the trigger. The default is the `id` of `Select.Root`. */
  id?: string | undefined;
  /**
   * The user cannot press the trigger.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface SelectTriggerState<Value = any> extends SelectFieldState {
  open: boolean;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
  /** The select has no value. */
  placeholder: boolean;
  value: Value;
  /** The side of the trigger that the popup is on, while it is open. */
  popupSide: Side | 'none' | null;
}

export interface SelectValueProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'placeholder'> {
  /**
   * The content while the select has no value: a text, a number, or a function that gives the
   * content. An item of `items` for `null` wins over it.
   */
  placeholder?: ItemLabel;
}

export interface SelectValueState<Value = any> {
  value: Value;
  /** The select has no value. */
  placeholder: boolean;
}

export interface SelectIconProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface SelectIconState {
  open: boolean;
}

export interface SelectPortalProps extends Omit<PopupPortalProps, 'keepMounted'> {}

export interface SelectPortalState {}

export interface SelectBackdropProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface SelectBackdropState {
  open: boolean;
}

export interface SelectPositionerProps
  extends AsProps, PlacementProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The popup covers the trigger, with the text of the selected item over the text of the value.
   * A touch open, and a view with no room for it, place the popup at its side.
   * @default true
   */
  alignItemWithTrigger?: boolean | undefined;
}

export interface SelectPositionerState {
  open: boolean;
  /** The side of the anchor that the popup is on: `'none'` while the popup covers the trigger. */
  side: Side | 'none';
  align: Align;
  /** The anchor is out of view. */
  anchorHidden: boolean;
}

export interface SelectPopupProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the popup. The default is a generated id. */
  id?: string | undefined;
  /**
   * The element that gets the focus at the close. A function runs after the update of the close,
   * so it finds an element that the update renders. By default: the trigger, else the element that
   * had the focus before the open. After an open by code, that element comes before the trigger.
   */
  finalFocus?: FocusTarget | undefined;
}

export interface SelectPopupState {
  open: boolean;
  side: Side | 'none';
  align: Align;
}

export interface SelectArrowProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface SelectArrowState {
  open: boolean;
  side: Side | 'none';
  align: Align;
  /** The arrow cannot point to the center of the anchor. */
  uncentered: boolean;
}

export interface SelectListProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the list. The default is a generated id. */
  id?: string | undefined;
}

export interface SelectListState {}

export interface SelectItemProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The value that the item selects.
   * @default null
   */
  value?: any;
  /** The text of the typeahead and of a fill of the browser. The default is the text of the item. */
  label?: string | undefined;
  /**
   * The user cannot select the item. It keeps the highlight.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface SelectItemState {
  selected: boolean;
  highlighted: boolean;
  disabled: boolean;
}

export interface SelectItemTextProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface SelectItemTextState {}

export interface SelectGroupProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface SelectGroupState {}

export interface SelectGroupLabelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the label, which names its group. The default is a generated id. */
  id?: string | undefined;
}

export interface SelectGroupLabelState {}

export interface SelectSeparatorProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | undefined;
}

export interface SelectSeparatorState {
  orientation: 'horizontal' | 'vertical';
}

export interface SelectScrollArrowProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The arrow stays in the DOM, with `hidden`, while the list cannot scroll in its direction.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface SelectScrollArrowState {
  direction: 'up' | 'down';
  /** The list can scroll in the direction of the arrow. */
  visible: boolean;
  side: Side | 'none';
}

export type SelectScrollUpArrowProps = SelectScrollArrowProps;
export type SelectScrollUpArrowState = SelectScrollArrowState;
export type SelectScrollDownArrowProps = SelectScrollArrowProps;
export type SelectScrollDownArrowState = SelectScrollArrowState;
