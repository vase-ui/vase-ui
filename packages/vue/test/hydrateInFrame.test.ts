import { expect, test } from 'vitest';
import { hydrateInFrame } from './hydrateInFrame';

// A promise that never ends shows as a time-out with no reason.
test('a fixture that the frame cannot load rejects the call', async () => {
  await expect(
    hydrateInFrame('NoSuchFixture', {}, document.createElement('div')),
  ).rejects.toBeDefined();
});
