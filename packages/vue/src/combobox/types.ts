import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, VNodeChild } from 'vue';
import type { AsProps } from '../common/element';
import type { FieldState } from '../field/control';
import type { Group } from '../internals/resolveValueLabel';
import type { FocusTarget } from '../popup/focus';
import type { Align, PlacementProps, Side } from '../popup/placement';
import type { PopupPortalProps } from '../popup/portal';
import type { InteractionType, PopupChangeEventDetails } from '../popup/root';
import type { FilterItemToString } from './filter';
import type { ComboboxItemCollection } from './items';

export type {
  Align,
  Anchor,
  Boundary,
  CollisionAvoidance,
  OffsetFunction,
  Side,
  VirtualElement,
} from '../popup/placement';
export type { Filter as ComboboxFilter } from '../internals/filter';
export type { ComboboxFilterOptions } from './filter';
export type {
  ComboboxGroup,
  ComboboxItemCollection,
  ComboboxPrimitiveValue,
  CreateComboboxItemsOptions,
} from './items';
export type { FocusTarget, InteractionType };

export type Orientation = 'horizontal' | 'vertical';

export type ComboboxRootChangeEventReason =
  | 'trigger-press'
  | 'input-press'
  | 'outside-press'
  | 'item-press'
  | 'escape-key'
  | 'list-navigation'
  | 'focus-out'
  | 'input-change'
  | 'input-clear'
  | 'clear-press'
  | 'chip-remove-press'
  | 'cancel-open'
  | 'imperative-action'
  | 'none';

/** The details of a change of the value or of the text. */
export interface ComboboxRootChangeEventDetails {
  reason: ComboboxRootChangeEventReason;
  event: Event;
  cancel(): void;
  readonly isCanceled: boolean;
  /** A part that stops its key event lets it go on after this call. */
  allowPropagation(): void;
  readonly isPropagationAllowed: boolean;
  /** With `input-clear`: an item press cleared the text. */
  isItemPress?: boolean | undefined;
}

export type ComboboxRootOpenChangeEventDetails =
  PopupChangeEventDetails<ComboboxRootChangeEventReason>;

export type ComboboxRootHighlightEventReason = 'keyboard' | 'pointer' | 'none';

export interface ComboboxRootHighlightEventDetails {
  reason: ComboboxRootHighlightEventReason;
  /** The event of the change. A change with no event of the user has none. */
  event: Event | undefined;
  /** The index of the item, or -1 for no item. */
  index: number;
}

/** The items of the `items` prop: a list, a list of groups, or a collection of `createItems()`. */
export type ComboboxItems<Item, Value> =
  readonly Item[] | readonly Group<Item>[] | ComboboxItemCollection<Item, Value>;

/** The props of the roots of Combobox and Autocomplete. */
export interface ComboboxSharedRootProps<Item> {
  /**
   * The data of the items. With `items`, the root filters the data, and the `item` slot of
   * `List` renders each item that the filter keeps.
   */
  items?: ComboboxItems<Item, any> | undefined;
  /** The items to show, in place of the result of `filter`. Keep the form of `items`. */
  filteredItems?: readonly Item[] | readonly Group<Item>[] | undefined;
  /**
   * Keeps an item for the query, the text with no space at the ends. `null` keeps each item. The
   * default is `contains` of `useFilter`.
   */
  filter?:
    ((item: Item, query: string, itemToString?: FilterItemToString) => boolean) | null | undefined;
  /**
   * The largest number of items to show. -1 shows each item.
   * @default -1
   */
  limit?: number | undefined;
  /** The locale of the default filter. Else the nearest `LocaleProvider`, else `'en-US'`. */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Arrow keys move in the rows and columns of `Row` parts.
   * @default false
   */
  grid?: boolean | undefined;
  /**
   * The developer renders a window of the items. The arrow keys count on the filtered items, and
   * the list sets no scroll position.
   * @default false
   */
  virtualized?: boolean | undefined;
  /**
   * The list is in place, with no popup. The input is the control and has `aria-expanded`.
   * @default false
   */
  inline?: boolean | undefined;
  /**
   * The open popup locks the scroll of the page and blocks the pointer outside it.
   * @default false
   */
  modal?: boolean | undefined;
  /**
   * A move of the pointer highlights its item.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * The arrow keys go from the last item to the input and to the first item.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /** The popup is open. `v-model:open` binds it. */
  open?: boolean | undefined;
  /**
   * The popup is open at the mount of an uncontrolled root.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /** The name of the value in the form data. */
  name?: string | undefined;
  /** The `id` of the form of the value. */
  form?: string | undefined;
  /**
   * The form needs a value.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The user cannot change the value, and the form gets no value.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The user can browse the items, and cannot change the value.
   * @default false
   */
  readonly?: boolean | undefined;
}

type ComboboxValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? readonly Value[]
  : Value;

export interface ComboboxRootProps<
  Value,
  Multiple extends boolean | undefined = false,
  Item = Value,
>
  extends ComboboxSharedRootProps<Item>, AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The selected value. `v-model` binds it. With `multiple`, `null` is no value. */
  modelValue?: ComboboxValue<Value, Multiple> | null | undefined;
  /** The value at the mount of an uncontrolled root. A native reset of the form gives it back. */
  defaultValue?: ComboboxValue<Value, Multiple> | null | undefined;
  /** The text of the input. `v-model:input-value` binds it. */
  inputValue?: string | undefined;
  /**
   * The text at the mount, when the text is uncontrolled. With neither, the text of a single
   * combobox starts as the label of its value. A native reset of the form gives it back.
   */
  defaultInputValue?: string | undefined;
  /**
   * The user selects more than one value. The form data then has one entry for each selected value.
   * @default false
   */
  multiple?: (Multiple & boolean) | undefined;
  /** Compares the value of an item with a selected value. The default is `Object.is`. */
  isItemEqualToValue?: ((itemValue: Value, value: Value) => boolean) | undefined;
  /** The label of a value. An object with `label` gives its `label`. */
  itemToStringLabel?: ((itemValue: Value) => string) | undefined;
  /** The text of a value in the form data. An object with `value` and `label` gives its `value`. */
  itemToStringValue?: ((itemValue: Value) => string) | undefined;
  /**
   * The autofill purpose of the hidden text input, such as `'country-name'`. The input has no
   * name, so a browser reads its purpose from this attribute. Without `multiple`, an autofill selects
   * the item whose value or label is the filled text.
   */
  autocomplete?: string | undefined;
  /**
   * The first item gets the highlight after each typed text that is not empty.
   * @default false
   */
  autoHighlight?: boolean | undefined;
  /**
   * A press on the input opens the popup.
   * @default true
   */
  openOnInputClick?: boolean | undefined;
}

export interface ComboboxRootState {}

/** The state of a field around a part. */
export type ComboboxFieldState = FieldState;

export interface ComboboxLabelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the label. The default is a generated id. */
  id?: string | undefined;
}

export interface ComboboxLabelState extends FieldState {
  disabled: boolean;
}

/**
 * WAI-ARIA 1.3 defines `aria-description` for each element, and the types of Vue do not list it. A
 * chip and the input take it, so that a screen reader tells how to reach and remove the chips.
 */
interface AriaDescriptionAttribute {
  'aria-description'?: string | undefined;
}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
type InputAttributes = Omit<InputHTMLAttributes, 'disabled' | 'id' | 'autocomplete'> &
  AriaDescriptionAttribute & {
    autocomplete?: string | null | undefined;
  };

type ChipAttributes = Omit<HTMLAttributes, 'as'> & AriaDescriptionAttribute;

export interface ComboboxInputProps extends /* @vue-ignore */ InputAttributes {
  /**
   * The `id` of the input. The default is the control id of the field, else a generated id. In the
   * popup, the default is a generated id.
   */
  id?: string | undefined;
  /**
   * The user cannot use the input.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface ComboboxInputState extends FieldState {
  open: boolean;
  /** The side of the open popup, else `null`. */
  popupSide: Side | null;
  listEmpty: boolean;
  readonly: boolean;
  disabled: boolean;
}

export interface ComboboxInputGroupProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxInputGroupState extends FieldState {
  open: boolean;
  disabled: boolean;
  readonly: boolean;
  popupSide: Side | null;
  listEmpty: boolean;
  /** The root has no value. */
  placeholder: boolean;
}

export interface ComboboxTriggerProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  /**
   * The `id` of the trigger. When the trigger is the control, the default is the control id of the
   * field, else a generated id. Beside an input, the default is a generated id.
   */
  id?: string | undefined;
  /**
   * The user cannot press the trigger.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface ComboboxTriggerState extends ComboboxInputGroupState {}

export interface ComboboxValueProps {
  /** The text with no value, or a function that gives nodes. */
  placeholder?: string | (() => VNodeChild) | undefined;
}

export interface ComboboxValueState {}

export interface ComboboxIconProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxIconState {}

export interface ComboboxClearProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The button stays in the DOM with `hidden` while there is nothing to clear.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface ComboboxClearState {
  open: boolean;
  disabled: boolean;
  /** There is a value or a text to clear. */
  visible: boolean;
}

export interface ComboboxChipsProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxChipsState {}

export interface ComboboxChipProps extends AsProps, /* @vue-ignore */ ChipAttributes {}

export interface ComboboxChipState {
  disabled: boolean;
}

export interface ComboboxChipRemoveProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface ComboboxChipRemoveState {
  disabled: boolean;
}

export interface ComboboxPortalProps extends PopupPortalProps {}

export interface ComboboxPortalState {}

export interface ComboboxBackdropProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxBackdropState {
  open: boolean;
}

export interface ComboboxPositionerProps
  extends AsProps, PlacementProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxPositionerState {
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  /** The list is empty. */
  empty: boolean;
}

export interface ComboboxPopupProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the popup. The default is a generated id while the trigger is the control. */
  id?: string | undefined;
  /**
   * The element that gets the focus at the open, while the trigger is the control. By default: the
   * input in the popup; after a touch, the popup.
   */
  initialFocus?: FocusTarget | undefined;
  /** The element that gets the focus at the close. By default: the trigger. */
  finalFocus?: FocusTarget | undefined;
}

export interface ComboboxPopupState extends ComboboxPositionerState {}

export interface ComboboxArrowProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxArrowState {
  open: boolean;
  side: Side;
  align: Align;
  /** The arrow cannot point to the center of the anchor. */
  uncentered: boolean;
}

export interface ComboboxListProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the list. The default is a generated id. */
  id?: string | undefined;
}

export interface ComboboxListState {
  empty: boolean;
}

export interface ComboboxItemProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the item. The default is a generated id. */
  id?: string | undefined;
  /**
   * The value of a pick.
   * @default null
   */
  value?: any;
  /** The place of the item in the filtered items, for a list that renders a window of them. */
  index?: number | undefined;
  /**
   * The user cannot pick the item. The arrow keys still reach it.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface ComboboxItemState {
  disabled: boolean;
  /** The item is a selected value. */
  selected: boolean;
  highlighted: boolean;
}

export interface ComboboxRowProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxRowState {}

export interface ComboboxGroupProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxGroupState {}

export interface ComboboxGroupLabelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the label, which names its group. The default is a generated id. */
  id?: string | undefined;
}

export interface ComboboxGroupLabelState {}

export interface ComboboxSeparatorProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export interface ComboboxSeparatorState {
  orientation: Orientation;
}

export interface ComboboxStatusProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxStatusState {}

export interface ComboboxEmptyProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ComboboxEmptyState {
  /** The list is empty. */
  empty: boolean;
}
