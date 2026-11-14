export * as Autocomplete from './index.parts';

export { default as AutocompleteRoot } from './root/AutocompleteRoot.vue';
export { default as AutocompleteValue } from './value/AutocompleteValue.vue';
export { AutocompleteTrigger } from './trigger/AutocompleteTrigger';
export { default as AutocompleteInput } from '../combobox/input/ComboboxInput.vue';
export { AutocompleteInputGroup } from './input-group/AutocompleteInputGroup';
export { default as AutocompleteIcon } from '../combobox/icon/ComboboxIcon.vue';
export { default as AutocompleteClear } from '../combobox/clear/ComboboxClear.vue';
export { default as AutocompleteList } from '../combobox/list/ComboboxList.vue';
export { default as AutocompleteStatus } from '../combobox/status/ComboboxStatus.vue';
export { default as AutocompletePortal } from '../combobox/portal/ComboboxPortal.vue';
export { default as AutocompleteBackdrop } from '../combobox/backdrop/ComboboxBackdrop.vue';
export { default as AutocompletePositioner } from '../combobox/positioner/ComboboxPositioner.vue';
export { default as AutocompletePopup } from '../combobox/popup/ComboboxPopup.vue';
export { default as AutocompleteArrow } from '../combobox/arrow/ComboboxArrow.vue';
export { default as AutocompleteGroup } from '../combobox/group/ComboboxGroup.vue';
export { default as AutocompleteGroupLabel } from '../combobox/group-label/ComboboxGroupLabel.vue';
export { AutocompleteItem } from './item/AutocompleteItem';
export { default as AutocompleteRow } from '../combobox/row/ComboboxRow.vue';
export { default as AutocompleteCollection } from '../combobox/collection/ComboboxCollection.vue';
export { default as AutocompleteEmpty } from '../combobox/empty/ComboboxEmpty.vue';
export { AutocompleteSeparator } from './separator/AutocompleteSeparator';

export type * from './root/AutocompleteRoot.vue';
export type * from './trigger/AutocompleteTrigger';
export type * from './input-group/AutocompleteInputGroup';
export type * from './item/AutocompleteItem';
export type * from './value/AutocompleteValue.vue';
export type * from './separator/AutocompleteSeparator';

export type {
  ComboboxInputProps as AutocompleteInputProps,
  ComboboxInputState as AutocompleteInputState,
} from '../combobox/input/ComboboxInput.vue';
export type {
  ComboboxIconProps as AutocompleteIconProps,
  ComboboxIconState as AutocompleteIconState,
} from '../combobox/icon/ComboboxIcon.vue';
export type {
  ComboboxClearProps as AutocompleteClearProps,
  ComboboxClearState as AutocompleteClearState,
} from '../combobox/clear/ComboboxClear.vue';
export type {
  ComboboxPopupProps as AutocompletePopupProps,
  ComboboxPopupState as AutocompletePopupState,
} from '../combobox/popup/ComboboxPopup.vue';
export type {
  ComboboxPositionerProps as AutocompletePositionerProps,
  ComboboxPositionerState as AutocompletePositionerState,
} from '../combobox/positioner/ComboboxPositioner.vue';
export type {
  ComboboxListProps as AutocompleteListProps,
  ComboboxListState as AutocompleteListState,
} from '../combobox/list/ComboboxList.vue';
export type {
  ComboboxRowProps as AutocompleteRowProps,
  ComboboxRowState as AutocompleteRowState,
} from '../combobox/row/ComboboxRow.vue';
export type {
  ComboboxArrowProps as AutocompleteArrowProps,
  ComboboxArrowState as AutocompleteArrowState,
} from '../combobox/arrow/ComboboxArrow.vue';
export type {
  ComboboxBackdropProps as AutocompleteBackdropProps,
  ComboboxBackdropState as AutocompleteBackdropState,
} from '../combobox/backdrop/ComboboxBackdrop.vue';
export type {
  ComboboxPortalProps as AutocompletePortalProps,
  ComboboxPortalState as AutocompletePortalState,
} from '../combobox/portal/ComboboxPortal.vue';
export type {
  ComboboxGroupProps as AutocompleteGroupProps,
  ComboboxGroupState as AutocompleteGroupState,
} from '../combobox/group/ComboboxGroup.vue';
export type {
  ComboboxGroupLabelProps as AutocompleteGroupLabelProps,
  ComboboxGroupLabelState as AutocompleteGroupLabelState,
} from '../combobox/group-label/ComboboxGroupLabel.vue';
export type {
  ComboboxEmptyProps as AutocompleteEmptyProps,
  ComboboxEmptyState as AutocompleteEmptyState,
} from '../combobox/empty/ComboboxEmpty.vue';
export type {
  ComboboxStatusProps as AutocompleteStatusProps,
  ComboboxStatusState as AutocompleteStatusState,
} from '../combobox/status/ComboboxStatus.vue';
export type {
  ComboboxCollectionState as AutocompleteCollectionState,
  ComboboxCollectionProps as AutocompleteCollectionProps,
} from '../combobox/collection/ComboboxCollection.vue';

export type {
  Filter as AutocompleteFilter,
  UseFilterOptions as AutocompleteFilterOptions,
} from '../combobox/root/utils/useFilter';

export * as AutocompleteTriggerDataAttributes from './trigger/AutocompleteTriggerDataAttributes';
export * as AutocompleteInputDataAttributes from '../combobox/input/ComboboxInputDataAttributes';
export * as AutocompleteInputGroupDataAttributes from './input-group/AutocompleteInputGroupDataAttributes';
export * as AutocompleteClearDataAttributes from './clear/AutocompleteClearDataAttributes';
export * as AutocompleteBackdropDataAttributes from '../combobox/backdrop/ComboboxBackdropDataAttributes';
export * as AutocompletePositionerCssVariables from '../combobox/positioner/ComboboxPositionerCssVars';
export * as AutocompletePositionerDataAttributes from '../combobox/positioner/ComboboxPositionerDataAttributes';
export * as AutocompletePopupDataAttributes from '../combobox/popup/ComboboxPopupDataAttributes';
export * as AutocompleteArrowDataAttributes from '../combobox/arrow/ComboboxArrowDataAttributes';
export * as AutocompleteItemDataAttributes from './item/AutocompleteItemDataAttributes';
export * as AutocompleteSeparatorDataAttributes from '../separator/SeparatorDataAttributes';
