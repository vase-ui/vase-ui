import { expect, it } from 'vitest';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';

const nativeTemporal = globalThis.Temporal;

useTemporalPolyfill();

it('renders the cases of the server on the polyfill and not on the native Temporal', () => {
  expect(Temporal).not.toBe(nativeTemporal);
  expect(Temporal.PlainTime.from('10:30')).not.toBeInstanceOf(nativeTemporal.PlainTime);
});

// The family reads `Temporal` only when a part renders, so these cases get the polyfill.
await import('./TimeClockRoot.node.test');
