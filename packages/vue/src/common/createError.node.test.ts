import { expect, test } from 'vitest';
import { createError } from './createError';

test('the text of an error gives each value as it is', () => {
  expect(createError(46, "a$&b$'c$$d").message).toBe(
    'Vase UI: The handle has no trigger with the id "a$&b$\'c$$d". Give this id to a trigger of the root, or open the popup with the id of one of its triggers.',
  );
});
