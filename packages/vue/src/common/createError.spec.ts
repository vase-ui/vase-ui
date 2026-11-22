import { createError } from './createError';

createError(1);
createError(26, 'Dialog', 'Popup');
// @ts-expect-error The text of code 1 has no value.
createError(1, 'Item');
// @ts-expect-error The text of code 26 has two values.
createError(26, 'Dialog');
// @ts-expect-error No text has the code 0.
createError(0);
