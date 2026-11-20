import { expectType } from '#test-utils';
import { createChangeEventDetails, createGenericEventDetails } from './createVaseUIEventDetails';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from './createVaseUIEventDetails';
import { REASONS } from './reasons';

const keyboardDetails = createGenericEventDetails(REASONS.keyboard);
expectType<typeof REASONS.keyboard, typeof keyboardDetails.reason>(keyboardDetails.reason);

const dayPressDetails = createChangeEventDetails(REASONS.dayPress);
expectType<MouseEvent | KeyboardEvent | PointerEvent, typeof dayPressDetails.event>(
  dayPressDetails.event,
);

const monthPressDetails = createChangeEventDetails(REASONS.monthPress);
expectType<MouseEvent | KeyboardEvent | PointerEvent, typeof monthPressDetails.event>(
  monthPressDetails.event,
);

const yearPressDetails = createChangeEventDetails(REASONS.yearPress);
expectType<MouseEvent | KeyboardEvent | PointerEvent, typeof yearPressDetails.event>(
  yearPressDetails.event,
);

const monthChangeDetails = createGenericEventDetails(REASONS.monthChange);
expectType<Event, typeof monthChangeDetails.event>(monthChangeDetails.event);

// @ts-expect-error reason must exist in REASONS
createGenericEventDetails('invalid-reason');

const changeWithProperties = createChangeEventDetails(REASONS.keyboard, undefined, undefined, {
  value: 1,
});
expectType<
  VaseUIChangeEventDetails<typeof REASONS.keyboard, { value: number }>,
  typeof changeWithProperties
>(changeWithProperties);

const genericWithProperties = createGenericEventDetails(REASONS.keyboard, undefined, { value: 1 });
expectType<
  VaseUIGenericEventDetails<typeof REASONS.keyboard, { value: number }>,
  typeof genericWithProperties
>(genericWithProperties);

const contextualChange: VaseUIChangeEventDetails<typeof REASONS.none, { value: number }> =
  createChangeEventDetails(REASONS.none, undefined, undefined, { value: 1 });
const contextualGeneric: VaseUIGenericEventDetails<typeof REASONS.none, { value: number }> =
  createGenericEventDetails(REASONS.none, undefined, { value: 1 });
