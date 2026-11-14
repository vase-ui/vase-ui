import { Temporal } from 'temporal-polyfill/full/implementation';
import { afterAll, vi } from 'vitest';

/**
 * Replaces the global `Temporal` with the one of `temporal-polyfill`, with all its calendars, for
 * the rest of the test file. The implementation entry installs nothing by itself. A `.node.test`
 * file imports this function by a relative path to `test/temporalPolyfill`.
 */
export function useTemporalPolyfill(): void {
  vi.stubGlobal('Temporal', Temporal);
  afterAll(() => {
    vi.unstubAllGlobals();
  });
}
