import { expect, it } from 'vitest';
import { useTemporalPolyfill } from '../../../../test/temporalPolyfill';

const nativeTemporal = globalThis.Temporal;

useTemporalPolyfill();

it('runs the cases on the polyfill and not on the native Temporal', () => {
  expect(Temporal).not.toBe(nativeTemporal);
  expect(Temporal.PlainDate.from('2026-11-14')).not.toBeInstanceOf(nativeTemporal.PlainDate);
});

// Each module reads `Temporal` only in its cases, so the cases get the polyfill.
await import('./segmentLayout.test');
await import('./segmentRanges.test');
await import('./customValidity.test');
