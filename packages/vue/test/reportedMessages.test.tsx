import { describe, expect, it, vi } from 'vitest';
import { defineComponent, inject, onUnmounted, warn } from 'vue';
import {
  createRenderer,
  expectSetupErrorWarnings,
  isVaporParts,
  takeReportedMessages,
} from '#test-utils';

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

const ConsoleWarningOnUnmountPart = defineComponent({
  setup() {
    onUnmounted(() => {
      console.warn('message of the unmount');
    });
    return () => <i />;
  },
});

const ThrowingPart = defineComponent({
  setup() {
    throw new Error('error raised in the setup');
  },
});

describe('expectSetupErrorWarnings', () => {
  const setup = 'Vue warning: Unhandled error during execution of setup function';
  const render = 'Vue warning: Unhandled error during execution of render function';

  it('accepts one setup warning', () => {
    expectSetupErrorWarnings([setup]);
  });

  it.each([
    { name: 'an empty list', messages: [] },
    { name: 'an unrelated first warning', messages: ['another warning'] },
    { name: 'a render warning first', messages: [render, setup] },
    { name: 'an unrelated later warning', messages: [setup, 'another warning'] },
    { name: 'two setup warnings', messages: [setup, setup] },
  ])('rejects $name', ({ messages }) => {
    expect(() => expectSetupErrorWarnings(messages)).toThrow();
  });

  it.each([
    { name: 'a setup and a render warning', messages: [setup, render] },
    { name: 'three parent render warnings', messages: [setup, render, render, render] },
  ])('accepts $name only for Vapor parts', ({ messages }) => {
    if (isVaporParts) {
      expectSetupErrorWarnings(messages);
    } else {
      expect(() => expectSetupErrorWarnings(messages)).toThrow();
    }
  });
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
    'fails a test in which the unmount calls console.warn while a spy replaces it',
    { fails: true },
    async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      await render(<ConsoleWarningOnUnmountPart />);
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

  // A `setup` that throws leaves the current instance of Vue set, so this case is last.
  it('gives one warning when a part throws in setup', async () => {
    await expect(render(<ThrowingPart />)).rejects.toThrow('error raised in the setup');

    expect(takeReportedMessages()).toEqual([
      expect.stringMatching(/^Vue warning: Unhandled error during execution of setup function/),
    ]);
  });
});
