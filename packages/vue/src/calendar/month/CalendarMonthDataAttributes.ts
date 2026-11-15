import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';

/**
 * Present when the calendar is disabled.
 */
export const disabled = 'data-disabled';
/**
 * Present when the user cannot select a day.
 */
export const readonly = 'data-readonly';
/**
 * Present when the value of the calendar is not valid.
 */
export const invalid = 'data-invalid';
/**
 * Present when no day is selected.
 */
export const empty = 'data-empty';
/**
 * The position of the month in the months of the calendar, from `0`. It is `-1` while the month
 * leaves the calendar.
 */
export const index = 'data-index';
/**
 * Present when the month begins animating in.
 */
export const startingStyle = TransitionStatusDataAttributes.startingStyle;
/**
 * Present when the month is animating out. The month has no interaction then.
 */
export const endingStyle = TransitionStatusDataAttributes.endingStyle;
