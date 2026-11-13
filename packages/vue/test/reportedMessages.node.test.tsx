import { describe, expect, it } from 'vitest';
import { defineComponent, inject } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { isReportedMessage, takeReportedMessages } from './reportedMessages';

const WarningPart = defineComponent({
  setup() {
    inject('missing');
    return () => <i />;
  },
});

const activeEffectMessage =
  'console.warn: [Vue warn] Active effect was not restored correctly - this is likely a Vue internal bug.';

describe('reported messages in Node', () => {
  it('fails a test in which a server render makes Vue warn', { fails: true }, async () => {
    await renderToString(<WarningPart />);
  });

  it('gives the Vue warning to a test that takes it', async () => {
    await renderToString(<WarningPart />);

    expect(takeReportedMessages()).toEqual([
      expect.stringMatching(/^console\.warn: \[Vue warn\]: injection "missing" not found/),
    ]);
  });

  it.each([
    {
      name: 'drops the active effect message on a prerelease of Vue 3.6',
      text: activeEffectMessage,
      vueVersion: '3.6.0-rc.15',
      isReported: false,
    },
    {
      name: 'reports the active effect message on a release of Vue 3.6',
      text: activeEffectMessage,
      vueVersion: '3.6.0',
      isReported: true,
    },
    {
      name: 'reports the active effect message on Vue 3.5',
      text: activeEffectMessage,
      vueVersion: '3.5.45',
      isReported: true,
    },
    {
      name: 'reports another console message on a prerelease of Vue 3.6',
      text: 'console.warn: [Vue warn] text',
      vueVersion: '3.6.0-rc.15',
      isReported: true,
    },
  ])('$name', ({ text, vueVersion, isReported }) => {
    expect(isReportedMessage(text, vueVersion)).toBe(isReported);
  });
});
