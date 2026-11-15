/// <reference lib="esnext.temporal" preserve="true" />
export * as TimeClock from './index.parts';

export { default as TimeClockRoot } from './root/TimeClockRoot.vue';
export { default as TimeClockFace } from './face/TimeClockFace.vue';
export { default as TimeClockHand } from './hand/TimeClockHand.vue';
export { default as TimeClockNumber } from './number/TimeClockNumber.vue';
export { default as TimeClockDayPeriod } from './day-period/TimeClockDayPeriod.vue';
export { default as TimeClockViewTrigger } from './view-trigger/TimeClockViewTrigger.vue';

export type * from './root/TimeClockRoot.vue';
export type * from './face/TimeClockFace.vue';
export type * from './hand/TimeClockHand.vue';
export type * from './number/TimeClockNumber.vue';
export type * from './day-period/TimeClockDayPeriod.vue';
export type * from './view-trigger/TimeClockViewTrigger.vue';

export * as TimeClockRootDataAttributes from './root/TimeClockRootDataAttributes';
export * as TimeClockFaceDataAttributes from './face/TimeClockFaceDataAttributes';
export * as TimeClockHandDataAttributes from './hand/TimeClockHandDataAttributes';
export * as TimeClockNumberDataAttributes from './number/TimeClockNumberDataAttributes';
export * as TimeClockDayPeriodDataAttributes from './day-period/TimeClockDayPeriodDataAttributes';
export * as TimeClockViewTriggerDataAttributes from './view-trigger/TimeClockViewTriggerDataAttributes';

export * as TimeClockHandCssVariables from './hand/TimeClockHandCssVars';
export * as TimeClockNumberCssVariables from './number/TimeClockNumberCssVars';
