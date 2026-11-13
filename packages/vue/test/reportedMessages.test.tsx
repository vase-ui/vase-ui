import { describe, expect, it, vi } from 'vitest';
import { defineComponent, inject, onUnmounted, warn } from 'vue';
import { createRenderer, hydrate, takeReportedMessages } from '#test-utils';

const WarningPart = defineComponent({
  setup() {
    inject('missing');
    return () => <i />;
  },
});

const WarningOnUnmountPart = defineComponent({
  setup() {
    onUnmounted(() => {
      warn('warning raised in the unmount');
    });
    return () => <i />;
  },
});

const ThrowingPart = defineComponent({
  setup() {
    throw new Error('error raised in the setup');
  },
});

describe('reported messages', () => {
  const { render } = createRenderer();

  it('fails a test in which a part makes Vue warn', { fails: true }, async () => {
    await render(<WarningPart />);
  });

  it.each([
    { name: 'console.warn', method: 'warn' },
    { name: 'console.error', method: 'error' },
  ] as const)(
    'fails a test in which a call to $name reaches the console',
    { fails: true },
    ({ method }) => {
      console[method]('text');
    },
  );

  it('fails a test in which the unmount makes Vue warn', { fails: true }, async () => {
    await render(<WarningOnUnmountPart />);
  });

  it(
    'fails a test in which the unmount after a hydration makes Vue warn',
    { fails: true },
    async () => {
      await hydrate(WarningOnUnmountPart, { serverHtml: '<i></i>' });
    },
  );

  it('gives the Vue warning to a test that takes it', async () => {
    await render(<WarningPart />);

    expect(takeReportedMessages()).toEqual([
      expect.stringMatching(/^Vue warning: injection "missing" not found/),
    ]);
  });

  it('gives no message when Vue does not warn', async () => {
    await render(<i />);

    expect(takeReportedMessages()).toEqual([]);
  });

  it('records a Vue warning while a spy replaces console.warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await render(<WarningPart />);

    expect(takeReportedMessages()).toEqual([
      expect.stringMatching(/^Vue warning: injection "missing" not found/),
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // The case above leaves its spy on `console.warn`: `vi.resetAllMocks()` in the setup resets the
  // spy and does not remove it.
  it('records a console call after a test replaced console.warn', () => {
    console.warn('text');

    expect(takeReportedMessages()).toEqual(['console.warn: text']);
  });

  // In Vue 3.5.12, a `setup` that throws leaves the current instance set, so this case is last.
  it('gives one warning when a part throws in setup', async () => {
    await expect(render(<ThrowingPart />)).rejects.toThrow('error raised in the setup');

    expect(takeReportedMessages()).toEqual([
      expect.stringMatching(/^Vue warning: Unhandled error during execution of setup function/),
    ]);
  });
});
