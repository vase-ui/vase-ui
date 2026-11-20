import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { assertTemporal } from './temporal';

function withoutTemporal() {
  vi.stubGlobal('Temporal', undefined);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
}

describe('without Temporal', () => {
  it('has no check for an engine that has Temporal', () => {
    expect(() => {
      assertTemporal('Calendar.Root');
    }).not.toThrow();
  });

  it('throws a message that names the part', () => {
    withoutTemporal();
    expect(() => {
      assertTemporal('Calendar.Root');
    }).toThrow(
      new Error(
        'Vase UI: <Calendar.Root> needs the global `Temporal`, and this JavaScript engine does not have it. ' +
          'The part cannot make or compare a date without it. ' +
          'Load a Temporal polyfill, such as `temporal-polyfill/global`, before the app mounts.',
      ),
    );
  });

  it('loads each helper module', async () => {
    withoutTemporal();
    vi.resetModules();
    await expect(
      Promise.all([
        import('./temporal'),
        import('./format'),
        import('./matchers'),
        import('./displayCalendar'),
      ]),
    ).resolves.toHaveLength(4);
  });
});
