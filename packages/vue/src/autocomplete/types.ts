import type { HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type {
  ComboboxInputGroupState,
  ComboboxItemState,
  ComboboxRootChangeEventDetails,
  ComboboxSharedRootProps,
  ComboboxTriggerState,
} from '../combobox/types';

export type {
  Align,
  Anchor,
  Boundary,
  CollisionAvoidance,
  ComboboxArrowProps as AutocompleteArrowProps,
  ComboboxArrowState as AutocompleteArrowState,
  ComboboxBackdropProps as AutocompleteBackdropProps,
  ComboboxBackdropState as AutocompleteBackdropState,
  ComboboxClearProps as AutocompleteClearProps,
  ComboboxClearState as AutocompleteClearState,
  ComboboxEmptyProps as AutocompleteEmptyProps,
  ComboboxEmptyState as AutocompleteEmptyState,
  ComboboxGroupLabelProps as AutocompleteGroupLabelProps,
  ComboboxGroupLabelState as AutocompleteGroupLabelState,
  ComboboxGroupProps as AutocompleteGroupProps,
  ComboboxGroupState as AutocompleteGroupState,
  ComboboxIconProps as AutocompleteIconProps,
  ComboboxIconState as AutocompleteIconState,
  ComboboxInputGroupProps as AutocompleteInputGroupProps,
  ComboboxInputProps as AutocompleteInputProps,
  ComboboxInputState as AutocompleteInputState,
  ComboboxItemProps as AutocompleteItemProps,
  ComboboxListProps as AutocompleteListProps,
  ComboboxListState as AutocompleteListState,
  ComboboxPopupProps as AutocompletePopupProps,
  ComboboxPopupState as AutocompletePopupState,
  ComboboxPortalProps as AutocompletePortalProps,
  ComboboxPortalState as AutocompletePortalState,
  ComboboxPositionerProps as AutocompletePositionerProps,
  ComboboxPositionerState as AutocompletePositionerState,
  ComboboxRootHighlightEventDetails as AutocompleteRootHighlightEventDetails,
  ComboboxRootHighlightEventReason as AutocompleteRootHighlightEventReason,
  ComboboxRootOpenChangeEventDetails as AutocompleteRootOpenChangeEventDetails,
  ComboboxRowProps as AutocompleteRowProps,
  ComboboxRowState as AutocompleteRowState,
  ComboboxSeparatorProps as AutocompleteSeparatorProps,
  ComboboxSeparatorState as AutocompleteSeparatorState,
  ComboboxStatusProps as AutocompleteStatusProps,
  ComboboxStatusState as AutocompleteStatusState,
  ComboboxTriggerProps as AutocompleteTriggerProps,
  FocusTarget,
  InteractionType,
  OffsetFunction,
  Side,
  VirtualElement,
} from '../combobox/types';
export type { Filter as AutocompleteFilter } from '../common/filter';
export type { AutocompleteFilterOptions } from '../combobox/filter';

export type AutocompleteRootChangeEventReason = Exclude<
  ComboboxRootChangeEventDetails['reason'],
  'chip-remove-press'
>;

export interface AutocompleteRootChangeEventDetails extends ComboboxRootChangeEventDetails {
  reason: AutocompleteRootChangeEventReason;
}

export interface AutocompleteRootProps<Item = unknown>
  extends ComboboxSharedRootProps<Item>, AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The text of the input. `v-model` binds it. An inline completion in the input is not in it. */
  modelValue?: string | undefined;
  /** The text of an uncontrolled root, at the mount and at a native reset of the form. */
  defaultValue?: string | undefined;
  /**
   * How the input completes the text:
   * - `'list'`: the list filters by the text.
   * - `'both'`: the list filters, and a key highlight shows the text of its item in the input.
   * - `'inline'`: the list does not filter, and a key highlight shows the text of its item.
   * - `'none'`: the list does not filter, and the input shows only the typed text.
   * @default 'list'
   */
  mode?: 'list' | 'both' | 'inline' | 'none' | undefined;
  /**
   * The first item gets the highlight after each typed text that is not empty. With `'always'`,
   * also while the text is empty and at each open.
   * @default false
   */
  autoHighlight?: boolean | 'always' | undefined;
  /**
   * A pointer that leaves the list keeps the highlight.
   * @default false
   */
  keepHighlight?: boolean | undefined;
  /**
   * A press on an item submits the form of the root.
   * @default false
   */
  submitOnItemClick?: boolean | undefined;
  /**
   * A press on the input opens the popup.
   * @default false
   */
  openOnInputClick?: boolean | undefined;
  /** The text of an item in the input. An object with `value` and `label` gives its `value`. */
  itemToStringValue?: ((item: Item) => string) | undefined;
}

export interface AutocompleteRootState {}

export interface AutocompleteValueProps {}

export interface AutocompleteValueState {}

export type AutocompleteTriggerState = Omit<ComboboxTriggerState, 'placeholder'>;

export type AutocompleteInputGroupState = Omit<ComboboxInputGroupState, 'placeholder'>;

export type AutocompleteItemState = Omit<ComboboxItemState, 'selected'>;
