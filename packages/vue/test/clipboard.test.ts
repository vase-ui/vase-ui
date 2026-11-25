import { describe, expect, test } from 'vitest';
import { commands } from 'vitest/browser';
import { withClipboard } from './clipboard';
import { wait } from './wait';

describe('withClipboard', () => {
  test('runs concurrent clipboard actions one after the other, and releases after a throw', async () => {
    const log: string[] = [];
    const first = withClipboard(async () => {
      log.push('start 1');
      await wait(40);
      log.push('end 1');
    });
    const second = withClipboard(async () => {
      log.push('start 2');
      throw new Error('boom');
    }).catch(() => {
      log.push('caught 2');
    });
    const third = withClipboard(async () => {
      log.push('start 3');
      log.push('end 3');
    });
    await Promise.all([first, second, third]);
    expect(log).toEqual(['start 1', 'end 1', 'start 2', 'caught 2', 'start 3', 'end 3']);
  });

  test('ignores a stale unlock token while another caller holds the lock', async () => {
    const first = await commands.lockClipboard();
    await commands.unlockClipboard(first);
    const log: string[] = [];
    const second = await commands.lockClipboard();
    try {
      await commands.unlockClipboard(first);
      const third = withClipboard(async () => {
        log.push('third');
      });
      await wait(30);
      expect(log).toEqual([]);
      await commands.unlockClipboard(second);
      await third;
      expect(log).toEqual(['third']);
    } finally {
      await commands.unlockClipboard(second);
    }
  });
});
