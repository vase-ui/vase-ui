/// <reference lib="esnext.temporal" preserve="true" />
export * as DateRangePicker from './index.parts';

export { default as DateRangePickerRoot } from './root/DateRangePickerRoot.vue';
export { default as DateRangePickerStartField } from './start-field/DateRangePickerStartField.vue';
export { default as DateRangePickerEndField } from './end-field/DateRangePickerEndField.vue';
export { default as DateRangePickerTrigger } from './trigger/DateRangePickerTrigger.vue';
export { default as DateRangePickerPositioner } from './positioner/DateRangePickerPositioner.vue';
export { default as DateRangePickerCalendar } from './calendar/DateRangePickerCalendar.vue';
export { default as DateRangePickerPortal } from '../popover/portal/PopoverPortal.vue';
export { default as DateRangePickerPopup } from './popup/DateRangePickerPopup.vue';
export { default as DateRangePickerArrow } from '../popover/arrow/PopoverArrow.vue';
export { default as DateRangePickerBackdrop } from '../popover/backdrop/PopoverBackdrop.vue';
export { default as DateRangePickerClose } from '../popover/close/PopoverClose.vue';
export { default as DateRangePickerTitle } from '../popover/title/PopoverTitle.vue';
export { default as DateRangePickerDescription } from '../popover/description/PopoverDescription.vue';

export type * from './root/DateRangePickerRoot.vue';
export type * from './start-field/DateRangePickerStartField.vue';
export type * from './end-field/DateRangePickerEndField.vue';
export type * from './trigger/DateRangePickerTrigger.vue';
export type * from './popup/DateRangePickerPopup.vue';
export type * from './positioner/DateRangePickerPositioner.vue';
export type * from './calendar/DateRangePickerCalendar.vue';

export type {
  PopoverPortalProps as DateRangePickerPortalProps,
  PopoverPortalState as DateRangePickerPortalState,
} from '../popover/portal/PopoverPortal.vue';
export type {
  PopoverArrowProps as DateRangePickerArrowProps,
  PopoverArrowState as DateRangePickerArrowState,
} from '../popover/arrow/PopoverArrow.vue';
export type {
  PopoverBackdropProps as DateRangePickerBackdropProps,
  PopoverBackdropState as DateRangePickerBackdropState,
} from '../popover/backdrop/PopoverBackdrop.vue';
export type {
  PopoverCloseProps as DateRangePickerCloseProps,
  PopoverCloseState as DateRangePickerCloseState,
} from '../popover/close/PopoverClose.vue';
export type {
  PopoverTitleProps as DateRangePickerTitleProps,
  PopoverTitleState as DateRangePickerTitleState,
} from '../popover/title/PopoverTitle.vue';
export type {
  PopoverDescriptionProps as DateRangePickerDescriptionProps,
  PopoverDescriptionState as DateRangePickerDescriptionState,
} from '../popover/description/PopoverDescription.vue';

export * as DateRangePickerTriggerDataAttributes from '../popover/trigger/PopoverTriggerDataAttributes';
export * as DateRangePickerPositionerCssVariables from '../popover/positioner/PopoverPositionerCssVars';
export * as DateRangePickerPositionerDataAttributes from '../popover/positioner/PopoverPositionerDataAttributes';
export * as DateRangePickerCalendarDataAttributes from '../range-calendar/root/RangeCalendarRootDataAttributes';
export * as DateRangePickerPopupCssVariables from '../popover/popup/PopoverPopupCssVars';
export * as DateRangePickerPopupDataAttributes from '../popover/popup/PopoverPopupDataAttributes';
export * as DateRangePickerArrowDataAttributes from '../popover/arrow/PopoverArrowDataAttributes';
export * as DateRangePickerBackdropDataAttributes from '../popover/backdrop/PopoverBackdropDataAttributes';
