import { expectType } from '#test-utils';
import { createChangeEventDetails, createGenericEventDetails } from './createBaseUIEventDetails';
import { REASONS } from './reasons';

const incrementDetails = createGenericEventDetails(REASONS.incrementPress);
expectType<typeof REASONS.incrementPress, typeof incrementDetails.reason>(incrementDetails.reason);

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
