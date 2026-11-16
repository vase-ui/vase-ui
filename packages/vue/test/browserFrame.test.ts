import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import type { FrameResult, FrameScenario } from './server/inspectBrowserFrame';

declare module 'vitest/browser' {
  interface BrowserCommands {
    inspectBrowserFrame: (scenario: FrameScenario) => Promise<FrameResult>;
  }
}

describe('Playwright test frame', () => {
  it.each([
    { name: 'named', scenario: 'current' },
    { name: 'not yet named', scenario: 'unnamed' },
  ] as const)('avoids an element lookup for a frame that is $name', async ({ scenario }) => {
    expect(await commands.inspectBrowserFrame(scenario)).toEqual({
      text: 'current',
      elementLookups: 0,
    });
  });

  it.each([
    { name: 'a removed frame', scenario: 'stale' },
    { name: 'an unrelated frame', scenario: 'unrelated' },
    { name: 'no frame', scenario: 'missing' },
  ] as const)('finds the current frame when the client has $name', async ({ scenario }) => {
    expect(await commands.inspectBrowserFrame(scenario)).toEqual({
      text: 'current',
      elementLookups: 1,
    });
  });

  it('refuses two test frames', async () => {
    const result = await commands.inspectBrowserFrame('duplicate');
    expect(result.error).toContain('strict mode violation');
    expect(result.text).toBeUndefined();
  });

  it('refuses a test element that has no frame', async () => {
    const result = await commands.inspectBrowserFrame('non-frame');
    expect(result.error).toContain('Cannot find "vitest-iframe" on the page');
    expect(result.text).toBeUndefined();
  });
});
