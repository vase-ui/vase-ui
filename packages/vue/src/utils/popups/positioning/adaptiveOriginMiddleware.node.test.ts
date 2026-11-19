import { expect, it } from 'vitest';

it('loads the adaptive origin middleware without a document', async () => {
  expect(typeof document).toBe('undefined');
  const { adaptiveOrigin } = await import('./adaptiveOriginMiddleware');
  expect(adaptiveOrigin.name).toBe('adaptiveOrigin');
});
