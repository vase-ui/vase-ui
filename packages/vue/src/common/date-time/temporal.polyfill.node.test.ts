import { expect, it } from 'vitest';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';

const nativeTemporal = globalThis.Temporal;

useTemporalPolyfill();

it('runs the helper cases on the polyfill and not on the native Temporal', () => {
  expect(Temporal).not.toBe(nativeTemporal);
  expect(Temporal.PlainDate.from('2026-11-14')).not.toBeInstanceOf(nativeTemporal.PlainDate);
});

// Each module reads `Temporal` only in its cases, so the cases get the polyfill.
await import('./temporal.test');
await import('./format.test');
await import('./matchers.test');
await import('./displayCalendar.test');
