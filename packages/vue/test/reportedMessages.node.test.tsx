import { describe, expect, it } from 'vitest';
import { defineComponent, inject } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { takeReportedMessages } from './reportedMessages';

const WarningPart = defineComponent({
  setup() {
    inject('missing');
    return () => <i />;
  },
});

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
});
