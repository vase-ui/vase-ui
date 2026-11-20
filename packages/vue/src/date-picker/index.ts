/// <reference lib="esnext.temporal" preserve="true" />
export * as DatePicker from './index.parts';

export { default as DatePickerRoot } from './root/DatePickerRoot.vue';
export { default as DatePickerField } from './field/DatePickerField.vue';
export { default as DatePickerTrigger } from './trigger/DatePickerTrigger.vue';
export { default as DatePickerPositioner } from './positioner/DatePickerPositioner.vue';
export { default as DatePickerCalendar } from './calendar/DatePickerCalendar.vue';
export { default as DatePickerTimeField } from './time-field/DatePickerTimeField.vue';
export { default as DatePickerPortal } from '../popover/portal/PopoverPortal.vue';
export { default as DatePickerPopup } from './popup/DatePickerPopup.vue';
export { default as DatePickerArrow } from '../popover/arrow/PopoverArrow.vue';
export { default as DatePickerBackdrop } from '../popover/backdrop/PopoverBackdrop.vue';
export { default as DatePickerClose } from '../popover/close/PopoverClose.vue';
export { default as DatePickerTitle } from '../popover/title/PopoverTitle.vue';
export { default as DatePickerDescription } from '../popover/description/PopoverDescription.vue';

export type * from './root/DatePickerRoot.vue';
export type * from './field/DatePickerField.vue';
export type * from './trigger/DatePickerTrigger.vue';
export type * from './popup/DatePickerPopup.vue';
export type * from './positioner/DatePickerPositioner.vue';
export type * from './calendar/DatePickerCalendar.vue';
export type * from './time-field/DatePickerTimeField.vue';

export type {
  PopoverPortalProps as DatePickerPortalProps,
  PopoverPortalState as DatePickerPortalState,
} from '../popover/portal/PopoverPortal.vue';
export type {
  PopoverArrowProps as DatePickerArrowProps,
  PopoverArrowState as DatePickerArrowState,
} from '../popover/arrow/PopoverArrow.vue';
export type {
  PopoverBackdropProps as DatePickerBackdropProps,
  PopoverBackdropState as DatePickerBackdropState,
} from '../popover/backdrop/PopoverBackdrop.vue';
export type {
  PopoverCloseProps as DatePickerCloseProps,
  PopoverCloseState as DatePickerCloseState,
} from '../popover/close/PopoverClose.vue';
export type {
  PopoverTitleProps as DatePickerTitleProps,
  PopoverTitleState as DatePickerTitleState,
} from '../popover/title/PopoverTitle.vue';
export type {
  PopoverDescriptionProps as DatePickerDescriptionProps,
  PopoverDescriptionState as DatePickerDescriptionState,
} from '../popover/description/PopoverDescription.vue';

export * as DatePickerTriggerDataAttributes from '../popover/trigger/PopoverTriggerDataAttributes';
export * as DatePickerPositionerCssVariables from '../popover/positioner/PopoverPositionerCssVars';
export * as DatePickerPositionerDataAttributes from '../popover/positioner/PopoverPositionerDataAttributes';
export * as DatePickerCalendarDataAttributes from '../calendar/root/CalendarRootDataAttributes';
export * as DatePickerPopupCssVariables from '../popover/popup/PopoverPopupCssVars';
export * as DatePickerPopupDataAttributes from '../popover/popup/PopoverPopupDataAttributes';
export * as DatePickerArrowDataAttributes from '../popover/arrow/PopoverArrowDataAttributes';
export * as DatePickerBackdropDataAttributes from '../popover/backdrop/PopoverBackdropDataAttributes';
