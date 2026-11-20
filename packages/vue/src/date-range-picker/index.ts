/// <reference lib="esnext.temporal" preserve="true" />
export * as DateRangePicker from './index.parts';

export { default as DateRangePickerRoot } from './root/DateRangePickerRoot.vue';
export { default as DateRangePickerStartField } from './start-field/DateRangePickerStartField.vue';
export { default as DateRangePickerEndField } from './end-field/DateRangePickerEndField.vue';
export { default as DateRangePickerTrigger } from './trigger/DateRangePickerTrigger.vue';
export { default as DateRangePickerPositioner } from './positioner/DateRangePickerPositioner.vue';
export { default as DateRangePickerCalendar } from './calendar/DateRangePickerCalendar.vue';
export { default as DateRangePickerPortal } from '../popover/PopoverPortal.vue';
export { default as DateRangePickerPopup } from './popup/DateRangePickerPopup.vue';
export { default as DateRangePickerArrow } from '../popover/PopoverArrow.vue';
export { default as DateRangePickerBackdrop } from '../popover/PopoverBackdrop.vue';
export { default as DateRangePickerClose } from '../popover/PopoverClose.vue';
export { default as DateRangePickerTitle } from '../popover/PopoverTitle.vue';
export { default as DateRangePickerDescription } from '../popover/PopoverDescription.vue';

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
} from '../popover/types';
export type {
  PopoverArrowProps as DateRangePickerArrowProps,
  PopoverArrowState as DateRangePickerArrowState,
} from '../popover/types';
export type {
  PopoverBackdropProps as DateRangePickerBackdropProps,
  PopoverBackdropState as DateRangePickerBackdropState,
} from '../popover/types';
export type {
  PopoverCloseProps as DateRangePickerCloseProps,
  PopoverCloseState as DateRangePickerCloseState,
} from '../popover/types';
export type {
  PopoverTitleProps as DateRangePickerTitleProps,
  PopoverTitleState as DateRangePickerTitleState,
} from '../popover/types';
export type {
  PopoverDescriptionProps as DateRangePickerDescriptionProps,
  PopoverDescriptionState as DateRangePickerDescriptionState,
} from '../popover/types';
